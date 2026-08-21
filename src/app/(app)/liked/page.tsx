import { redirect } from "next/navigation";

import { getLikesService } from "@/features/likes/likes-factory";
import { LikedMoviesScreen } from "@/features/likes/liked-movies-screen";
import { getOptionalViewer } from "@/lib/api/route";

export default async function LikedMoviesPage() {
  const viewer = await getOptionalViewer();

  // The proxy already guards this route; this keeps the page correct on its own
  // if it is ever rendered outside that guard.
  if (!viewer) {
    redirect("/login");
  }

  const { data } = await getLikesService().listLikedMovies(viewer.id, {
    page: 1,
    watched: "all",
  });

  return <LikedMoviesScreen items={data} />;
}
