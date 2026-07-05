"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge-client";
import { AppHeader } from "@/components/AppHeader";
import type { SVGProps } from "react";

type JobData = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  job_type: string | null;
  about_role: string | null;
  match_score: number;
  match_reason: string | null;
  company_research: {
    matched_skills?: string[];
    missing_skills?: string[];
  } | null;
  external_apply_url: string | null;
  source_url: string | null;
  created_at: string;
};

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!insforge) {
        setError("Authentication is not configured.");
        setLoading(false);
        return;
      }

      const { data: authData } = await insforge.auth.getCurrentUser();
      if (!authData?.user) {
        router.push("/login");
        return;
      }

      const { data, error: dbError } = await insforge.database
        .from("jobs")
        .select("*")
        .eq("id", id)
        .eq("user_id", authData.user.id)
        .single();

      if (dbError || !data) {
        setError("Job not found.");
        setLoading(false);
        return;
      }

      setJob(data as JobData);
      setLoading(false);
    })();
  }, [id, router]);

  async function handleResearch() {
    if (!job) {
      console.warn("[Research] No job data available");
      return;
    }
    console.log("[Research] Initiating research for job:", job.id);
    setResearching(true);
    setResearchError(null);

    try {
      let userId: string | undefined;
      if (insforge) {
        const { data: authData } = await insforge.auth.getCurrentUser();
        userId = authData?.user?.id;
      }

      const response = await fetch("/api/agent/research", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId: job.id, userId }),
      });

      console.log("[Research] API responded with status:", response.status);

      if (!response.ok) {
        const data = await response.json();
        const errMsg = data.error || "Failed to research company";
        console.error("[Research] API error:", errMsg);
        alert(`Research failed: ${errMsg}`);
        throw new Error(errMsg);
      }

      const data = await response.json();
      console.log("[Research] API success, received dossier:", data.dossier);
      
      // Update job state with the new dossier
      setJob(prev => prev ? { ...prev, company_research: data.dossier } : null);

      // Track PostHog event
      if (insforge) {
        const { data: authData } = await insforge.auth.getCurrentUser();
        if (authData?.user?.id) {
          const { trackEvent } = await import("@/lib/posthog");
          trackEvent("company_researched", {
            userId: authData.user.id,
            jobId: job.id,
            company: job.company,
          });
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || "An unexpected error occurred during company research.";
      setResearchError(errMsg);
      console.error("[Research] Catch handler error:", err);
      alert(`Error: ${errMsg}`);
    } finally {
      setResearching(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-text-primary">
        <AppHeader />
        <main className="mx-auto max-w-[860px] px-6 py-8 lg:px-8 lg:py-10">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-accent" />
            <p className="mt-4 text-sm font-medium text-text-secondary">Loading job details…</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-background text-text-primary">
        <AppHeader />
        <main className="mx-auto max-w-[860px] px-6 py-8 lg:px-8 lg:py-10">
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-lg font-semibold text-text-dark">{error || "Job not found"}</p>
            <Link href="/find-jobs" className="mt-4 text-sm font-medium text-accent hover:underline">
              ← Back to Jobs
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const matchedSkills: string[] = job.company_research?.matched_skills || [];
  const missingSkills: string[] = job.company_research?.missing_skills || [];
  const matchScore = job.match_score || 0;

  // Check if research dossier is populated
  const dossier = job.company_research as any;
  const hasDossier = dossier && dossier.companyOverview;

  function formatRelativeTime(dateStr: string) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <AppHeader />

      <main className="mx-auto max-w-[860px] px-6 py-8 lg:px-8 lg:py-10">
        {/* Back Link */}
        <Link
          href="/find-jobs"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition hover:text-text-primary"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back to Jobs
        </Link>

        {/* Job Header Card */}
        <section className="rounded-[20px] border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-background">
                <CompanyIcon className="h-7 w-7 text-text-secondary" />
              </div>
              <div>
                <h1 className="text-[22px] font-bold leading-tight text-text-darkest">{job.title}</h1>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-base font-medium text-text-secondary">{job.company}</span>
                  <span className="text-text-muted">•</span>
                  <span className="text-sm font-semibold text-accent">{matchScore}% Match Score</span>
                </div>
              </div>
            </div>
            <a
              href={job.external_apply_url || job.source_url || "#"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-border bg-surface px-4 text-sm font-semibold text-text-primary shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:bg-surface-secondary"
            >
              <ExternalLinkIcon className="h-4 w-4" />
              View Job Post
            </a>
          </div>
        </section>

        {/* Info Cards Row */}
        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background">
              <DollarIcon className="h-4 w-4 text-text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{job.salary || "—"}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Salary Est.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background">
              <LocationIcon className="h-4 w-4 text-text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{job.location || "—"}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Location</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background">
              <BuildingIcon className="h-4 w-4 text-text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold capitalize text-text-primary">{job.job_type || "—"}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Job Type</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background">
              <CalendarIcon className="h-4 w-4 text-text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{formatRelativeTime(job.created_at)}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Date Found</p>
            </div>
          </div>
        </section>

        {/* AI Match Reasoning */}
        <section className="mt-5 rounded-[20px] border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5">
            <SparkleIcon className="h-5 w-5 text-accent" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">AI Match Reasoning</h2>
          </div>
          <p className="text-[15px] font-medium leading-[1.75] text-text-dark">
            {job.match_reason || "AI match reasoning is unavailable for this job. Please run a new search to generate a fresh analysis."}
          </p>
        </section>

        {/* Required Skills vs Your Profile */}
        <section className="mt-5 rounded-[20px] border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-5 text-xs font-bold uppercase tracking-widest text-text-secondary">
            Required Skills vs Your Profile
          </h2>

          {(matchedSkills.length > 0 || missingSkills.length > 0) ? (
            <div className="space-y-5">
              {matchedSkills.length > 0 && (
                <div>
                  <p className="mb-2.5 text-sm font-medium text-text-secondary">You have</p>
                  <div className="flex flex-wrap gap-2">
                    {matchedSkills.map((skill, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <CheckIcon className="h-3 w-3" />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {missingSkills.length > 0 && (
                <div>
                  <p className="mb-2.5 text-sm font-medium text-text-secondary">Gap skills</p>
                  <div className="flex flex-wrap gap-2">
                    {missingSkills.map((skill, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                        <XIcon className="h-3 w-3" />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm font-medium text-text-secondary">Skills analysis is unavailable for this job. Please run a new search to generate an updated matching profile.</p>
          )}
        </section>

        {/* Job Description */}
        <section className="mt-5 rounded-[20px] border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5">
            <DocumentIcon className="h-5 w-5 text-text-secondary" />
            <h2 className="text-lg font-semibold text-text-darkest">Job Description</h2>
          </div>
          <p className="text-[15px] font-medium leading-[1.75] text-text-dark">
            {job.about_role || "No description provided."}
          </p>
          {job.about_role && (job.about_role.endsWith("…") || job.about_role.endsWith("...") || job.about_role.length > 500) && (
            <a
              href={job.external_apply_url || job.source_url || "#"}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:underline"
            >
              View full job
              <ExternalLinkIcon className="h-3.5 w-3.5" />
            </a>
          )}
        </section>

        {/* Company Research */}
        {hasDossier ? (
          <section className="mt-5 rounded-[20px] border border-border bg-surface p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 border-b border-border pb-4">
              <CompanyResearchIcon className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold text-text-darkest">Company Research Dossier</h2>
            </div>

            {/* Company Overview */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary mb-2">Company Overview</h3>
              <p className="text-[15px] font-medium leading-[1.65] text-text-dark">{dossier.companyOverview}</p>
            </div>

            {/* Tech Stack */}
            {dossier.techStack && dossier.techStack.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary mb-2.5">Tech Stack</h3>
                <div className="flex flex-wrap gap-2">
                  {dossier.techStack.map((tech: string, i: number) => (
                    <span key={i} className="rounded-[8px] bg-background border border-border px-2.5 py-1 text-xs font-semibold text-text-primary">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Culture */}
            {dossier.culture && dossier.culture.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary mb-2">Culture & Values</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-[15px] font-medium text-text-dark">
                  {dossier.culture.map((point: string, i: number) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Why This Role */}
            {dossier.whyThisRole && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary mb-2">Why This Role</h3>
                <p className="text-[15px] font-medium leading-[1.65] text-text-dark">{dossier.whyThisRole}</p>
              </div>
            )}

            {/* Your Edge */}
            {dossier.yourEdge && dossier.yourEdge.length > 0 && (
              <div className="rounded-[12px] bg-emerald-50/50 border border-emerald-100 p-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-800 mb-2">Your Edge</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-[15px] font-medium text-emerald-900">
                  {dossier.yourEdge.map((point: string, i: number) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Gaps to Address */}
            {dossier.gapsToAddress && dossier.gapsToAddress.length > 0 && (
              <div className="rounded-[12px] bg-red-50/50 border border-red-100 p-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-red-800 mb-2">Gaps to Address</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-[15px] font-medium text-red-900">
                  {dossier.gapsToAddress.map((point: string, i: number) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Smart Questions */}
            {dossier.smartQuestions && dossier.smartQuestions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary mb-2">Smart Questions to Ask</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-[15px] font-medium text-text-dark">
                  {dossier.smartQuestions.map((point: string, i: number) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Interview Prep */}
            {dossier.interviewPrep && dossier.interviewPrep.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary mb-2">Interview Preparation Topics</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-[15px] font-medium text-text-dark">
                  {dossier.interviewPrep.map((point: string, i: number) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sources */}
            {dossier.sources && dossier.sources.length > 0 && (
              <div className="border-t border-border pt-4 text-xs text-text-muted">
                <span className="font-semibold mr-1.5">Sources:</span>
                <div className="inline-flex flex-wrap gap-x-2 gap-y-1">
                  {dossier.sources.map((src: string, i: number) => (
                    <a key={i} href={src} target="_blank" rel="noreferrer" className="hover:underline text-accent">
                      {src}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="mt-5 rounded-[20px] border border-border bg-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2.5">
                <CompanyResearchIcon className="h-5 w-5 text-text-secondary" />
                <h2 className="text-lg font-semibold text-text-darkest">Company Research</h2>
              </div>
              <button
                type="button"
                onClick={handleResearch}
                disabled={researching}
                className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {researching ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <SearchIcon className="h-3.5 w-3.5" />
                )}
                {researching ? "Researching..." : "Research Company"}
              </button>
            </div>
            
            {researchError && (
              <div className="m-6 p-4 rounded-[12px] bg-red-50 border border-red-100 text-sm text-red-700">
                {researchError}
              </div>
            )}

            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[12px] bg-background">
                <CompanyResearchIcon className="h-6 w-6 text-text-muted" />
              </div>
              <h3 className="mb-1.5 text-base font-semibold text-text-darkest">No research yet</h3>
              <p className="max-w-xs text-sm font-medium leading-relaxed text-text-secondary">
                Click &quot;Research Company&quot; to let the AI browse {job.company}&apos;s public pages and build a dossier.
              </p>
            </div>
          </section>
        )}

        {/* Apply Now Button */}
        <a
          href={job.external_apply_url || job.source_url || "#"}
          target="_blank"
          rel="noreferrer"
          className="mt-8 flex h-[52px] w-full items-center justify-center rounded-[14px] bg-accent text-base font-bold text-white shadow-sm transition hover:bg-accent-dark"
        >
          Apply Now at {job.company}
        </a>
      </main>
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────────


function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function CompanyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M3 9h6" />
      <path d="M3 15h6" />
      <path d="M15 8h2" />
      <path d="M15 12h2" />
      <path d="M15 16h2" />
    </svg>
  );
}

function DollarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function LocationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function BuildingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" /><path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  );
}

function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.7L12 18l-1.8-5.5-5.5-1.7L10.2 9Z" />
      <path d="M19.5 14.5 20 16l1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5Z" />
      <path d="M5 4.5 5.5 6l1.5.5-1.5.5-.5 1.5-.5-1.5L3 6.5 4.5 6Z" />
    </svg>
  );
}

function DocumentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function CompanyResearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ExternalLinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
