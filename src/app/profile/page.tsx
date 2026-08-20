import { ProfileScreen } from "@/features/profile/profile-screen";
import {
  PROFILE_FIXTURE,
  PROFILE_GENRE_OPTIONS_FIXTURE,
} from "@/fixtures/profile";

export default function ProfilePage() {
  return (
    <ProfileScreen
      genreOptions={PROFILE_GENRE_OPTIONS_FIXTURE}
      profile={PROFILE_FIXTURE}
    />
  );
}
