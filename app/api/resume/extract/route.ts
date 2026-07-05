import { NextResponse, type NextRequest } from "next/server";
import { extractProfileFromResumePdf } from "@/agent/extractor";
import { getCurrentServerUserId, insforgeServer, serverConfigured } from "@/lib/insforge-server";
import { normalizeProfile, type ProfileRecord } from "@/lib/profile";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const profile = normalizeProfile(parseProfilePayload(readText(formData, "profile")));
    const serverUserId = await getCurrentServerUserId();
    const userId = serverUserId ?? profile.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in before extracting your profile." }, { status: 401 });
    }

    const resumeFile = formData.get("resume");
    const pdfBuffer = resumeFile instanceof File && resumeFile.size > 0
      ? Buffer.from(await resumeFile.arrayBuffer())
      : await downloadSavedResume(userId);

    if (!pdfBuffer) {
      return NextResponse.json({ success: false, error: "Upload a PDF resume before extracting your profile." }, { status: 400 });
    }

    const result = await extractProfileFromResumePdf(pdfBuffer, {
      ...profile,
      id: userId,
      email: profile.email,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error ?? "Could not extract profile data from this resume." }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.profile });
  } catch (error) {
    console.error("[resume/extract]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

async function downloadSavedResume(userId: string): Promise<Buffer | null> {
  if (!serverConfigured || !insforgeServer) {
    return null;
  }

  const bucket = insforgeServer.storage.from("resumes");
  const { data, error } = await bucket.download(`resumes/${userId}/resume.pdf`);

  if (error || !data) {
    if (error) {
      console.error("[resume/extract] Failed to download saved resume", error);
    }
    return null;
  }

  return Buffer.from(await data.arrayBuffer());
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseProfilePayload(value: string): Partial<ProfileRecord> {
  if (!value) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
