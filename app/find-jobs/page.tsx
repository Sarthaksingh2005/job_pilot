"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SVGProps } from "react";
import { insforge } from "@/lib/insforge-client";
import { trackEvent } from "@/lib/posthog";
import { AppHeader } from "@/components/AppHeader";

type JobRow = {
  id: string;
  company: string;
  role: string;
  score: number;
  scoreColor: "success" | "info" | "warning";
  salary: string | null;
  dateFound: string;
  scoreWidth: string;
};

const matchColorClass: Record<"success" | "info" | "warning", string> = {
  success: "bg-success-alt",
  info: "bg-info-medium",
  warning: "bg-warning",
};

function getScoreColor(score: number): "success" | "info" | "warning" {
  if (score >= 85) return "success";
  if (score >= 70) return "info";
  return "warning";
}

function formatDate(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}

export default function FindJobsPage() {
  const [jobTitle, setJobTitle] = useState("Frontend Engineer");
  const [location, setLocation] = useState("");
  
  // Job Data State
  const [allJobs, setAllJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Pagination State
  const [filterTab, setFilterTab] = useState<"all" | "high" | "low">("all");
  const [sortOption, setSortOption] = useState<"score" | "newest" | "oldest">("newest");
  const [textSearch, setTextSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const loadJobs = async (runId?: string) => {
    if (!insforge) return;
    const { data: authData } = await insforge.auth.getCurrentUser();
    if (!authData?.user) return;
    
    let targetRunId = runId;
    if (!targetRunId) {
      const { data: latestRun } = await insforge.database
        .from("agent_runs")
        .select("id")
        .eq("user_id", authData.user.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .single();
        
      if (latestRun) {
        targetRunId = latestRun.id;
      }
    }
    
    let query = insforge.database
      .from("jobs")
      .select("*")
      .eq("user_id", authData.user.id);
      
    if (targetRunId) {
      query = query.eq("run_id", targetRunId);
    }
    
    const { data: jobsData, error: jobsError } = await query.order("created_at", { ascending: false });

    if (jobsData && !jobsError) {
      const jobRows: JobRow[] = jobsData.map((job: any) => ({
        id: job.id,
        company: job.company,
        role: job.title,
        score: job.match_score || 0,
        scoreColor: getScoreColor(job.match_score || 0),
        salary: job.salary,
        dateFound: job.created_at,
        scoreWidth: `${job.match_score || 0}%`,
      }));
      setAllJobs(jobRows);
    } else {
      setAllJobs([]);
    }
  };

  useEffect(() => {
    trackEvent("find_jobs_viewed", { page: "find-jobs" });

    // Fetch user profile to populate defaults and load past jobs
    (async () => {
      if (!insforge) return;
      
      const { data } = await insforge.auth.getCurrentUser();
      if (data.user?.id) {
        const { data: profileData } = await insforge.database
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        if (profileData) {
          // Populate location from profile if available
          if (profileData.preferred_locations?.[0]) {
            setLocation(profileData.preferred_locations[0]);
          }
        }
        await loadJobs();
      }
    })();
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Verify user is authenticated
      if (!insforge) {
        setError("Authentication is not configured. Please refresh the page.");
        setLoading(false);
        return;
      }

      const { data: authData } = await insforge.auth.getCurrentUser();
      if (!authData?.user) {
        setError("You must be logged in to search jobs. Please log in and try again.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, location, userId: authData.user.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401) {
          setError("Your session has expired. Please log in again.");
        } else {
          setError(data.error || "Failed to search jobs");
        }
        return;
      }

      const data = await response.json();
      
      trackEvent("jobs_searched", {
        jobTitle,
        location,
        jobsFound: data.count || 0,
      });

      // Reload jobs list to show newly found jobs with fresh DB ids
      await loadJobs(data.runId);
      // Reset filters to show new results easily
      setFilterTab("all");
      setSortOption("newest");
      setTextSearch("");
      setCurrentPage(1);

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to search jobs";
      setError(message);
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  }

  // Derived State
  const filteredJobs = allJobs.filter(job => {
    if (textSearch) {
      const lowerSearch = textSearch.toLowerCase();
      if (!job.company.toLowerCase().includes(lowerSearch) && !job.role.toLowerCase().includes(lowerSearch)) {
        return false;
      }
    }
    if (filterTab === "high" && job.score < 70) return false;
    if (filterTab === "low" && job.score >= 70) return false;
    return true;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortOption === "score") {
      return b.score - a.score;
    } else if (sortOption === "newest") {
      return new Date(b.dateFound).getTime() - new Date(a.dateFound).getTime();
    } else if (sortOption === "oldest") {
      return new Date(a.dateFound).getTime() - new Date(b.dateFound).getTime();
    }
    return 0;
  });

  const JOBS_PER_PAGE = 20;
  const totalPages = Math.ceil(sortedJobs.length / JOBS_PER_PAGE);
  const safeCurrentPage = Math.min(currentPage, totalPages > 0 ? totalPages : 1);
  const startIndex = (safeCurrentPage - 1) * JOBS_PER_PAGE;
  const displayedJobs = sortedJobs.slice(startIndex, startIndex + JOBS_PER_PAGE);

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <AppHeader />

      <main className="mx-auto max-w-[1720px] px-6 py-8 lg:px-10 lg:py-10">
        <section className="rounded-[28px] border border-border bg-surface px-5 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_14px_36px_rgba(16,24,40,0.05)] lg:px-8 lg:py-8">
          <form className="space-y-6" onSubmit={handleSearch}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
              <label className="space-y-2">
                <span className="block text-sm font-semibold uppercase tracking-[0.03em] text-text-dark">Job Title</span>
                <div className="flex h-14 items-center gap-3 rounded-[14px] border border-border bg-surface px-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition focus-within:border-accent">
                  <SearchIcon className="shrink-0 text-text-muted" />
                  <input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none"
                    placeholder="e.g. Frontend Engineer"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-semibold uppercase tracking-[0.03em] text-text-dark">Location</span>
                <div className="flex h-14 items-center gap-3 rounded-[14px] border border-border bg-surface px-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition focus-within:border-accent">
                  <LocationIcon className="shrink-0 text-text-muted" />
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none"
                    placeholder="e.g. San Francisco, Remote"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex h-14 items-center justify-center gap-2 rounded-[14px] bg-accent px-8 font-semibold text-white shadow-sm transition hover:bg-accent-dark disabled:opacity-50"
              >
                {loading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                ) : (
                  <>
                    <SparkleIcon />
                    <span>Search Matches</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {error && (
          <div className="mt-6 rounded-[14px] bg-warning/10 p-4 text-sm font-medium text-warning">
            {error}
          </div>
        )}

        {allJobs.length > 0 && (
          <section className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 rounded-[14px] bg-surface p-1 shadow-[0_1px_2px_rgba(16,24,40,0.05)] border border-border">
              <button 
                onClick={() => { setFilterTab("all"); setCurrentPage(1); }}
                className={`rounded-[10px] px-4 py-2 text-sm font-semibold transition ${filterTab === "all" ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-secondary"}`}
              >
                All Matches
              </button>
              <button 
                onClick={() => { setFilterTab("high"); setCurrentPage(1); }}
                className={`rounded-[10px] px-4 py-2 text-sm font-semibold transition ${filterTab === "high" ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-secondary"}`}
              >
                High Match (70%+)
              </button>
              <button 
                onClick={() => { setFilterTab("low"); setCurrentPage(1); }}
                className={`rounded-[10px] px-4 py-2 text-sm font-semibold transition ${filterTab === "low" ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-secondary"}`}
              >
                Low Match
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex h-10 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition focus-within:border-accent">
                <SearchIcon className="h-4 w-4 shrink-0 text-text-muted" />
                <input
                  value={textSearch}
                  onChange={(e) => { setTextSearch(e.target.value); setCurrentPage(1); }}
                  className="w-full sm:w-48 bg-transparent text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none"
                  placeholder="Filter by company or role..."
                />
              </div>
              <select
                value={sortOption}
                onChange={(e) => { setSortOption(e.target.value as any); setCurrentPage(1); }}
                className="h-10 rounded-[10px] border border-border bg-surface px-3 text-sm font-medium text-text-primary shadow-[0_1px_2px_rgba(16,24,40,0.05)] focus:border-accent focus:outline-none"
              >
                <option value="score">Sort by: Match Score</option>
                <option value="newest">Sort by: Newest</option>
                <option value="oldest">Sort by: Oldest</option>
              </select>
            </div>
          </section>
        )}

        <section className="mt-8">
          {displayedJobs.length > 0 ? (
            <>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-text-dark">Your Matches</h2>
                <span className="text-sm font-medium text-text-secondary">{sortedJobs.length} jobs found</span>
              </div>
              <div className="space-y-4">
                {displayedJobs.map((job) => (
                  <Link key={job.id} href={`/find-jobs/${job.id}`} className="block group relative overflow-hidden rounded-[24px] border border-border bg-surface p-6 shadow-sm transition hover:shadow-md">
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-background">
                          <CompanyIcon className="text-text-secondary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-text-dark group-hover:text-accent transition-colors">{job.role}</h3>
                          <p className="mt-1 text-sm font-medium text-text-secondary">{job.company}</p>
                          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-medium text-text-muted">
                            {job.salary && (
                              <div className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-border" />
                                <span>{job.salary}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-border" />
                              <span>{formatDate(job.dateFound)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Match</span>
                          <div className={`flex h-8 items-center justify-center rounded-full px-3 text-sm font-bold text-white ${matchColorClass[job.scoreColor]}`}>
                            {job.score}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
                  <span className="text-sm font-medium text-text-secondary">
                    Showing {startIndex + 1} to {Math.min(startIndex + JOBS_PER_PAGE, sortedJobs.length)} of {sortedJobs.length} results
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={safeCurrentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="rounded-[10px] border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-secondary disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      disabled={safeCurrentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className="rounded-[10px] border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-secondary disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-48 items-center justify-center">
              <div className="text-center">
                <p className="text-text-secondary">
                  {loading ? "Searching for jobs..." : "No jobs found for the selected filters."}
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function LocationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}

function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.7L12 18l-1.8-5.5-5.5-1.7L10.2 9Z" />
      <path d="M19.5 14.5 20 16l1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5Z" />
      <path d="M5 4.5 5.5 6l1.5.5-1.5.5-.5 1.5-.5-1.5L3 6.5 4.5 6Z" />
    </svg>
  );
}

function CompanyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...props}>
      <path d="M4 20V9.5L12 4l8 5.5V20" />
      <path d="M8 20v-5h8v5" />
      <path d="M10 9h4" />
      <path d="M10 12h4" />
    </svg>
  );
}
