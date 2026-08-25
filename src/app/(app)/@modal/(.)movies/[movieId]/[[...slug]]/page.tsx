import { loadMovieDetailPage } from "@/features/movie-detail/load-movie-detail-page";
import { MovieDetailPageScreen } from "@/features/movie-detail/movie-detail-page-screen";

type PageProps = {
  params: Promise<{ movieId: string; slug?: string[] }>;
};

/** The same detail, reached from inside the app.
 *
 * It renders over whatever list was underneath instead of replacing it, which
 * is what keeps the swipe deck alive behind a card somebody opened out of
 * curiosity. Pasting the address or reloading gets the page above; only the
 * navigation is intercepted. */
export default async function InterceptedMovieDetailPage({ params }: PageProps) {
  const { movieId: rawMovieId, slug } = await params;
  const { pageData, publicReviews } = await loadMovieDetailPage(
    rawMovieId,
    slug,
  );

  return (
    <MovieDetailPageScreen pageData={pageData} publicReviews={publicReviews} />
  );
}
