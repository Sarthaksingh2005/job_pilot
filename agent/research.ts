import Browserbase from "@browserbasehq/sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

// Zod schemas for extraction
const homepageSchema = z.object({
  oneLiner: z.string().describe("What the company does in one sentence"),
  productSummary: z.string().describe("What they build/sell and who it's for"),
  signals: z.array(z.string()).describe("Funding, notable customers, scale, mission, recent news"),
  pageLinks: z.array(
    z.object({
      url: z.string(),
      kind: z.enum(["about", "careers", "blog", "engineering", "product", "team", "other"]),
    })
  ).describe("Internal links worth visiting"),
});

const subPageSchema = z.object({
  keyPoints: z.array(z.string()),
  technologies: z.array(z.string()).describe("Specific languages, frameworks, tools, platforms"),
  valuesOrCulture: z.array(z.string()).describe("Stated values, working style, team norms"),
  notable: z.array(z.string()).describe("Customers, funding, scale, projects, awards"),
});

export type CompanyDossier = {
  companyOverview: string;
  techStack: string[];
  culture: string[];
  whyThisRole: string;
  yourEdge: string[];
  gapsToAddress: string[];
  smartQuestions: string[];
  interviewPrep: string[];
  sources: string[];
};

// Derive company homepage URL
async function getCompanyHomepage(redirectUrl: string, companyName: string): Promise<string> {
  if (redirectUrl) {
    try {
      const response = await fetch(redirectUrl, { method: "GET", redirect: "follow" });
      const finalUrl = response.url;
      if (finalUrl && !finalUrl.includes("adzuna.com")) {
        const urlObj = new URL(finalUrl);
        const hostParts = urlObj.hostname.split(".");
        const domain = hostParts.length >= 2 ? hostParts.slice(-2).join(".") : urlObj.hostname;
        return `https://${domain}`;
      }
    } catch (err) {
      console.warn("[Research Agent] Redirect follow failed, using fallback:", err);
    }
  }
  const cleanCompany = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `https://www.${cleanCompany || "company"}.com`;
}

export async function researchCompany(
  job: { title: string; company: string; description: string; matched_skills: string[]; missing_skills: string[]; source_url: string | null; external_apply_url: string | null },
  profile: { current_title: string | null; years_experience: number | null; experience_level: string | null; skills: string[]; work_experience: any }
): Promise<CompanyDossier> {
  const homepageUrl = await getCompanyHomepage(job.external_apply_url || job.source_url || "", job.company);
  console.log(`[Research Agent] Starting research for ${job.company} at ${homepageUrl}`);

  let homepageData: z.infer<typeof homepageSchema> | null = null;
  const subPagesData: z.infer<typeof subPageSchema>[] = [];
  const visitedUrls: string[] = [homepageUrl];

  const browserbaseKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSER_PROJECT_ID || process.env.BROWSERBASE_PROJECT_ID;

  if (browserbaseKey && projectId) {
    let stagehand: Stagehand | null = null;
    try {
      const bb = new Browserbase({ apiKey: browserbaseKey });
      const session = await bb.sessions.create({
        projectId,
        timeout: 120,
      });

      stagehand = new Stagehand({
        env: "BROWSERBASE",
        apiKey: browserbaseKey,
        projectId,
        browserbaseSessionID: session.id,
        model: {
          modelName: "google/gemini-2.5-flash",
          apiKey: process.env.GOOGLE_API_KEY!,
        },
        disablePino: true,
      });

      await stagehand.init();
      const page = stagehand.context.activePage()!;
      await page.goto(homepageUrl, { waitUntil: "domcontentloaded", timeoutMs: 30000 });

      // Step 1 - Homepage extraction
      const extractedHome = await stagehand.extract(
        "This is a company's homepage. Capture what the company actually does, who it's for, and any concrete signals (funding, scale, mission, recent launches). Then find the internal links most worth visiting to research them as an employer.",
        homepageSchema
      );

      if (extractedHome && (extractedHome.oneLiner || extractedHome.productSummary)) {
        homepageData = extractedHome;

        // Step 2 - Sub-page extraction (max 3, prefer about/blog/engineering/product over careers)
        const linksToVisit = (extractedHome.pageLinks || [])
          .filter(link => link.url && link.url.startsWith("/"))
          .slice(0, 3);

        for (const link of linksToVisit) {
          const targetUrl = new URL(link.url, homepageUrl).toString();
          if (visitedUrls.includes(targetUrl)) continue;

          console.log(`[Research Agent] Visiting sub-page: ${targetUrl}`);
          try {
            await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeoutMs: 20000 });
            const subData = await stagehand.extract(
              "Extract substance that helps a candidate understand this company: what they do, values, technologies, and team operation.",
              subPageSchema
            );
            if (subData) {
              subPagesData.push(subData);
              visitedUrls.push(targetUrl);
            }
          } catch (subErr) {
            console.warn(`[Research Agent] Failed to extract sub-page ${targetUrl}:`, subErr);
          }
        }
      }
    } catch (browserError) {
      console.error("[Research Agent] Browserbase/Stagehand extraction failed:", browserError);
    } finally {
      if (stagehand) {
        try {
          await stagehand.close();
        } catch (closeErr) {
          console.error("[Research Agent] Error closing Stagehand:", closeErr);
        }
      }
    }
  } else {
    console.warn("[Research Agent] Browserbase keys missing. Skipping live browsing, proceeding to synthesis with job description alone.");
  }

  // Synthesize research using Gemini
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const systemPrompt = `You are a sharp career strategist preparing a candidate to apply for a specific role. You are given (a) research collected from the company's own website, (b) the job posting, and (c) the candidate's profile. Produce a concise, concrete briefing that gives this specific candidate an edge for this specific role.

Rules:
- Ground every company claim in the provided research or job posting. Never invent funding, customers, headcount, or facts. If research was thin or empty, infer carefully from the job posting and state what is inferred.
- Be specific to THIS candidate. Connect their actual skills and past work to this company's stack, product, and values. No generic advice that would apply to anyone.
- Turn the candidate's missing skills into a strategy: how to frame the gap honestly and what adjacent experience to lean on.
- Talking points and questions must reference real things from the research, the kind of detail that signals the candidate did their homework.
- Keep every item tight: one or two sentences. No fluff.

Return ONLY valid JSON matching this exact shape:
{
  "companyOverview": "string",
  "techStack": ["string"],
  "culture": ["string"],
  "whyThisRole": "string",
  "yourEdge": ["string"],
  "gapsToAddress": ["string"],
  "smartQuestions": ["string"],
  "interviewPrep": ["string"],
  "sources": ["string"]
}`;

  const userPrompt = `COMPANY RESEARCH (from their website):
${JSON.stringify({ homepage: homepageData, subPages: subPagesData })}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}
Matched skills: ${(job.matched_skills || []).join(", ")}
Missing skills: ${(job.missing_skills || []).join(", ")}

CANDIDATE PROFILE:
Current title: ${profile.current_title}
Experience: ${profile.years_experience} years, level ${profile.experience_level}
Skills: ${(profile.skills || []).join(", ")}
Work history: ${JSON.stringify(profile.work_experience)}`;

  try {
    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(result.response.text());
    
    // Add sources if not present
    if (!parsed.sources || parsed.sources.length === 0) {
      parsed.sources = visitedUrls;
    }

    return parsed as CompanyDossier;
  } catch (synthError) {
    console.error("[Research Agent] Dossier synthesis failed, returning fallback:", synthError);
    return {
      companyOverview: `${job.company} is a company in the tech space recruiting for a ${job.title} role.`,
      techStack: job.matched_skills || [],
      culture: ["Team collaboration", "Innovation-driven environment"],
      whyThisRole: `This role exists to support ${job.company}'s engineering initiatives for the ${job.title} position.`,
      yourEdge: [`Your experience matches the core requirements like ${job.matched_skills.join(", ") || "software engineering"}.`],
      gapsToAddress: job.missing_skills.length > 0 ? [`Frame gaps in ${job.missing_skills.join(", ")} by highlighting your adaptability.`] : [],
      smartQuestions: [`What are the core technical challenges the team is currently facing?`],
      interviewPrep: [`Be prepared to talk about your experience with ${job.matched_skills.join(", ") || "your skills"}.`],
      sources: visitedUrls,
    };
  }
}
