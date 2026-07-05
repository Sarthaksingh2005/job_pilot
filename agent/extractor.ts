import { PDFParse } from "pdf-parse";
import { normalizeProfile, type ProfileRecord } from "@/lib/profile";

export type ExtractResumeResult = {
  success: boolean;
  profile?: ProfileRecord;
  error?: string;
};

const minimumResumeTextLength = 120;
const geminiModel = process.env.GEMINI_MODEL ?? process.env.GOOGLE_AI_MODEL ?? "gemini-2.5-flash";

export async function extractProfileFromResumePdf(pdfBuffer: Buffer, existingProfile: ProfileRecord): Promise<ExtractResumeResult> {
  try {
    const resumeText = await tryExtractPdfText(pdfBuffer);
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      return {
        success: false,
        error: "Google AI Studio is not configured on the server. Set API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY in .env.local and restart the dev server.",
      };
    }

    const content = resumeText.length >= minimumResumeTextLength
      ? await extractProfileJsonFromText(apiKey, resumeText, existingProfile)
      : await extractProfileJsonFromPdf(apiKey, pdfBuffer, existingProfile);

    if (!content) {
      return { success: false, error: "Could not extract profile data from this resume." };
    }

    const extractedProfile = normalizeProfile({
      ...existingProfile,
      ...parseProfileJson(content),
      id: existingProfile.id,
      email: getExtractedEmail(content) || existingProfile.email,
      resume_pdf_url: existingProfile.resume_pdf_url,
      is_complete: existingProfile.is_complete,
    });

    return { success: true, profile: extractedProfile };
  } catch (error) {
    console.error("[agent/extractor]", error);
    return { success: false, error: getExtractionErrorMessage(error) };
  }
}

async function extractProfileJsonFromText(apiKey: string, resumeText: string, existingProfile: ProfileRecord): Promise<string> {
  return callGemini(apiKey, [
    { text: `${geminiSystemInstruction()}

${profileExtractionInstructions()}

Existing profile JSON:
${JSON.stringify(existingProfile)}

Resume text:
${resumeText}` },
  ]);
}

async function extractProfileJsonFromPdf(apiKey: string, pdfBuffer: Buffer, existingProfile: ProfileRecord): Promise<string> {
  const base64Pdf = pdfBuffer.toString("base64");

  return callGemini(apiKey, [
    {
      inline_data: {
        mime_type: "application/pdf",
        data: base64Pdf,
      },
    },
    { text: `${geminiSystemInstruction()}

Use the attached PDF file as the source of truth for the candidate profile.

${profileExtractionInstructions()}

Existing profile JSON:
${JSON.stringify(existingProfile)}` },
  ]);
}

async function tryExtractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    return await extractPdfText(pdfBuffer);
  } catch (error) {
    console.warn("[agent/extractor] pdf-parse failed; falling back to OpenAI PDF file input", error);
    return "";
  }
}

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: pdfBuffer });

  try {
    const result = await parser.getText();
    return result.text.replace(/\s+/g, " ").trim();
  } finally {
    await parser.destroy();
  }
}

function parseProfileJson(content: string): Partial<ProfileRecord> {
  const parsed: unknown = JSON.parse(stripJsonFences(content));
  return isRecord(parsed) ? parsed : {};
}

async function callGemini(apiKey: string, parts: GeminiPart[]): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload: unknown = await response.json();

  if (!response.ok) {
    throw createGeminiError(response.status, payload);
  }

  return readGeminiText(payload);
}

function geminiSystemInstruction(): string {
  return "You extract candidate profile fields from resumes. Return only valid JSON. Return only facts grounded in the resume. Use empty strings, empty arrays, or null when a field is not present. Keep responsibilities concise and preserve dates as written.";
}

function profileExtractionInstructions(): string {
  return `Return JSON with exactly these keys:
full_name, email, phone, location, current_title, experience_level, years_experience, skills, industries, work_experience, education, job_titles_seeking, remote_preference, preferred_locations, salary_expectation, cover_letter_tone, linkedin_url, portfolio_url, work_authorization.

Use these shapes:
- years_experience: integer or null
- skills, industries, job_titles_seeking, preferred_locations: string arrays
- work_experience: up to 3 objects with company, title, startDate, endDate, current, responsibilities
- education: object with degree, field, institution, graduationYear

Use these exact enum values when possible:
- experience_level: "", "Junior", "Mid", "Senior", or "Lead"
- remote_preference: "", "Any", "Remote", "Hybrid", or "On-site"
- cover_letter_tone: "", "Formal", "Casual", or "Enthusiastic"
- work_authorization: "", "Citizen", "Permanent Resident", "Work Permit", or "Visa Required"`;
}

function getExtractedEmail(content: string): string {
  try {
    const parsed: unknown = JSON.parse(stripJsonFences(content));
    if (isRecord(parsed) && typeof parsed.email === "string") {
      return parsed.email.trim();
    }
  } catch {
    return "";
  }

  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

type GeminiPart = {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
};

function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GOOGLE_AI_API_KEY ??
    process.env.API_KEY ??
    ""
  ).trim();
}

function stripJsonFences(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function readGeminiText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) {
    return "";
  }

  const [candidate] = payload.candidates;
  if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
    return "";
  }

  return candidate.content.parts
    .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function createGeminiError(status: number, payload: unknown): Error {
  const message = getGeminiErrorMessage(payload) || `Gemini API request failed with status ${status}.`;
  const error = new Error(message);
  return Object.assign(error, { status, provider: "gemini" });
}

function getGeminiErrorMessage(payload: unknown): string {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return "";
  }

  return typeof payload.error.message === "string" ? payload.error.message : "";
}

function getExtractionErrorMessage(error: unknown): string {
  if (isRecord(error)) {
    const status = typeof error.status === "number" ? error.status : null;

    if (status === 400) {
      return "Google AI Studio could not process this PDF request. Check the server console for details.";
    }

    if (status === 401 || status === 403) {
      return "Google AI Studio rejected the API key. Check API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY in .env.local and restart the dev server.";
    }

    if (status === 429) {
      return "Google AI Studio could not process the resume because the account is rate-limited or out of quota.";
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (message.toLowerCase().includes("unsupported file") || message.toLowerCase().includes("invalid file")) {
    return "Google AI Studio could not read this PDF file. Please try re-saving it as a standard PDF and upload it again.";
  }

  return "Could not extract profile data from this resume.";
}
