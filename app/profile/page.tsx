"use client";

import Link from "next/link";
import { useEffect } from "react";
import { trackEvent } from "@/lib/posthog";

export default function ProfilePage() {
  useEffect(() => {
    trackEvent("profile_viewed", { page: "profile" });
  }, []);
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16 sm:px-8">
        <div className="rounded-[32px] border border-border bg-surface p-10 shadow-sm">
          <h1 className="text-4xl font-semibold text-text-dark">Profile</h1>
          <p className="mt-4 max-w-2xl text-base text-text-secondary">
            This profile page is under construction. After signing in, your profile edit experience will be available here.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex items-center justify-center rounded-[12px] bg-text-primary px-6 py-3 text-sm font-medium text-white transition hover:bg-accent-dark">
              Sign in
            </Link>
            <Link href="/" className="inline-flex items-center justify-center rounded-[12px] border border-border bg-surface px-6 py-3 text-sm font-medium text-text-primary transition hover:border-text-primary">
              Back to homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
