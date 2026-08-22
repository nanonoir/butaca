import { redirect } from "next/navigation";

import { DiscoverScreen } from "@/features/discovery/discover-screen";
import { getRecommendationService } from "@/features/recommendations/recommendation-factory";
import { getOptionalViewer } from "@/lib/api/route";

export default async function DiscoverPage() {
  const viewer = await getOptionalViewer();

  // The proxy already guards this route; this keeps the page correct on its own
  // if it is ever rendered outside that guard.
  if (!viewer) {
    redirect("/login");
  }

  const { movies } = await getRecommendationService().getDiscoverBatch(
    viewer.id,
  );

  return <DiscoverScreen movies={movies} />;
}
