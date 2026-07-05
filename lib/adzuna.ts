/**
 * Adzuna API integration for job searching
 * Always filters to IT jobs with category=it-jobs
 */

export type AdzunaJob = {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted: "0" | "1";
  contract_type?: string;
  created: string;
  category: { tag: string; label: string };
};

export async function searchAdzunaJobs(
  jobTitle: string,
  location: string,
  country: string = "us",
): Promise<AdzunaJob[]> {
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!,
    app_key: process.env.ADZUNA_APP_KEY!,
    what: jobTitle,
    results_per_page: "10",
    "content-type": "application/json",
  });

  // Only add where if location is provided
  if (location && location.trim()) {
    params.set("where", location);
  }

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results || [];
}

export function mapAdzunaToJobRecord(
  job: AdzunaJob,
  userId: string,
  runId: string,
  matchScore: number,
  matchReason: string,
  matchedSkills: string[],
  missingSkills: string[],
) {
  return {
    run_id: runId,
    user_id: userId,
    source: "search" as const,
    source_url: job.redirect_url,
    external_apply_url: job.redirect_url,
    title: job.title,
    company: job.company.display_name,
    location: job.location.display_name,
    salary:
      job.salary_min && job.salary_max
        ? `$${Math.round(job.salary_min / 1000)}k - $${Math.round(job.salary_max / 1000)}k`
        : null,
    job_type: job.contract_type || "fulltime",
    about_role: job.description,
    match_score: matchScore,
    match_reason: matchReason,
    company_research: {
      matched_skills: matchedSkills,
      missing_skills: missingSkills,
    },
  };
}
