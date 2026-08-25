import { redirect } from "next/navigation";

import { loadMovieDetailPage } from "@/features/movie-detail/load-movie-detail-page";
import { MovieDetailPageScreen } from "@/features/movie-detail/movie-detail-page-screen";
import { movieDetailPath } from "@/features/movie-detail/movie-slug";

type PageProps = {
  params: Promise<{ movieId: string; slug?: string[] }>;
};

/** Public in the endpoint behind it, and gated by the route guard like every
 * other product route: a shared link asks a stranger to sign in first. */
export default async function MovieDetailPage({ params }: PageProps) {
  const { movieId: rawMovieId, slug } = await params;
  const { movieId, pageData, publicReviews, slugIsStale } =
    await loadMovieDetailPage(rawMovieId, slug);

  // The slug is decoration and the id already resolved the film, so a wrong or
  // missing one is corrected rather than refused. Titles are localised and
  // change under old links; this is what keeps those links working.
  if (slugIsStale) {
    redirect(movieDetailPath(movieId, pageData.movie.title));
  }

  return (
    <MovieDetailPageScreen pageData={pageData} publicReviews={publicReviews} />
  );
}
