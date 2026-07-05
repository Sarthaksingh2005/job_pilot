import { getProfileForCurrentUser, type ProfileActionState } from "@/actions/profile";
import { calculateProfileCompletion, normalizeProfile } from "@/lib/profile";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = normalizeProfile(await getProfileForCurrentUser());
  const completion = calculateProfileCompletion(profile);
  const initialState: ProfileActionState = {
    success: false,
    message: "",
    profile,
    percent: completion.percent,
    missingFields: completion.missingFields,
  };

  return <ProfileForm initialProfile={profile} initialState={initialState} />;
}
