"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authConfigured, insforge } from "@/lib/insforge-client";
import { trackEvent } from "@/lib/posthog";

type OAuthProvider = "google" | "github";

type ProviderConfig = {
  key: OAuthProvider;
  label: string;
  description: string;
};

const providers: ProviderConfig[] = [
  { key: "google", label: "Sign in with Google", description: "Sign in with your Google account" },
  { key: "github", label: "Sign in with GitHub", description: "Sign in with your GitHub account" },
];

export default function LoginPage() {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("login_page_viewed", { page: "login" });
    
    // Check if user is already logged in after OAuth callback
    (async () => {
      if (!authConfigured || !insforge) return;
      const { data } = await insforge.auth.getCurrentUser();
      if (data?.user) {
        // User is logged in, redirect to dashboard
        window.location.href = "/dashboard";
      }
    })();
  }, []);

  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : "/dashboard";

  async function handleOAuth(provider: OAuthProvider) {
    setErrorMessage(null);
    setLoadingProvider(provider);
    trackEvent("oauth_login_started", { provider, page: "login" });

    if (!authConfigured || !insforge) {
      setErrorMessage("Auth is not configured. Please set NEXT_PUBLIC_INSFORGE_URL and NEXT_PUBLIC_INSFORGE_ANON_KEY, then restart the dev server.");
      trackEvent("oauth_login_failed", { provider, reason: "auth_not_configured", page: "login" });
      setLoadingProvider(null);
      return;
    }

    try {
      const result = await insforge.auth.signInWithOAuth(provider, {
        redirectTo,
        additionalParams: { prompt: "select_account" },
      });

      if (result.error) {
        console.error("[LoginPage] OAuth signInWithOAuth error:", result.error);
        const errorReason = result.error.message ?? "oauth_error";
        setErrorMessage(`${errorReason}`);
        trackEvent("oauth_login_failed", { provider, reason: errorReason, page: "login" });
        setLoadingProvider(null);
        return;
      }

      // If we get here, InsForge is handling the redirect automatically
      // The user will be taken to the OAuth provider and then back to redirectTo
      trackEvent("oauth_login_redirected", { provider, page: "login" });
    } catch (error) {
      console.error("[LoginPage] OAuth signInWithOAuth thrown error:", error);
      setErrorMessage("Unable to start OAuth flow. Please try again.");
      trackEvent("oauth_login_failed", { provider, reason: "exception", page: "login" });
      setLoadingProvider(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12 sm:px-8">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-3 text-lg font-semibold text-text-dark">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white">JP</span>
            JobPilot
          </Link>
          <Link href="/" className="text-sm font-medium text-text-secondary hover:text-text-dark">Back to homepage</Link>
        </div>

        <div className="rounded-[32px] border border-border bg-surface p-10 shadow-sm">
          <div className="space-y-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Welcome back</p>
            <h1 className="text-3xl font-semibold text-text-dark sm:text-4xl">Sign in to continue</h1>
            <p className="mx-auto max-w-xl text-sm text-text-secondary sm:text-base">
              Use your existing Google or GitHub account to sign in and continue your JobPilot setup.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {providers.map((provider) => (
              <button
                key={provider.key}
                type="button"
                onClick={() => handleOAuth(provider.key)}
                disabled={Boolean(loadingProvider)}
                className="flex w-full items-center justify-between rounded-[20px] border border-border bg-background px-5 py-4 text-left transition hover:border-text-primary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-semibold text-text-dark">{provider.label}</p>
                  <p className="mt-1 text-xs text-text-secondary">{provider.description}</p>
                </div>
                <span className="text-sm font-semibold text-text-secondary">
                  {loadingProvider === provider.key ? "Opening…" : "→"}
                </span>
              </button>
            ))}
          </div>

          {!authConfigured ? (
            <div className="mt-6 rounded-[20px] border border-warning bg-warning-lightest p-4 text-sm text-warning">
              InsForge auth is not configured correctly. Confirm that <code>NEXT_PUBLIC_INSFORGE_URL</code> and <code>NEXT_PUBLIC_INSFORGE_ANON_KEY</code> are set in <code>.env.local</code>, then restart the dev server.
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-6 rounded-[20px] border border-error bg-error-lightest p-4 text-sm text-error">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-8 rounded-[20px] border border-border bg-surface-secondary px-5 py-4 text-sm text-text-secondary">
            <p className="font-semibold text-text-dark">Need help?</p>
            <p className="mt-2">If OAuth fails, make sure your auth provider is configured in InsForge and restart the dev server after adding environment variables.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
