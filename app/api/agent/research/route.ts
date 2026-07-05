import { NextRequest, NextResponse } from "next/server";
import { insforgeServer, getCurrentServerUserId } from "@/lib/insforge-server";
import { researchCompany } from "@/agent/research";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobId = body.jobId;
    const submittedUserId = body.userId;

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId in request body" }, { status: 400 });
    }

    if (!insforgeServer) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Resolve user ID using cookies or fallback body userId
    const serverUserId = await getCurrentServerUserId();
    const userId = serverUserId || submittedUserId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the job using the Admin client to bypass RLS session issues
    console.log("[Research API] Searching for job in DB using admin client. jobId:", jobId, "userId:", userId);
    const { data: job, error: jobError } = await insforgeServer.database
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (jobError || !job) {
      console.error("[Research API] Job lookup failed. error:", jobError, "job:", job);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Fetch the profile
    const { data: profile, error: profileError } = await insforgeServer.database
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Run the research agent
    const dossier = await researchCompany(
      {
        title: job.title,
        company: job.company,
        description: job.about_role || "",
        matched_skills: job.company_research?.matched_skills || [],
        missing_skills: job.company_research?.missing_skills || [],
        source_url: job.source_url,
        external_apply_url: job.external_apply_url,
      },
      {
        current_title: profile.current_title,
        years_experience: profile.years_experience,
        experience_level: profile.experience_level,
        skills: profile.skills || [],
        work_experience: profile.work_experience,
      }
    );

    // Save the dossier to the job
    const updatedResearch = {
      ...job.company_research,
      ...dossier,
    };

    const { error: updateError } = await insforgeServer.database
      .from("jobs")
      .update({ company_research: updatedResearch })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("[Research API] Failed to update job research:", updateError);
      return NextResponse.json({ error: `Failed to save research results: ${updateError.message || JSON.stringify(updateError)}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, dossier: updatedResearch });
  } catch (error: any) {
    console.error("[Research API] Unexpected error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
