"use client";

import Image from "next/image";
import Link from "next/link";
import { trackEvent } from "@/lib/posthog";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Find Jobs", href: "/find-jobs" },
  { label: "Profile", href: "/profile" },
];

const companyRows = [
  { company: "Vercel", score: "94%", salary: "$180k - $200k", source: "LinkedIn" },
  { company: "Stripe", score: "88%", salary: "$190k - $240k", source: "URL" },
  { company: "Linear", score: "96%", salary: "$150k - $190k", source: "LinkedIn" },
  { company: "Notion", score: "72%", salary: "$120k - $170k", source: "LinkedIn" },
  { company: "OpenAI", score: "91%", salary: "$220k - $280k", source: "LinkedIn" },
];

export default function Home() {
  const handleCtaClick = (eventName: string, location: string) => {
    trackEvent(eventName, { location, page: "home" });
  };

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="mx-auto max-w-[1440px] px-8 py-8">
        <header className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="JobPilot" width={40} height={40} className="rounded-2xl" />
            <span className="text-lg font-semibold">JobPilot</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="text-sm font-medium text-text-secondary transition-colors hover:text-text-dark">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-text-secondary transition-colors hover:text-text-dark">
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-[12px] bg-text-primary px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-accent-dark"
            >
              Start for free
            </Link>
          </div>
        </header>

        <main className="space-y-20">
          <section className="relative overflow-hidden rounded-[32px] border border-border bg-surface px-8 py-16 text-center shadow-[0_20px_80px_rgba(124,92,252,0.08)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,92,252,0.18),_transparent_35%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(97,168,255,0.18),_transparent_28%)]" />
            <div className="relative mx-auto max-w-3xl space-y-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Job hunting is hard. Your tools shouldn’t be.</p>
              <h1 className="text-[3rem] font-semibold leading-[1.02] text-text-dark md:text-[4rem]">
                Job hunting is hard.
                <br />
                Your tools shouldn’t be.
              </h1>
              <p className="mx-auto max-w-2xl text-base font-medium text-text-secondary md:text-lg">
                Stop applying blind. JobPilot finds the jobs, researches the companies, and gives you everything you need to stand out.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-[12px] bg-text-primary px-8 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-accent-dark"
                >
                  Get Started
                </Link>
                <Link
                  href="/find-jobs"
                  className="inline-flex items-center justify-center rounded-[12px] border border-border bg-surface px-8 py-3 text-sm font-medium text-text-primary transition hover:border-text-primary"
                >
                  Find Your First Match
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-border bg-surface p-8 shadow-[0_20px_80px_rgba(0,0,0,0.05)]">
            <div className="mx-auto max-w-[1180px] rounded-[28px] bg-surface p-6 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
              <div className="mb-6 flex items-center justify-between rounded-[20px] border border-border bg-background px-4 py-3 text-sm text-text-secondary">
                <span className="font-medium text-text-secondary">jobpilot.ai/dashboard</span>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span>Dashboard</span>
                  <span>Find Jobs</span>
                  <span>Profile</span>
                </div>
              </div>

              <Image
                src="/images/dashboard-demo.png"
                alt="Dashboard preview"
                width={1340}
                height={780}
                className="w-full rounded-[24px] border border-border bg-surface"
              />
            </div>
          </section>

          <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8 rounded-[28px] border border-border bg-surface p-10 shadow-sm">
              <div className="max-w-xl space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Manage Your Job Search With Ease</p>
                <h2 className="text-3xl font-semibold text-text-dark">Manage Your Job Search With Ease</h2>
              </div>
              <div className="space-y-6">
                <div className="rounded-[20px] border border-border bg-background p-6">
                  <p className="text-sm font-semibold text-text-dark">Find jobs that actually fit</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Search by title and location or paste a job link. Get matched roles you can quickly scan.
                  </p>
                </div>
                <div className="rounded-[20px] border border-border bg-background p-6">
                  <p className="text-sm font-semibold text-text-dark">Know the Company Before You Apply</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Stop guessing what a company is about. JobPilot browses their site and gives you everything you need to apply with confidence.
                  </p>
                </div>
                <div className="rounded-[20px] border border-border bg-background p-6">
                  <p className="text-sm font-semibold text-text-dark">Keep track of every application</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Keep a clear view of every job you’ve found, tailored. Your activity and progress all stay in one simple place.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-border bg-background p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between px-3 text-sm text-text-secondary">
                <span className="font-medium">Company</span>
                <span className="font-medium">Match Score</span>
              </div>
              <div className="space-y-4">
                {companyRows.map((row) => (
                  <div key={row.company} className="rounded-[18px] border border-border bg-surface p-4">
                    <div className="flex items-center justify-between gap-4 text-sm font-medium text-text-dark">
                      <span>{row.company}</span>
                      <span>{row.salary}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="min-w-[100px] text-sm font-medium text-text-secondary">{row.score}</div>
                      <div className="flex-1 rounded-full bg-border p-[3px]">
                        <div className="h-2 rounded-full bg-success" style={{ width: row.score }} />
                      </div>
                      <span className="rounded-full bg-surface-secondary px-3 py-1 text-xs font-semibold text-text-secondary">
                        {row.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[28px] border border-border bg-background p-6 shadow-sm">
              <div className="rounded-[24px] border border-border bg-surface p-6 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-text-secondary">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  agent_log.ts
                </div>
                <pre className="overflow-x-auto text-sm leading-7 text-text-secondary">
                  <code>1 [SYSTEM] Initializing JobPilot Agent...
2 [SCAN] Found 14 matching roles
3. Filtered out 3 roles (below salary cap)
4 [ACTION] Tailoring resume for Stripe (Frontend)
5 ... Generating cover letter</code>
                </pre>
              </div>
            </div>

            <div className="space-y-6 rounded-[28px] border border-border bg-surface p-10 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Apply With More Confidence, Every Time</p>
              <h2 className="text-3xl font-semibold text-text-dark">Apply With More Confidence, Every Time</h2>
              <div className="space-y-5 text-sm text-text-secondary">
                <div>
                  <p className="font-semibold text-text-dark">Understand your match score</p>
                  <p className="mt-2">
                    See how your profile lines up with each role before you apply. Get a clear breakdown of what fits and what’s missing.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-text-dark">AI-Powered Job Matching</p>
                  <p className="mt-2">
                    Stop guessing which jobs are worth applying to. JobPilot scores every role against your actual skills so you focus on the ones that matter.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-text-dark">Focus on the right roles</p>
                  <p className="mt-2">
                    Filter out low fit jobs and stay on the ones that actually matter. Spend less time sorting and more time applying.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-border bg-surface p-10 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Success Stories</p>
            <blockquote className="mx-auto mt-6 max-w-3xl text-xl font-medium leading-9 text-text-dark">
              “I used to spend my evenings copy-pasting resumes. Now I open my dashboard to see interviews waiting. It feels like cheating. Had 3 offers on the table simultaneously.”
            </blockquote>
            <div className="mt-8 flex flex-col items-center gap-3 text-sm text-text-secondary sm:flex-row sm:justify-center">
              <Image src="/images/user-icon.png" alt="Tom Wilson" width={40} height={40} className="rounded-full" />
              <div>
                <p className="font-semibold text-text-dark">Tom Wilson</p>
                <p>Junior Developer</p>
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[32px] border border-border bg-surface px-8 py-16 text-center shadow-[0_20px_80px_rgba(124,92,252,0.08)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(124,92,252,0.12),_transparent_28%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(97,168,255,0.12),_transparent_28%)]" />
            <div className="relative mx-auto max-w-3xl space-y-6">
              <h2 className="text-4xl font-semibold tracking-tight text-text-dark md:text-5xl">
                Your next job search can feel a lot less overwhelming
              </h2>
              <p className="mx-auto max-w-2xl text-base font-medium text-text-secondary md:text-lg">
                Set up your profile, upload your resume, and start finding matches in minutes.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-[12px] bg-text-primary px-8 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-accent-dark"
                >
                  Get Started
                </Link>
                <Link
                  href="/find-jobs"
                  className="inline-flex items-center justify-center rounded-[12px] border border-border bg-surface px-8 py-3 text-sm font-medium text-text-primary transition hover:border-text-primary"
                >
                  Find Your First Match
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-12 border-t border-border pt-6 text-sm text-text-secondary">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="JobPilot" width={32} height={32} className="rounded-2xl" />
              <span className="font-medium">JobPilot</span>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Link href="/dashboard" className="transition hover:text-text-dark">
                Dashboard
              </Link>
              <Link href="/privacy" className="transition hover:text-text-dark">
                Privacy Policy
              </Link>
              <Link href="/terms" className="transition hover:text-text-dark">
                Terms & Condition
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
