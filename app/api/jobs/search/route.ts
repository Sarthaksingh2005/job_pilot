import { NextRequest, NextResponse } from "next/server";
import { insforgeServer, getCurrentServerUserId } from "@/lib/insforge-server";
import { searchAdzunaJobs, mapAdzunaToJobRecord } from "@/lib/adzuna";
import { scoreJobMatchesBatch } from "@/lib/gemini-scorer";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const submittedUserId = readString(body, "userId");
    const jobTitle = readString(body, "jobTitle");
    const location = readString(body, "location");
    const serverUserId = await getCurrentServerUserId();
    const userId = serverUserId ?? submittedUserId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!insforgeServer) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    if (!jobTitle) {
      return NextResponse.json(
        { error: "jobTitle is required" },
        { status: 400 }
      );
    }

    // Get user's profile
    const { data: profile, error: profileError } = await insforgeServer.database
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Create agent_runs record
    const { data: agentRun, error: runError } = await insforgeServer.database
      .from("agent_runs")
      .insert({
        user_id: userId,
        status: "running",
        job_title_searched: jobTitle,
        location_searched: location || "",
      })
      .select()
      .single();

    if (runError || !agentRun) {
      return NextResponse.json(
        { error: "Failed to create agent run" },
        { status: 500 }
      );
    }

    // Detect the correct Adzuna country code using AI based on the user's location string
    const countryCode = await detectAdzunaCountry(location || "");
    const adzunaJobs = await searchAdzunaJobs(jobTitle, location || "", countryCode);

    if (adzunaJobs.length === 0) {
      // Update agent_runs to completed with no jobs
      await insforgeServer.database
        .from("agent_runs")
        .update({
          status: "completed",
          jobs_found: 0,
          completed_at: new Date().toISOString(),
        })
        .eq("id", agentRun.id);

      return NextResponse.json({
        runId: agentRun.id,
        jobs: [],
        message: "No jobs found",
      });
    }

    // Score all jobs against the profile in a single batch call to save rate limits
    const experienceString = `${profile.years_experience} years as ${profile.current_title}`;
    
    const jobsForScoring = adzunaJobs.map((job: any) => ({
      id: String(job.id),
      title: job.title,
      description: job.description,
      company: job.company?.display_name || "Unknown",
    }));

    const batchScores = await scoreJobMatchesBatch(
      jobsForScoring,
      profile.current_title || "",
      profile.skills || [],
      experienceString
    );

    const scoredJobs = adzunaJobs.map((adzunaJob: any) => {
      const jobId = String(adzunaJob.id);
      const score = batchScores[jobId];
      if (score) {
        return mapAdzunaToJobRecord(
          adzunaJob,
          userId,
          agentRun.id,
          score.matchScore,
          score.matchReason,
          score.matchedSkills,
          score.missingSkills
        );
      } else {
        return mapAdzunaToJobRecord(
          adzunaJob,
          userId,
          agentRun.id,
          50, // default match score
          "Job matches your basic search criteria, but advanced AI scoring was unavailable.",
          [],
          []
        );
      }
    });

    // Batch insert all jobs
    let finalJobs = scoredJobs;
    if (scoredJobs.length > 0) {
      const { data: insertedJobs, error: insertError } = await insforgeServer.database
        .from("jobs")
        .insert(scoredJobs)
        .select();

      if (insertError) {
        console.error("Failed to insert jobs:", insertError);
        return NextResponse.json(
          { error: "Failed to save jobs" },
          { status: 500 }
        );
      }

      if (insertedJobs) {
        finalJobs = insertedJobs as any[];
      }
    }

    // Update agent_runs to completed
    await insforgeServer.database
      .from("agent_runs")
      .update({
        status: "completed",
        jobs_found: finalJobs.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", agentRun.id);

    return NextResponse.json({
      runId: agentRun.id,
      jobs: finalJobs,
      count: finalJobs.length,
    });
  } catch (error) {
    console.error("Job search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function readString(value: unknown, key: string): string {
  if (!isRecord(value)) {
    return "";
  }

  const item = value[key];
  return typeof item === "string" ? item.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function detectAdzunaCountry(location: string): Promise<string> {
  if (!location || location.trim() === "") return "us";
  const loc = location.toLowerCase();
  
  // Local fallback to save Gemini API rate limits
  if (loc.includes("uk") || loc.includes("london") || loc.includes("england") || loc.includes("britain") || loc.includes("manchester")) return "gb";
  if (loc.includes("india") || loc.includes("mumbai") || loc.includes("bangalore") || loc.includes("delhi") || loc.includes("pune") || loc.includes("chennai") || loc.includes("lucknow") || loc.includes("hyderabad") || loc.includes("noida") || loc.includes("gurgaon")) return "in";
  if (loc.includes("australia") || loc.includes("sydney") || loc.includes("melbourne") || loc.includes("brisbane")) return "au";
  if (loc.includes("canada") || loc.includes("toronto") || loc.includes("vancouver") || loc.includes("montreal")) return "ca";
  if (loc.includes("germany") || loc.includes("berlin") || loc.includes("munich")) return "de";
  if (loc.includes("france") || loc.includes("paris")) return "fr";
  if (loc.includes("brazil") || loc.includes("sao paulo") || loc.includes("rio")) return "br";
  if (loc.includes("netherlands") || loc.includes("amsterdam")) return "nl";
  if (loc.includes("new zealand") || loc.includes("auckland")) return "nz";
  if (loc.includes("singapore")) return "sg";
  if (loc.includes("us") || loc.includes("usa") || loc.includes("new york") || loc.includes("california") || loc.includes("texas")) return "us";

  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are a geolocation expert. Given the location string "${location}", which of the following Adzuna country codes is the best match?
Supported codes: at (Austria), au (Australia), br (Brazil), ca (Canada), ch (Switzerland), de (Germany), es (Spain), fr (France), gb (UK), in (India), it (Italy), mx (Mexico), nl (Netherlands), nz (New Zealand), pl (Poland), ru (Russia), sg (Singapore), us (USA), za (South Africa).
If the location is not in any of these countries, return the closest one or "us".
Return ONLY the 2-letter lowercase code and nothing else.`;

    const result = await model.generateContent(prompt);
    const code = result.response.text().trim().toLowerCase();
    const supported = ["at", "au", "br", "ca", "ch", "de", "es", "fr", "gb", "in", "it", "mx", "nl", "nz", "pl", "ru", "sg", "us", "za"];
    return supported.includes(code) ? code : "us";
  } catch (error) {
    console.error("AI country detection failed, defaulting to US:", error);
    return "us";
  }
}
