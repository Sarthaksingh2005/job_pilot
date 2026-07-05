"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { saveProfile, type ProfileActionState } from "@/actions/profile";
import { authConfigured, insforge } from "@/lib/insforge-client";
import {
  arrayToInputValue,
  calculateProfileCompletion,
  normalizeProfile,
  type ProfileRecord,
  type WorkExperience,
} from "@/lib/profile";

type ProfileFormProps = {
  initialProfile: ProfileRecord;
  initialState: ProfileActionState;
};

type TextFieldProps = {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
};

type ExtractProfileResponse = {
  success: boolean;
  data?: ProfileRecord;
  error?: string;
};

const experienceLevels = ["", "Junior", "Mid", "Senior", "Lead"];
const workAuthorizations = ["", "Citizen", "Permanent Resident", "Work Permit", "Visa Required"];
const remotePreferences = ["", "Any", "Remote", "Hybrid", "On-site"];
const coverLetterTones = ["", "Formal", "Casual", "Enthusiastic"];
const degrees = ["", "High School", "Associate", "Bachelor's", "Master's", "Doctorate", "Bootcamp", "Other"];

export function ProfileForm({ initialProfile, initialState }: ProfileFormProps) {
  const [actionState, formAction, pending] = useActionState(saveProfile, initialState);
  const [profile, setProfile] = useState<ProfileRecord>(initialProfile);
  const [resumeName, setResumeName] = useState<string>("");
  const [selectedResumeFile, setSelectedResumeFile] = useState<File | null>(null);
  const [selectedResumeUrl, setSelectedResumeUrl] = useState<string>("");
  const [extracting, setExtracting] = useState<boolean>(false);
  const [extractionMessage, setExtractionMessage] = useState<string>("");
  const [extractionSuccess, setExtractionSuccess] = useState<boolean>(false);
  const selectedResumeUrlRef = useRef<string>("");
  const savedResumeUrl = actionState.profile?.resume_pdf_url ?? profile.resume_pdf_url;
  const resumeViewUrl = selectedResumeUrl || savedResumeUrl;
  const completion = calculateProfileCompletion({ ...profile, resume_pdf_url: resumeViewUrl });
  const missingFields = completion.missingFields;
  const percent = completion.percent;
  const isProfileComplete = percent === 100;

  useEffect(() => {
    return () => {
      if (selectedResumeUrlRef.current) {
        URL.revokeObjectURL(selectedResumeUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function loadBrowserProfile(): Promise<void> {
      if (!authConfigured || !insforge) {
        return;
      }

      const { data } = await insforge.auth.getCurrentUser();
      const user = data?.user;
      if (!user?.id) {
        return;
      }

      const { data: profileData } = await insforge.database
        .from("profiles")
        .select(
          "id, full_name, email, phone, location, current_title, experience_level, years_experience, skills, industries, work_experience, education, job_titles_seeking, remote_preference, preferred_locations, salary_expectation, cover_letter_tone, linkedin_url, portfolio_url, work_authorization, resume_pdf_url, is_complete",
        )
        .eq("id", user.id)
        .maybeSingle();

      setProfile((currentProfile) =>
        normalizeProfile({
          ...currentProfile,
          ...(profileData ? (profileData as Partial<ProfileRecord>) : {}),
          id: user.id,
          email: currentProfile.email || getUserEmail(user) || "",
        }),
      );
    }

    void loadBrowserProfile();
  }, []);

  function updateField<K extends keyof ProfileRecord>(key: K, value: ProfileRecord[K]): void {
    setProfile((currentProfile) => ({ ...currentProfile, [key]: value }));
  }

  function updateEducation(key: keyof ProfileRecord["education"], value: string): void {
    setProfile((currentProfile) => ({
      ...currentProfile,
      education: { ...currentProfile.education, [key]: value },
    }));
  }

  function updateWorkExperience(index: number, patch: Partial<WorkExperience>): void {
    setProfile((currentProfile) => ({
      ...currentProfile,
      work_experience: currentProfile.work_experience.map((role, roleIndex) =>
        roleIndex === index ? { ...role, ...patch } : role,
      ),
    }));
  }

  function handleResumeChange(file: File | undefined): void {
    if (!file) {
      setResumeName("");
      setSelectedResumeFile(null);
      if (selectedResumeUrlRef.current) {
        URL.revokeObjectURL(selectedResumeUrlRef.current);
        selectedResumeUrlRef.current = "";
      }
      setSelectedResumeUrl("");
      return;
    }

    setResumeName(file.name);
    setSelectedResumeFile(file);
    setExtractionMessage("");
    setExtractionSuccess(false);
    if (selectedResumeUrlRef.current) {
      URL.revokeObjectURL(selectedResumeUrlRef.current);
    }

    const nextResumeUrl = URL.createObjectURL(file);
    selectedResumeUrlRef.current = nextResumeUrl;
    setSelectedResumeUrl(nextResumeUrl);
  }

  async function handleExtractProfile(): Promise<void> {
    if (!resumeViewUrl) {
      setExtractionSuccess(false);
      setExtractionMessage("Upload a PDF resume before extracting your profile.");
      return;
    }

    setExtracting(true);
    setExtractionMessage("");
    setExtractionSuccess(false);

    try {
      const formData = new FormData();
      formData.set("profile", JSON.stringify(profile));

      if (selectedResumeFile) {
        formData.set("resume", selectedResumeFile);
      }

      const response = await fetch("/api/resume/extract", {
        method: "POST",
        body: formData,
      });
      const payload: unknown = await response.json();

      if (!isExtractResponse(payload) || !payload.success || !payload.data) {
        setExtractionMessage(getExtractError(payload));
        return;
      }

      setProfile(normalizeProfile({ ...payload.data, resume_pdf_url: resumeViewUrl }));
      setExtractionSuccess(true);
      setExtractionMessage("Profile fields populated from your resume. Review them before saving.");
    } catch (error) {
      console.error("[ProfileForm] Resume extraction failed", error);
      setExtractionMessage("Could not extract profile data from this resume.");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16 text-text-primary">
      <AppHeader />
      <div className="mx-auto max-w-5xl px-6 pt-10 sm:px-8">
        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-text-dark">
                {isProfileComplete ? "Profile complete" : "Profile needs attention"}
              </h1>
              <p className="mt-2 text-sm text-text-secondary">
                {isProfileComplete
                  ? "Your profile is ready for job matching, resume generation, and company research."
                  : "Complete the missing fields to improve job matching, resume generation, and company research."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {missingFields.length > 0 ? (
                  missingFields.slice(0, 8).map((field) => (
                    <span key={field} className="rounded-full bg-accent-muted px-3 py-1 text-xs font-medium text-accent">
                      {field}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-success-lightest px-3 py-1 text-xs font-medium text-success">
                    COMPLETE
                  </span>
                )}
              </div>
            </div>
            <div className="w-28 rounded-lg bg-surface p-3">
              <ProgressBadge percent={percent} />
            </div>
          </div>
        </div>

        <form action={formAction} className="mt-6 space-y-6">
          <input type="hidden" name="user_id" value={profile.id} />
          <input type="hidden" name="user_email" value={profile.email} />
          <input type="hidden" name="existing_resume_pdf_url" value={savedResumeUrl} />

          <section className="rounded-lg border border-border bg-surface p-6">
            <h2 className="text-lg font-medium text-text-dark">Resume</h2>
            <p className="mt-1 text-sm text-text-secondary">Upload your current resume as a PDF.</p>
            <input
              id="resume"
              name="resume"
              type="file"
              accept="application/pdf"
              onChange={(event) => handleResumeChange(event.target.files?.[0])}
              className="hidden"
            />

            {resumeViewUrl ? (
              <div className="mt-4 rounded-md border border-border bg-surface-secondary p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-dark">{resumeName || "Resume uploaded"}</p>
                    <p className="mt-1 text-xs text-text-secondary">PDF saved for this profile.</p>
                  </div>
                  <a
                    href={resumeViewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-dark hover:bg-background"
                  >
                    View PDF
                  </a>
                </div>
              </div>
            ) : (
              <label htmlFor="resume" className="mt-4 block cursor-pointer rounded-md border-2 border-dashed border-border p-8 text-center">
                <div className="mx-auto max-w-md">
                  <div className="text-sm text-text-secondary">
                    Click to upload or drag and drop
                    <br />
                    PDF only. Maximum file size 5 MB.
                  </div>
                  <div className="mt-4 flex justify-center">
                    <span className="inline-flex cursor-pointer items-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-secondary">
                      Select Resume
                    </span>
                  </div>
                </div>
              </label>
            )}
            {!resumeViewUrl ? null : (
              <label htmlFor="resume" className="mt-3 inline-flex cursor-pointer text-sm font-medium text-accent hover:text-accent-dark">
                Replace resume
              </label>
            )}
            {resumeViewUrl ? (
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  disabled={extracting}
                  onClick={handleExtractProfile}
                  className="inline-flex w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-dark hover:bg-background disabled:opacity-50 sm:w-auto"
                >
                  {extracting ? "Extracting..." : "Extract from Resume"}
                </button>
                {extractionMessage ? (
                  <p className={`text-sm ${extractionSuccess ? "text-success" : "text-error"}`}>{extractionMessage}</p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-border bg-surface p-6">
            <h2 className="text-lg font-medium text-text-dark">Profile Information</h2>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField label="Full name" name="full_name" value={profile.full_name} placeholder="Faizan Ali" onChange={(value) => updateField("full_name", value)} />
              <TextField label="Email" name="email" value={profile.email} placeholder="faizan@example.com" type="email" onChange={(value) => updateField("email", value)} />
              <TextField label="Phone number" name="phone" value={profile.phone} placeholder="+1 (555) 000-0000" onChange={(value) => updateField("phone", value)} />
              <TextField label="Location" name="location" value={profile.location} placeholder="City, Country" onChange={(value) => updateField("location", value)} />
              <TextField label="LinkedIn URL" name="linkedin_url" value={profile.linkedin_url} placeholder="https://linkedin.com/in/faizan" onChange={(value) => updateField("linkedin_url", value)} />
              <TextField label="Portfolio / GitHub" name="portfolio_url" value={profile.portfolio_url} placeholder="https://github.com/faizan" onChange={(value) => updateField("portfolio_url", value)} />
              <SelectField label="Work authorization" name="work_authorization" value={profile.work_authorization} options={workAuthorizations} onChange={(value) => updateField("work_authorization", value)} />
            </div>

            <hr className="my-6 border-border" />

            <h3 className="text-sm font-medium text-text-dark">Professional Info</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <TextField label="Current/recent job title" name="current_title" value={profile.current_title} placeholder="Frontend Engineer" onChange={(value) => updateField("current_title", value)} />
              </div>
              <TextField label="Years of experience" name="years_experience" value={profile.years_experience?.toString() ?? ""} placeholder="4" type="number" onChange={(value) => updateField("years_experience", value ? Number.parseInt(value, 10) : null)} />
              <SelectField label="Experience level" name="experience_level" value={profile.experience_level} options={experienceLevels} onChange={(value) => updateField("experience_level", value)} />
              <div className="md:col-span-2">
                <TextField label="Skills" name="skills" value={arrayToInputValue(profile.skills)} placeholder="React, TypeScript, Next.js" onChange={(value) => updateField("skills", splitList(value))} />
              </div>
              <div className="md:col-span-3">
                <TextField label="Industries" name="industries" value={arrayToInputValue(profile.industries)} placeholder="SaaS, Fintech, Healthcare" onChange={(value) => updateField("industries", splitList(value))} />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-6">
            <h2 className="text-lg font-medium text-text-dark">Work Experience</h2>
            <div className="mt-4 space-y-6">
              {profile.work_experience.map((role, index) => (
                <div key={index} className="border-t border-border pt-5 first:border-t-0 first:pt-0">
                  <h3 className="text-sm font-medium text-text-dark">Role {index + 1}</h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <TextField label="Company name" name={`work_${index}_company`} value={role.company} placeholder="Verco" onChange={(value) => updateWorkExperience(index, { company: value })} />
                    <TextField label="Job title" name={`work_${index}_title`} value={role.title} placeholder="Frontend Engineer" onChange={(value) => updateWorkExperience(index, { title: value })} />
                    <TextField label="Start date" name={`work_${index}_start`} value={role.startDate} placeholder="January 2022" onChange={(value) => updateWorkExperience(index, { startDate: value })} />
                    <div>
                      <TextField label="End date" name={`work_${index}_end`} value={role.endDate} placeholder="Present" onChange={(value) => updateWorkExperience(index, { endDate: value })} />
                      <label className="mt-2 inline-flex items-center text-xs text-text-secondary">
                        <input
                          name={`work_${index}_current`}
                          type="checkbox"
                          checked={role.current}
                          onChange={(event) => updateWorkExperience(index, { current: event.target.checked })}
                          className="mr-2"
                        />
                        Currently working here
                      </label>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-text-muted">Key responsibilities</label>
                      <textarea
                        name={`work_${index}_responsibilities`}
                        value={role.responsibilities}
                        onChange={(event) => updateWorkExperience(index, { responsibilities: event.target.value })}
                        className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-sm"
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-6">
            <h2 className="text-lg font-medium text-text-dark">Education</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField label="Highest degree" name="education_degree" value={profile.education.degree} options={degrees} onChange={(value) => updateEducation("degree", value)} />
              <TextField label="Field of study" name="education_field" value={profile.education.field} placeholder="Computer Science" onChange={(value) => updateEducation("field", value)} />
              <TextField label="Institution name" name="education_institution" value={profile.education.institution} placeholder="State University" onChange={(value) => updateEducation("institution", value)} />
              <TextField label="Graduation year" name="education_year" value={profile.education.graduationYear} placeholder="2024" onChange={(value) => updateEducation("graduationYear", value)} />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-6">
            <h2 className="text-lg font-medium text-text-dark">Job Preferences</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <TextField label="Job titles seeking" name="job_titles_seeking" value={arrayToInputValue(profile.job_titles_seeking)} placeholder="Frontend Engineer, React Developer" onChange={(value) => updateField("job_titles_seeking", splitList(value))} />
              </div>
              <SelectField label="Remote preference" name="remote_preference" value={profile.remote_preference} options={remotePreferences} onChange={(value) => updateField("remote_preference", value)} />
              <TextField label="Salary expectation" name="salary_expectation" value={profile.salary_expectation} placeholder="$120k+" onChange={(value) => updateField("salary_expectation", value)} />
              <div className="md:col-span-2">
                <TextField label="Preferred locations" name="preferred_locations" value={arrayToInputValue(profile.preferred_locations)} placeholder="New York, London, Remote" onChange={(value) => updateField("preferred_locations", splitList(value))} />
              </div>
              <SelectField label="Cover letter tone" name="cover_letter_tone" value={profile.cover_letter_tone} options={coverLetterTones} onChange={(value) => updateField("cover_letter_tone", value)} />
            </div>
          </section>

          <div className="flex flex-col items-center">
            <button
              disabled={pending}
              type="submit"
              className="mx-auto mb-3 mt-4 w-full max-w-2xl rounded-md bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-dark disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save Profile"}
            </button>
            {actionState.message ? (
              <div className={`text-sm ${actionState.success ? "text-success" : "text-error"}`}>{actionState.message}</div>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

function ProgressBadge({ percent }: { percent: number }) {
  const stroke = 10;
  const radius = 40 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex items-center justify-center">
      <svg width={80} height={80} viewBox="0 0 80 80">
        <g transform="rotate(-90 40 40)">
          <circle className="stroke-border" cx="40" cy="40" r={radius} strokeWidth={stroke} fill="transparent" />
          <circle
            className="stroke-accent"
            cx="40"
            cy="40"
            r={radius}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            fill="transparent"
          />
        </g>
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-text-dark text-sm font-semibold">
          {percent}%
        </text>
      </svg>
    </div>
  );
}

function TextField({ label, name, value, placeholder, type = "text", onChange }: TextFieldProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-muted">{label}</label>
      <input
        name={name}
        value={value}
        placeholder={placeholder}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-sm"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-muted">{label}</label>
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option || "Select"}
          </option>
        ))}
      </select>
    </div>
  );
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getUserEmail(user: unknown): string | null {
  if (!user || typeof user !== "object" || !("email" in user)) {
    return null;
  }

  const email = user.email;
  return typeof email === "string" ? email : null;
}

function isExtractResponse(value: unknown): value is ExtractProfileResponse {
  if (!value || typeof value !== "object" || !("success" in value)) {
    return false;
  }

  return typeof value.success === "boolean";
}

function getExtractError(value: unknown): string {
  if (isExtractResponse(value) && typeof value.error === "string" && value.error) {
    return value.error;
  }

  return "Could not extract profile data from this resume.";
}
