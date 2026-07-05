"use server";

import { revalidatePath } from "next/cache";
import {
  calculateProfileCompletion,
  normalizeProfile,
  type Education,
  type ProfileRecord,
  type WorkExperience,
} from "@/lib/profile";
import { getCurrentServerUserId, insforgeServer, serverConfigured, uploadResumeToResumesBucket } from "@/lib/insforge-server";

export type ProfileActionState = {
  success: boolean;
  message: string;
  profile: ProfileRecord | null;
  percent: number;
  missingFields: string[];
};

type ProfilePayload = Omit<ProfileRecord, "is_complete"> & {
  is_complete: boolean;
  updated_at: string;
};

export async function getProfileForCurrentUser(): Promise<ProfileRecord | null> {
  const userId = await getCurrentServerUserId();

  if (!userId || !serverConfigured || !insforgeServer) {
    return null;
  }

  const { data, error } = await insforgeServer.database
    .from("profiles")
    .select(
      "id, full_name, email, phone, location, current_title, experience_level, years_experience, skills, industries, work_experience, education, job_titles_seeking, remote_preference, preferred_locations, salary_expectation, cover_letter_tone, linkedin_url, portfolio_url, work_authorization, resume_pdf_url, is_complete",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[actions/profile] Failed to load profile", error);
    }
    return null;
  }

  return normalizeProfile(data as Partial<ProfileRecord>);
}

export async function saveProfile(_previousState: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  try {
    if (!serverConfigured || !insforgeServer) {
      return failure("InsForge is not configured on the server.");
    }

    const serverUserId = await getCurrentServerUserId();
    const submittedUserId = readText(formData, "user_id");
    const userId = serverUserId ?? submittedUserId;

    if (!userId) {
      return failure("Sign in before saving your profile.");
    }

    const existingResumeUrl = readText(formData, "existing_resume_pdf_url");
    const resumeFile = formData.get("resume");
    let resumeUrl = existingResumeUrl;

    if (resumeFile instanceof File && resumeFile.size > 0) {
      const validationError = validateResume(resumeFile);
      if (validationError) {
        return failure(validationError);
      }

      const uploadedResume = await uploadResumeToResumesBucket(resumeFile, userId);
      resumeUrl = uploadedResume?.url ?? resumeUrl;
    }

    const yearsExperience = parseOptionalInteger(readText(formData, "years_experience"));
    const profile = normalizeProfile({
      id: userId,
      full_name: readText(formData, "full_name"),
      email: readText(formData, "email") || readText(formData, "user_email"),
      phone: readText(formData, "phone"),
      location: readText(formData, "location"),
      current_title: readText(formData, "current_title"),
      experience_level: readText(formData, "experience_level"),
      years_experience: yearsExperience,
      skills: readList(formData, "skills"),
      industries: readList(formData, "industries"),
      work_experience: readWorkExperience(formData),
      education: readEducation(formData),
      job_titles_seeking: readList(formData, "job_titles_seeking"),
      remote_preference: readText(formData, "remote_preference"),
      preferred_locations: readList(formData, "preferred_locations"),
      salary_expectation: readText(formData, "salary_expectation"),
      cover_letter_tone: readText(formData, "cover_letter_tone"),
      linkedin_url: readText(formData, "linkedin_url"),
      portfolio_url: readText(formData, "portfolio_url"),
      work_authorization: readText(formData, "work_authorization"),
      resume_pdf_url: resumeUrl,
    });

    const completion = calculateProfileCompletion(profile);
    const payload: ProfilePayload = {
      ...profile,
      is_complete: completion.isComplete,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await insforgeServer.database
      .from("profiles")
      .upsert(payload)
      .select(
        "id, full_name, email, phone, location, current_title, experience_level, years_experience, skills, industries, work_experience, education, job_titles_seeking, remote_preference, preferred_locations, salary_expectation, cover_letter_tone, linkedin_url, portfolio_url, work_authorization, resume_pdf_url, is_complete",
      )
      .single();

    if (error) {
      console.error("[actions/profile] Failed to save profile", error);
      return failure("Could not save your profile. Please try again.");
    }

    const savedProfile = normalizeProfile(data as Partial<ProfileRecord>);
    const savedCompletion = calculateProfileCompletion(savedProfile);

    revalidatePath("/profile");

    return {
      success: true,
      message: `Profile saved. ${savedCompletion.percent}% complete.`,
      profile: savedProfile,
      percent: savedCompletion.percent,
      missingFields: savedCompletion.missingFields,
    };
  } catch (error) {
    console.error("[actions/profile]", error);
    return failure("Could not save your profile. Please try again.");
  }
}

function failure(message: string): ProfileActionState {
  return {
    success: false,
    message,
    profile: null,
    percent: 0,
    missingFields: [],
  };
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readList(formData: FormData, key: string): string[] {
  return readText(formData, key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readEducation(formData: FormData): Education {
  return {
    degree: readText(formData, "education_degree"),
    field: readText(formData, "education_field"),
    institution: readText(formData, "education_institution"),
    graduationYear: readText(formData, "education_year"),
  };
}

function readWorkExperience(formData: FormData): WorkExperience[] {
  return [0, 1, 2]
    .map((index) => ({
      company: readText(formData, `work_${index}_company`),
      title: readText(formData, `work_${index}_title`),
      startDate: readText(formData, `work_${index}_start`),
      endDate: readText(formData, `work_${index}_end`),
      current: readText(formData, `work_${index}_current`) === "on",
      responsibilities: readText(formData, `work_${index}_responsibilities`),
    }))
    .filter((role) => Boolean(role.company || role.title || role.startDate || role.endDate || role.responsibilities));
}

function parseOptionalInteger(value: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function validateResume(file: File): string | null {
  if (file.type !== "application/pdf") {
    return "Only PDF resumes are accepted.";
  }

  if (file.size > 5 * 1024 * 1024) {
    return "Resume must be 5 MB or smaller.";
  }

  return null;
}
