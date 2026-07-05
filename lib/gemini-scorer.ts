/**
 * Job matching and scoring using Google Generative AI (Gemini)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const scoringSchema = z.object({
  matchScore: z.coerce
    .number()
    .min(0)
    .max(100)
    .describe("Match score from 0-100"),
  matchReason: z.string().describe("Why this job matches or doesn't match"),
  matchedSkills: z.array(z.string()).describe("Skills from job that match profile"),
  missingSkills: z.array(z.string()).describe("Required skills not in profile"),
});

export type JobScore = z.infer<typeof scoringSchema>;

export async function scoreJobMatchesBatch(
  jobs: Array<{ id: string; title: string; description: string; company: string }>,
  profileTitle: string,
  profileSkills: string[],
  profileExperience: string,
): Promise<Record<string, JobScore>> {
  if (!jobs || jobs.length === 0) return {};

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a job matching expert. Score how well each of these jobs matches the candidate's profile.

CANDIDATE PROFILE:
- Current Title: ${profileTitle}
- Skills: ${profileSkills.join(", ")}
- Experience: ${profileExperience}

JOBS TO SCORE:
${jobs.map((job) => `JOB ID: ${job.id}
Title: ${job.title}
Company: ${job.company}
Description snippet: ${job.description.substring(0, 800)}
`).join("\n---\n")}

Analyze the matches and return a JSON object where keys are the JOB ID and values are the scoring result.
Format exactly as:
{
  "job-id-1": { "matchScore": 85, "matchReason": "...", "matchedSkills": ["A"], "missingSkills": ["B"] },
  "job-id-2": { "matchScore": 40, "matchReason": "...", "matchedSkills": [], "missingSkills": ["C", "D"] }
}
Return ONLY valid JSON.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });
    const responseText = result.response.text();
    
    const parsed = JSON.parse(responseText);
    const results: Record<string, JobScore> = {};
    
    // Validate each job score
    for (const [id, scoreData] of Object.entries(parsed)) {
      try {
        results[id] = scoringSchema.parse(scoreData);
      } catch (e) {
        results[id] = { matchScore: 50, matchReason: "Failed to validate score", matchedSkills: [], missingSkills: [] };
      }
    }
    
    // Ensure all jobs have a score
    for (const job of jobs) {
      if (!results[job.id]) {
        results[job.id] = { matchScore: 50, matchReason: "Model skipped this job", matchedSkills: [], missingSkills: [] };
      }
    }
    
    return results;
  } catch (error: any) {
    console.error("Gemini batch scoring error:", error?.message || error);
    // Return default scores on quota limit / error
    const fallback: Record<string, JobScore> = {};
    for (const job of jobs) {
      fallback[job.id] = {
        matchScore: 50,
        matchReason: "Could not analyze this job due to API rate limits.",
        matchedSkills: [],
        missingSkills: [],
      };
    }
    return fallback;
  }
}
