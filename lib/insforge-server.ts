import { createAdminClient } from "@insforge/sdk";
import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

const rawBaseUrl = process.env.INSFORGE_URL ?? process.env.NEXT_PUBLIC_INSFORGE_URL ?? "";
const baseUrl = rawBaseUrl.startsWith("http://") || rawBaseUrl.startsWith("https://") ? rawBaseUrl : "";
// Accept either the dedicated service key name or the older/api-style key name.
const apiKey = process.env.INSFORGE_SERVICE_KEY ?? process.env.INSFORGE_API_KEY ?? "";

export const serverConfigured = Boolean(baseUrl && apiKey);
export const insforgeBaseUrl = baseUrl;

export const insforgeServer = serverConfigured
  ? createAdminClient({ baseUrl, apiKey })
  : null;

export async function createInsforgeServerClient() {
  return createServerClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    cookies: await cookies(),
  });
}

export async function getCurrentServerUserId(): Promise<string | null> {
  try {
    const insforge = await createInsforgeServerClient();
    const { data, error } = await insforge.auth.getCurrentUser();

    if (error || !data?.user?.id) {
      return null;
    }

    return data.user.id;
  } catch (error) {
    console.warn("[lib/insforge-server] Unable to read current user from server cookies", error);
    return null;
  }
}

export async function uploadResumeToResumesBucket(file: File | null, userId: string): Promise<{ url: string; key: string } | null> {
  if (!file) return null;
  if (!serverConfigured || !insforgeServer) {
    throw new Error("InsForge server client not configured. Set INSFORGE_API_KEY and INSFORGE_URL in environment.");
  }

  const objectPath = `resumes/${userId}/resume.pdf`;
  const bucket = insforgeServer.storage.from("resumes");
  const uploadResult = await bucket.upload(objectPath, file);

  if (uploadResult.error) {
    throw new Error(uploadResult.error.message ?? "Resume upload failed.");
  }

  const data = uploadResult.data as { url?: string; key?: string } | null;
  const key = data?.key ?? objectPath;
  const url = data?.url ?? `${baseUrl.replace(/\/$/, "")}/api/storage/buckets/resumes/objects/${encodeURIComponent(key)}`;

  return { url, key };
}
