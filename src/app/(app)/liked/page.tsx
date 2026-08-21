import { LikedMoviesScreen } from "@/features/likes/liked-movies-screen";
import { LIKED_MOVIES_FIXTURE } from "@/fixtures/liked-movies";

export default function LikedMoviesPage() {
  return <LikedMoviesScreen items={LIKED_MOVIES_FIXTURE.data} />;
}
