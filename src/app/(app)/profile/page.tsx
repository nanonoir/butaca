import { redirect } from "next/navigation";

import { getDatabase } from "@/db";
import {
  ReviewRepository,
  UserMovieInteractionRepository,
  UserPreferencesRepository,
} from "@/db/repositories";
import { getServerAuthService } from "@/features/auth/server-auth-factory";
import { getProfileInitials } from "@/features/profile/profile-initials";
import { getProfileLikesService } from "@/features/profile/profile-likes-factory";
import { getProfileReviewsService } from "@/features/profile/profile-reviews-factory";
import { getProfileTasteService } from "@/features/profile/profile-taste-factory";
import { ProfileScreen } from "@/features/profile/profile-screen";
import { PROFILE_GENRE_OPTIONS_FIXTURE } from "@/fixtures/profile";

export default async function ProfilePage() {
  const authService = await getServerAuthService();
  const session = await authService.getCurrentSession();

  // The proxy already guards this route; this keeps the page correct on its own
  // if it is ever rendered outside that guard.
  if (!session) {
    redirect("/login");
  }

  const database = getDatabase();
  const reviewRepository = new ReviewRepository(database);
  const [
    preferences,
    interactions,
    reviewCount,
    myReviews,
    recentLikes,
    taste,
  ] = await Promise.all([
    new UserPreferencesRepository(database).findByUserId(session.user.id),
    new UserMovieInteractionRepository(database).countByUser(session.user.id),
    reviewRepository.countByUser(session.user.id),
    getProfileReviewsService().listMyReviews(session.user.id, 1),
    getProfileLikesService().listRecentLikes(session.user.id),
    getProfileTasteService().getTasteSummary(session.user.id),
  ]);

  return (
    <ProfileScreen
      // Genre names still come from the fixture: resolving them needs the TMDB
      // catalog wiring that belongs to the catalog step.
      genreOptions={PROFILE_GENRE_OPTIONS_FIXTURE}
      profile={{
        displayName: session.user.displayName,
        email: session.email ?? "",
        initials: getProfileInitials(session.user.displayName),
        preferredGenreIds: preferences?.preferredGenreIds ?? [],
        activity: [
          { label: "Me gusta", value: interactions.liked, tone: "primary" },
          { label: "Vistas", value: interactions.watched, tone: "default" },
          { label: "Reseñas", value: reviewCount, tone: "default" },
        ],
        reviews: myReviews.data,
        recentLikes,
        taste,
      }}
    />
  );
}
