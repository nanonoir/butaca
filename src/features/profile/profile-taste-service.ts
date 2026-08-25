import "server-only";

import type { TasteSummary } from "@/contracts";

import type { TmdbAdapter } from "../../integrations/tmdb";
import {
  loadTasteProfile,
  type TasteProfilePorts,
} from "../recommendations/taste-profile-loader";

type CatalogPort = Pick<TmdbAdapter, "getGenres">;

/** Below this the profile is arithmetic on too little. Three films share
 * genres by accident, and calling one of them a favourite would be presenting
 * noise as a conclusion. */
const MIN_SIGNALS_TO_SUMMARISE = 5;

const TOP_GENRES = 5;
const TOP_ACTORS = 5;
const TOP_DIRECTORS = 3;

export class ProfileTasteService {
  constructor(
    private readonly ports: TasteProfilePorts,
    private readonly catalog: CatalogPort,
  ) {}

  async getTasteSummary(userId: string): Promise<TasteSummary> {
    // Read through the same loader the deck uses, so the account given here
    // cannot drift from the profile it is accounting for.
    const [{ profile, positiveSignals }, genres] = await Promise.all([
      loadTasteProfile(userId, this.ports),
      this.catalog.getGenres(),
    ]);
    const genreName = new Map(genres.map((genre) => [genre.id, genre.name]));
    const named = (id: number) => {
      const name = genreName.get(id);

      return name ? { id, name } : null;
    };

    return {
      hasEnough: positiveSignals >= MIN_SIGNALS_TO_SUMMARISE,
      likedCount: positiveSignals,
      genres: profile.preferredGenreIds
        .map(named)
        .filter((genre) => genre !== null)
        .slice(0, TOP_GENRES),
      avoidedGenres: profile.excludedGenreIds
        .map((id) => {
          const genre = named(id);

          return genre
            ? {
                ...genre,
                disliked: profile.genreCounts.disliked[id] ?? 0,
                liked: profile.genreCounts.liked[id] ?? 0,
              }
            : null;
        })
        .filter((genre) => genre !== null),
      actors: profile.cast.slice(0, TOP_ACTORS),
      directors: profile.crew.slice(0, TOP_DIRECTORS),
    };
  }
}
