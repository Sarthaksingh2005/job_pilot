export type WorkExperience = {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  current: boolean;
  responsibilities: string;
};

export type Education = {
  degree: string;
  field: string;
  institution: string;
  graduationYear: string;
};

export type ProfileRecord = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  current_title: string;
  experience_level: string;
  years_experience: number | null;
  skills: string[];
  industries: string[];
  work_experience: WorkExperience[];
  education: Education;
  job_titles_seeking: string[];
  remote_preference: string;
  preferred_locations: string[];
  salary_expectation: string;
  cover_letter_tone: string;
  linkedin_url: string;
  portfolio_url: string;
  work_authorization: string;
  resume_pdf_url: string;
  is_complete: boolean;
};

export type CompletionSummary = {
  percent: number;
  missingFields: string[];
  isComplete: boolean;
};

type RequiredProfileField = {
  label: string;
  isFilled: (profile: Partial<ProfileRecord>) => boolean;
};

const requiredFields: RequiredProfileField[] = [
  { label: "FULL NAME", isFilled: (profile) => hasText(profile.full_name) },
  { label: "EMAIL", isFilled: (profile) => hasText(profile.email) },
  { label: "PHONE", isFilled: (profile) => hasText(profile.phone) },
  { label: "LOCATION", isFilled: (profile) => hasText(profile.location) },
  { label: "CURRENT TITLE", isFilled: (profile) => hasText(profile.current_title) },
  { label: "EXPERIENCE LEVEL", isFilled: (profile) => hasText(profile.experience_level) },
  { label: "YEARS EXPERIENCE", isFilled: (profile) => typeof profile.years_experience === "number" && profile.years_experience >= 0 },
  { label: "SKILLS", isFilled: (profile) => hasItems(profile.skills) },
  { label: "INDUSTRIES", isFilled: (profile) => hasItems(profile.industries) },
  { label: "WORK EXPERIENCE", isFilled: (profile) => Boolean(profile.work_experience?.some((role) => hasText(role.company) && hasText(role.title))) },
  { label: "EDUCATION", isFilled: (profile) => Boolean(profile.education && hasText(profile.education.degree) && hasText(profile.education.institution)) },
  { label: "JOB TARGETS", isFilled: (profile) => hasItems(profile.job_titles_seeking) },
  { label: "REMOTE PREFERENCE", isFilled: (profile) => hasText(profile.remote_preference) },
  { label: "WORK AUTHORIZATION", isFilled: (profile) => hasText(profile.work_authorization) },
  { label: "RESUME", isFilled: (profile) => hasText(profile.resume_pdf_url) },
];

export const emptyEducation: Education = {
  degree: "",
  field: "",
  institution: "",
  graduationYear: "",
};

export const emptyWorkExperience: WorkExperience = {
  company: "",
  title: "",
  startDate: "",
  endDate: "",
  current: false,
  responsibilities: "",
};

export function emptyProfile(): ProfileRecord {
  return {
    id: "",
    full_name: "",
    email: "",
    phone: "",
    location: "",
    current_title: "",
    experience_level: "",
    years_experience: null,
    skills: [],
    industries: [],
    work_experience: [emptyWorkExperience, emptyWorkExperience, emptyWorkExperience],
    education: emptyEducation,
    job_titles_seeking: [],
    remote_preference: "",
    preferred_locations: [],
    salary_expectation: "",
    cover_letter_tone: "",
    linkedin_url: "",
    portfolio_url: "",
    work_authorization: "",
    resume_pdf_url: "",
    is_complete: false,
  };
}

export function normalizeProfile(input: Partial<ProfileRecord> | null | undefined): ProfileRecord {
  const base = emptyProfile();
  const workExperience = normalizeWorkExperience(input?.work_experience);
  const education = normalizeEducation(input?.education);

  return {
    ...base,
    ...input,
    id: input?.id ?? base.id,
    full_name: input?.full_name ?? base.full_name,
    email: input?.email ?? base.email,
    phone: input?.phone ?? base.phone,
    location: input?.location ?? base.location,
    current_title: input?.current_title ?? base.current_title,
    experience_level: input?.experience_level ?? base.experience_level,
    years_experience: typeof input?.years_experience === "number" ? input.years_experience : null,
    skills: Array.isArray(input?.skills) ? input.skills : base.skills,
    industries: Array.isArray(input?.industries) ? input.industries : base.industries,
    work_experience: workExperience,
    education,
    job_titles_seeking: Array.isArray(input?.job_titles_seeking) ? input.job_titles_seeking : base.job_titles_seeking,
    remote_preference: input?.remote_preference ?? base.remote_preference,
    preferred_locations: Array.isArray(input?.preferred_locations) ? input.preferred_locations : base.preferred_locations,
    salary_expectation: input?.salary_expectation ?? base.salary_expectation,
    cover_letter_tone: input?.cover_letter_tone ?? base.cover_letter_tone,
    linkedin_url: input?.linkedin_url ?? base.linkedin_url,
    portfolio_url: input?.portfolio_url ?? base.portfolio_url,
    work_authorization: input?.work_authorization ?? base.work_authorization,
    resume_pdf_url: input?.resume_pdf_url ?? base.resume_pdf_url,
    is_complete: Boolean(input?.is_complete),
  };
}

export function calculateProfileCompletion(profile: Partial<ProfileRecord>): CompletionSummary {
  const missingFields = requiredFields.filter((field) => !field.isFilled(profile)).map((field) => field.label);
  const filledCount = requiredFields.length - missingFields.length;
  const percent = Math.round((filledCount / requiredFields.length) * 100);

  return {
    percent,
    missingFields,
    isComplete: missingFields.length === 0,
  };
}

export function arrayToInputValue(value: string[]): string {
  return value.join(", ");
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function hasItems(value: string[] | null | undefined): boolean {
  return Boolean(value?.some((item) => hasText(item)));
}

function normalizeEducation(value: unknown): Education {
  if (!isRecord(value)) {
    return emptyEducation;
  }

  return {
    degree: getString(value.degree),
    field: getString(value.field),
    institution: getString(value.institution),
    graduationYear: getString(value.graduationYear),
  };
}

function normalizeWorkExperience(value: unknown): WorkExperience[] {
  const roles = Array.isArray(value) ? value : [];
  const normalized = roles.slice(0, 3).map((role) => {
    if (!isRecord(role)) {
      return emptyWorkExperience;
    }

    return {
      company: getString(role.company),
      title: getString(role.title),
      startDate: getString(role.startDate),
      endDate: getString(role.endDate),
      current: role.current === true,
      responsibilities: getString(role.responsibilities),
    };
  });

  while (normalized.length < 3) {
    normalized.push(emptyWorkExperience);
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
