import { redirect } from "next/navigation";

import { LikesQuerySchema } from "@/contracts/likes";
import { getLikesService } from "@/features/likes/likes-factory";
import { LikedMoviesScreen } from "@/features/likes/liked-movies-screen";
import { getOptionalViewer } from "@/lib/api/route";

type LikedSearchParams = Record<string, string | string[] | undefined>;

interface LikedMoviesPageProps {
  searchParams: Promise<LikedSearchParams>;
}

/** A hand edited query string must not break the library: anything the contract
 * rejects falls back to the first page of every liked movie. */
function readLikesQuery(params: LikedSearchParams) {
  const parsed = LikesQuerySchema.safeParse(params);

  return parsed.success ? parsed.data : LikesQuerySchema.parse({});
}

export default async function LikedMoviesPage({
  searchParams,
}: LikedMoviesPageProps) {
  const viewer = await getOptionalViewer();

  // The proxy already guards this route; this keeps the page correct on its own
  // if it is ever rendered outside that guard.
  if (!viewer) {
    redirect("/login");
  }

  // Paging and filtering both live in the query, so the database returns the
  // slice the viewer asked for. Filtering the page in the browser would only
  // ever see the twenty movies it already had.
  const query = readLikesQuery(await searchParams);
  const { data, meta } = await getLikesService().listLikedMovies(
    viewer.id,
    query,
  );

  return <LikedMoviesScreen items={data} meta={meta} watched={query.watched} />;
}
