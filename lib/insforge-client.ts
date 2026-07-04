"use client";

import { createClient } from "@insforge/sdk";

const rawBaseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL ?? "";
const baseUrl = rawBaseUrl.startsWith("http://") || rawBaseUrl.startsWith("https://") ? rawBaseUrl : "";
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? "";

export const authConfigured = Boolean(baseUrl && anonKey);
export const insforge = authConfigured
  ? createClient({ baseUrl, anonKey })
  : null;
