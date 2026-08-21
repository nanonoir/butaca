import { DiscoverScreen } from "@/features/discovery/discover-screen";
import { DISCOVER_MOVIES_FIXTURE } from "@/fixtures/discover-movies";

export default function Home() {
  return <DiscoverScreen movies={DISCOVER_MOVIES_FIXTURE.data.movies} />;
}
