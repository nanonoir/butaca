import { EditProfilePreferencesScreen } from "@/features/profile/edit-profile-preferences-screen";
import {
  PROFILE_GENRE_OPTIONS_FIXTURE,
  PROFILE_PREFERRED_GENRE_IDS_FIXTURE,
} from "@/fixtures/profile";

export default function ProfilePreferencesPage() {
  return (
    <EditProfilePreferencesScreen
      genreOptions={PROFILE_GENRE_OPTIONS_FIXTURE}
      initialPreferredGenreIds={PROFILE_PREFERRED_GENRE_IDS_FIXTURE}
    />
  );
}
