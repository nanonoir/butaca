import "server-only";

import type { MovieDetail, TasteSummary } from "@/contracts";

import type {
  UserMovieInteractionRepository,
  UserPreferencesRepository,
} from "../../db/repositories";
import type { UserMovieInteractionRecord } from "../../db/schema/user-movie-interactions";
import type { TmdbAdapter } from "../../integrations/tmdb";
import { buildTasteProfile } from "../recommendations/taste-profile";

type InteractionsPort = Pick<
  UserMovieInteractionRepository,
  "findLikesByUser" | "findDislikesByUser"
>;
type PreferencesPort = Pick<UserPreferencesRepository, "findByUserId">;
type CatalogPort = Pick<TmdbAdapter, "getMovieDetail" | "getGenres">;

/** Below this the profile is arithmetic on too little. Three films share
 * genres by accident, and calling one of them a favourite would be presenting
 * noise as a conclusion. */
const MIN_LIKES_TO_SUMMARISE = 5;

const TOP_GENRES = 5;
const TOP_ACTORS = 5;
const TOP_DIRECTORS = 3;

/** What the recommender already knows, said out loud.
 *
 * Every batch of cards is built from this and none of it was ever visible: the
 * viewer got the results and no account of them. It answers the question a
 * recommender always leaves open, and it is the only place the exclusions can
 * be seen at all. */
export class ProfileTasteService {
  constructor(
    private readonly interactions: InteractionsPort,
    private readonly preferences: PreferencesPort,
    private readonly catalog: CatalogPort,
  ) {}

  async getTasteSummary(userId: string): Promise<TasteSummary> {
    const [preferences, liked, disliked, genres] = await Promise.all([
      this.preferences.findByUserId(userId),
      this.interactions.findLikesByUser(userId, 1),
      this.interactions.findDislikesByUser(userId, 1),
      this.catalog.getGenres(),
    ]);
    const [likedDetails, dislikedDetails] = await Promise.all([
      this.resolveDetails(liked),
      this.resolveDetails(disliked),
    ]);
    const profile = buildTasteProfile({
      preferredGenreIds: preferences?.preferredGenreIds ?? [],
      liked: likedDetails,
      disliked: dislikedDetails,
    });
    const genreName = new Map(genres.map((genre) => [genre.id, genre.name]));
    const named = (id: number) => {
      const name = genreName.get(id);

      return name ? { id, name } : null;
    };

    return {
      hasEnough: likedDetails.length >= MIN_LIKES_TO_SUMMARISE,
      likedCount: likedDetails.length,
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

  /** A movie the provider can no longer resolve drops out rather than failing
   * the summary, the same way it does everywhere else this pattern appears. */
  private async resolveDetails(
    records: UserMovieInteractionRecord[],
  ): Promise<MovieDetail[]> {
    const results = await Promise.allSettled(
      records.map((record) => this.catalog.getMovieDetail(record.movieId)),
    );

    return results
      .filter(
        (result): result is PromiseFulfilledResult<MovieDetail> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);
  }
}
