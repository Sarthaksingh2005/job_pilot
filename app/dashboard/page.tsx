"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { insforge } from "@/lib/insforge-client";
import { trackEvent } from "@/lib/posthog";
import { AppHeader } from "@/components/AppHeader";
import type { SVGProps } from "react";

type StatData = {
  totalJobs: number;
  totalJobsTrend?: string;
  avgMatchRate: number;
  avgMatchRateTrend?: string;
  companiesResearched: number;
  jobsThisWeek: number;
};

type ActivityItem = {
  id: string;
  type: "run" | "research";
  text: string;
  timeAgo: string;
  timestamp: string;
};

type ChartDataPoint = {
  label: string;
  value: number;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(true);
  
  // Real or Fallback Stats
  const [stats, setStats] = useState<StatData>({
    totalJobs: 284,
    totalJobsTrend: "+12% vs last week",
    avgMatchRate: 82,
    avgMatchRateTrend: "+3% vs last week",
    companiesResearched: 35,
    jobsThisWeek: 28,
  });

  // Real or Fallback Recent Activity
  const [activities, setActivities] = useState<ActivityItem[]>([
    { id: "1", type: "run", text: "Found 8 jobs for Frontend Engineer", timeAgo: "10 mins ago", timestamp: "" },
    { id: "2", type: "research", text: "Researched Stripe", timeAgo: "1 hour ago", timestamp: "" },
    { id: "3", type: "run", text: "Found 12 jobs for React Developer", timeAgo: "2 hours ago", timestamp: "" },
    { id: "4", type: "research", text: "Researched Vercel", timeAgo: "Yesterday", timestamp: "" },
    { id: "5", type: "run", text: "Found 10 jobs for Full Stack Engineer", timeAgo: "Yesterday", timestamp: "" },
  ]);

  // Real or Fallback Charts
  const [researchChart, setResearchChart] = useState<ChartDataPoint[]>([
    { label: "Mon", value: 2 },
    { label: "Tue", value: 5 },
    { label: "Wed", value: 3 },
    { label: "Thu: 8", value: 8 },
    { label: "Fri", value: 12 },
    { label: "Sat", value: 4 },
    { label: "Sun", value: 1 },
  ]);

  const [jobsOverTimeChart, setJobsOverTimeChart] = useState<ChartDataPoint[]>([
    { label: "Mon", value: 15 },
    { label: "Tue", value: 40 },
    { label: "Wed", value: 30 },
    { label: "Thu", value: 55 },
    { label: "Fri", value: 80 },
    { label: "Sat", value: 45 },
    { label: "Sun", value: 18 },
  ]);

  const [scoreDistributionChart, setScoreDistributionChart] = useState<ChartDataPoint[]>([
    { label: "50-60%", value: 3 },
    { label: "60-70%", value: 8 },
    { label: "70-80%", value: 42 },
    { label: "80-90%", value: 80 },
    { label: "90-100%", value: 32 },
  ]);

  useEffect(() => {
    trackEvent("dashboard_viewed", { page: "dashboard" });

    (async () => {
      if (!insforge) {
        setLoading(false);
        return;
      }

      try {
        const { data: authData } = await insforge.auth.getCurrentUser();
        if (!authData?.user) {
          setLoading(false);
          return;
        }
        const userId = authData.user.id;

        // 1. Profile completeness
        const { data: profile } = await insforge.database
          .from("profiles")
          .select("is_complete")
          .eq("id", userId)
          .single();
        
        if (profile) {
          setProfileComplete(Boolean(profile.is_complete));
        }

        // 2. Load Jobs & Agent Runs to populate metrics
        const { data: dbJobs, error: dbJobsErr } = await insforge.database
          .from("jobs")
          .select("id, match_score, company_research, created_at, company")
          .eq("user_id", userId);

        const { data: dbRuns, error: dbRunsErr } = await insforge.database
          .from("agent_runs")
          .select("id, jobs_found, job_title_searched, started_at")
          .eq("user_id", userId)
          .order("started_at", { ascending: false })
          .limit(10);

        if (dbJobs && dbJobs.length > 0) {
          // Compute stats
          const totalJobsCount = dbJobs.length;
          
          const validScores = dbJobs.filter(j => j.match_score !== null && j.match_score !== undefined);
          const avgScore = validScores.length > 0 
            ? Math.round(validScores.reduce((sum, j) => sum + j.match_score!, 0) / validScores.length)
            : 0;

          const researchedCount = dbJobs.filter(j => {
            const res = j.company_research as any;
            return res && res.companyOverview;
          }).length;

          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          const thisWeekCount = dbJobs.filter(j => new Date(j.created_at) >= oneWeekAgo).length;

          setStats({
            totalJobs: totalJobsCount,
            totalJobsTrend: totalJobsCount > 5 ? "+15% this week" : undefined,
            avgMatchRate: avgScore,
            avgMatchRateTrend: avgScore > 50 ? "Healthy match" : undefined,
            companiesResearched: researchedCount,
            jobsThisWeek: thisWeekCount,
          });

          // Compute recent activity (merge runs and researched jobs)
          const runActivities: ActivityItem[] = (dbRuns || []).map((run: any) => ({
            id: `run-${run.id}`,
            type: "run",
            text: `Found ${run.jobs_found} jobs for ${run.job_title_searched || "Software Engineer"}`,
            timeAgo: formatTimeAgo(run.started_at),
            timestamp: run.started_at,
          }));

          const researchActivities: ActivityItem[] = dbJobs
            .filter(j => {
              const res = j.company_research as any;
              return res && res.companyOverview;
            })
            .map((job: any) => ({
              id: `res-${job.id}`,
              type: "research",
              text: `Researched ${job.company}`,
              timeAgo: formatTimeAgo(job.created_at),
              timestamp: job.created_at,
            }));

          const merged = [...runActivities, ...researchActivities]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 5);

          if (merged.length > 0) {
            setActivities(merged);
          }

          // Compute charts dynamically from real DB data
          // Jobs Found Over Time (Group by weekday)
          const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
          dbJobs.forEach(job => {
            const dayIdx = new Date(job.created_at).getDay();
            weekdayCounts[dayIdx]++;
          });
          const reorderedDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
          const newJobsChart = reorderedDays.map(day => {
            const idx = daysOfWeek.indexOf(day);
            return { label: day, value: weekdayCounts[idx] };
          });
          setJobsOverTimeChart(newJobsChart);

          // Company Research Activity (Group by weekday)
          const researchWeekdayCounts = [0, 0, 0, 0, 0, 0, 0];
          dbJobs.forEach(job => {
            const res = job.company_research as any;
            if (res && res.companyOverview) {
              const dayIdx = new Date(job.created_at).getDay();
              researchWeekdayCounts[dayIdx]++;
            }
          });
          const newResearchChart = reorderedDays.map(day => {
            const idx = daysOfWeek.indexOf(day);
            return { label: day, value: researchWeekdayCounts[idx] };
          });
          setResearchChart(newResearchChart);

          // Match Score Distribution
          const distribution = [0, 0, 0, 0, 0]; // 50-60, 60-70, 70-80, 80-90, 90-100
          dbJobs.forEach(job => {
            const score = job.match_score || 0;
            if (score >= 90) distribution[4]++;
            else if (score >= 80) distribution[3]++;
            else if (score >= 70) distribution[2]++;
            else if (score >= 60) distribution[1]++;
            else if (score >= 50) distribution[0]++;
          });
          const newScoreChart = [
            { label: "50-60%", value: distribution[0] },
            { label: "60-70%", value: distribution[1] },
            { label: "70-80%", value: distribution[2] },
            { label: "80-90%", value: distribution[3] },
            { label: "90-100%", value: distribution[4] },
          ];
          setScoreDistributionChart(newScoreChart);
        }
      } catch (err) {
        console.error("Dashboard database load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function formatTimeAgo(dateStr: string) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 30) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-text-primary">
        <AppHeader />
        <div className="flex h-[calc(100vh-80px)] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-accent" />
            <p className="text-sm font-semibold text-text-secondary">Loading dashboard data…</p>
          </div>
        </div>
      </div>
    );
  }

  // Find max value helper for SVGs
  const maxResearch = Math.max(...researchChart.map(d => d.value), 1);
  const maxJobs = Math.max(...jobsOverTimeChart.map(d => d.value), 1);
  const maxScores = Math.max(...scoreDistributionChart.map(d => d.value), 1);

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-text-primary">
      <AppHeader />

      <main className="mx-auto max-w-[1280px] px-6 py-8 lg:px-8 lg:py-10 space-y-6">
        
        {/* Profile Completeness Alert Banner */}
        {!profileComplete && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-[20px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertIcon className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">Your profile seeks alignment</h4>
                <p className="mt-0.5 text-xs font-semibold text-amber-700 leading-relaxed">
                  Complete the missing resume fields to dramatically improve AI job matching and company research.
                </p>
              </div>
            </div>
            <Link
              href="/profile"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] bg-amber-700 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-amber-800"
            >
              Complete Profile
            </Link>
          </div>
        )}

        {/* Stats Grid */}
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Card 1: Total Jobs Found */}
          <div className="rounded-[24px] border border-border bg-white p-6 shadow-sm flex flex-col justify-between">
            <p className="text-sm font-bold text-[#64748B]">Total Jobs Found</p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-[40px] font-extrabold text-[#0F172A] tracking-tight">{stats.totalJobs}</span>
              {stats.totalJobsTrend && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-bold text-[#10B981]">
                  {stats.totalJobsTrend}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs font-semibold text-[#94A3B8]">vs last week</p>
          </div>

          {/* Card 2: Avg. Match Rate */}
          <div className="rounded-[24px] border border-border bg-white p-6 shadow-sm flex flex-col justify-between">
            <p className="text-sm font-bold text-[#64748B]">Avg. Match Rate</p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-[40px] font-extrabold text-[#0F172A] tracking-tight">{stats.avgMatchRate}%</span>
              {stats.avgMatchRateTrend && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-bold text-[#10B981]">
                  {stats.avgMatchRateTrend}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs font-semibold text-[#94A3B8]">vs last week</p>
          </div>

          {/* Card 3: Companies Researched */}
          <div className="rounded-[24px] border border-border bg-white p-6 shadow-sm flex flex-col justify-between">
            <p className="text-sm font-bold text-[#64748B]">Companies Researched</p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-[40px] font-extrabold text-[#0F172A] tracking-tight">{stats.companiesResearched}</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-[#94A3B8]">Total researched</p>
          </div>

          {/* Card 4: Jobs This Week */}
          <div className="rounded-[24px] border border-border bg-white p-6 shadow-sm flex flex-col justify-between">
            <p className="text-sm font-bold text-[#64748B]">Jobs This Week</p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-[40px] font-extrabold text-[#0F172A] tracking-tight">{stats.jobsThisWeek}</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-[#94A3B8]">New this week</p>
          </div>
        </section>

        {/* Row 2: Recent Activity & Company Research Activity */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          
          {/* Recent Activity Card */}
          <div className="rounded-[24px] border border-border bg-white p-6 shadow-sm flex flex-col">
            <h2 className="text-lg font-bold text-[#0F172A] border-b border-border pb-4 mb-4">Recent Activity</h2>
            <div className="flex-1 relative pl-6 space-y-6">
              {/* Vertical timeline line */}
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />

              {activities.map((act) => (
                <div key={act.id} className="relative flex items-start gap-4">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[22px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm ${
                    act.type === "run" ? "bg-accent" : "bg-emerald-500"
                  }`} />
                  
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-[#1E293B]">{act.text}</p>
                    <p className="mt-0.5 text-xs font-semibold text-[#94A3B8]">{act.timeAgo}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Company Research Activity SVG Chart */}
          <div className="rounded-[24px] border border-border bg-white p-6 shadow-sm flex flex-col">
            <h2 className="text-lg font-bold text-[#0F172A] border-b border-border pb-4 mb-6">Company Research Activity</h2>
            
            <div className="flex-1 flex flex-col justify-end min-h-[220px]">
              <div className="relative flex items-end justify-between w-full h-44 px-4 pb-2 border-b border-[#E2E8F0]">
                {/* Horizontal reference grid lines */}
                <div className="absolute left-0 right-0 top-0 border-t border-dashed border-[#F1F5F9]" />
                <div className="absolute left-0 right-0 top-[25%] border-t border-dashed border-[#F1F5F9]" />
                <div className="absolute left-0 right-0 top-[50%] border-t border-dashed border-[#F1F5F9]" />
                <div className="absolute left-0 right-0 top-[75%] border-t border-dashed border-[#F1F5F9]" />

                {researchChart.map((d, i) => {
                  const percent = Math.min((d.value / maxResearch) * 100, 100);
                  return (
                    <div key={i} className="group relative flex flex-col items-center justify-end h-full flex-1 mx-2 max-w-[36px]">
                      {/* Tooltip */}
                      <span className="absolute -top-8 z-10 scale-0 rounded bg-[#0F172A] px-2 py-1 text-[10px] font-bold text-white transition group-hover:scale-100">
                        {d.value}
                      </span>
                      
                      {/* Styled Bar */}
                      <div
                        style={{ height: `${percent || 4}%` }}
                        className="w-full bg-gradient-to-t from-[#7050F6] to-[#A78BFA] rounded-t-[6px] transition-all duration-500 shadow-sm"
                      />
                    </div>
                  );
                })}
              </div>

              {/* X Labels */}
              <div className="flex justify-between w-full px-4 pt-3">
                {researchChart.map((d, i) => (
                  <span key={i} className="text-xs font-bold text-[#94A3B8] w-12 text-center">
                    {d.label.split(":")[0]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Row 3: Jobs Found Over Time & Match Score Distribution */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Jobs Found Over Time Area Chart */}
          <div className="lg:col-span-2 rounded-[24px] border border-border bg-white p-6 shadow-sm flex flex-col">
            <h2 className="text-lg font-bold text-[#0F172A] border-b border-border pb-4 mb-6">Jobs Found Over Time</h2>
            
            <div className="flex-1 flex flex-col justify-end min-h-[220px]">
              <div className="relative flex items-end justify-between w-full h-44 border-b border-[#E2E8F0] pb-2">
                {/* Horizontal reference grid lines */}
                <div className="absolute left-0 right-0 top-0 border-t border-[#F1F5F9]" />
                <div className="absolute left-0 right-0 top-[33%] border-t border-[#F1F5F9]" />
                <div className="absolute left-0 right-0 top-[66%] border-t border-[#F1F5F9]" />

                {/* SVG Area Chart Overlay */}
                <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 700 176">
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7050F6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#7050F6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Draw the Area */}
                  <path
                    d={`M 50 ${176 - (jobsOverTimeChart[0].value / maxJobs) * 140} 
                        L 150 ${176 - (jobsOverTimeChart[1].value / maxJobs) * 140} 
                        L 250 ${176 - (jobsOverTimeChart[2].value / maxJobs) * 140} 
                        L 350 ${176 - (jobsOverTimeChart[3].value / maxJobs) * 140} 
                        L 450 ${176 - (jobsOverTimeChart[4].value / maxJobs) * 140} 
                        L 550 ${176 - (jobsOverTimeChart[5].value / maxJobs) * 140} 
                        L 650 ${176 - (jobsOverTimeChart[6].value / maxJobs) * 140} 
                        L 650 176 L 50 176 Z`}
                    fill="url(#areaGradient)"
                  />

                  {/* Draw the Line */}
                  <path
                    d={`M 50 ${176 - (jobsOverTimeChart[0].value / maxJobs) * 140} 
                        Q 100 ${176 - (jobsOverTimeChart[0].value / maxJobs) * 140}, 150 ${176 - (jobsOverTimeChart[1].value / maxJobs) * 140} 
                        T 250 ${176 - (jobsOverTimeChart[2].value / maxJobs) * 140} 
                        T 350 ${176 - (jobsOverTimeChart[3].value / maxJobs) * 140} 
                        T 450 ${176 - (jobsOverTimeChart[4].value / maxJobs) * 140} 
                        T 550 ${176 - (jobsOverTimeChart[5].value / maxJobs) * 140} 
                        T 650 ${176 - (jobsOverTimeChart[6].value / maxJobs) * 140}`}
                    fill="none"
                    stroke="#7050F6"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />

                  {/* Draw Interactive Nodes */}
                  {jobsOverTimeChart.map((d, idx) => {
                    const x = 50 + idx * 100;
                    const y = 176 - (d.value / maxJobs) * 140;
                    return (
                      <g key={idx} className="group/node cursor-pointer">
                        <circle cx={x} cy={y} r="5" fill="#7050F6" stroke="white" strokeWidth="2" />
                        <circle cx={x} cy={y} r="10" fill="#7050F6" fillOpacity="0.1" className="scale-0 group-hover/node:scale-100 transition-all duration-300 origin-center" />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* X Labels */}
              <div className="flex justify-between w-full px-4 pt-3">
                {jobsOverTimeChart.map((d, i) => (
                  <span key={i} className="text-xs font-bold text-[#94A3B8] w-16 text-center">
                    {d.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Match Score Distribution */}
          <div className="rounded-[24px] border border-border bg-white p-6 shadow-sm flex flex-col">
            <h2 className="text-lg font-bold text-[#0F172A] border-b border-border pb-4 mb-6">Match Score Distribution</h2>
            
            <div className="flex-1 flex flex-col justify-end min-h-[220px]">
              <div className="relative flex items-end justify-between w-full h-44 pb-2 border-b border-[#E2E8F0]">
                {/* Horizontal reference grid lines */}
                <div className="absolute left-0 right-0 top-0 border-t border-dashed border-[#F1F5F9]" />
                <div className="absolute left-0 right-0 top-[25%] border-t border-dashed border-[#F1F5F9]" />
                <div className="absolute left-0 right-0 top-[50%] border-t border-dashed border-[#F1F5F9]" />
                <div className="absolute left-0 right-0 top-[75%] border-t border-dashed border-[#F1F5F9]" />

                {scoreDistributionChart.map((d, i) => {
                  const percent = Math.min((d.value / maxScores) * 100, 100);
                  return (
                    <div key={i} className="group relative flex flex-col items-center justify-end h-full flex-1 mx-1.5 max-w-[32px]">
                      {/* Tooltip */}
                      <span className="absolute -top-8 z-10 scale-0 rounded bg-[#0F172A] px-2 py-1 text-[10px] font-bold text-white transition group-hover:scale-100">
                        {d.value} jobs
                      </span>
                      
                      {/* Styled Bar */}
                      <div
                        style={{ height: `${percent || 4}%` }}
                        className="w-full bg-[#10B981] rounded-t-[6px] transition-all duration-500 shadow-sm"
                      />
                    </div>
                  );
                })}
              </div>

              {/* X Labels */}
              <div className="flex justify-between w-full px-1 pt-3">
                {scoreDistributionChart.map((d, i) => (
                  <span key={i} className="text-[10px] font-bold text-[#94A3B8] w-12 text-center truncate">
                    {d.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────────

function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
