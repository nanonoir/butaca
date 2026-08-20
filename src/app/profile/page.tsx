import { ProfileScreen } from "@/features/profile/profile-screen";
import { PROFILE_FIXTURE } from "@/fixtures/profile";

export default function ProfilePage() {
  return <ProfileScreen profile={PROFILE_FIXTURE} />;
}
