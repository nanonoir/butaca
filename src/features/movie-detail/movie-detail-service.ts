import "server-only";

import type { MovieDetailPageData } from "@/contracts";

import type { TmdbAdapter } from "../../integrations/tmdb";
import type { UserRecord } from "../../db/schema/users";
import type { InteractionService } from "../interactions/interaction-service";
import type { ReviewService } from "../reviews/review-service";

type MovieCatalogPort = Pick<TmdbAdapter, "getMovieDetail">;
type ViewerStatePort = Pick<InteractionService, "getViewerState">;
type ReviewPort = Pick<ReviewService, "getSummary" | "getMyReview">;

type Viewer = Pick<UserRecord, "id" | "displayName" | "avatarUrl">;

const GUEST_STATE = { reaction: null, watchedAt: null } as const;

/** Composes the four parts the detail screen needs. The community review list
 * is deliberately absent: it is paginated and has its own endpoint. */
export class MovieDetailService {
  constructor(
    private readonly catalog: MovieCatalogPort,
    private readonly interactions: ViewerStatePort,
    private readonly reviews: ReviewPort,
  ) {}

  async getPageData(
    movieId: number,
    viewer: Viewer | null,
  ): Promise<MovieDetailPageData> {
    const [movie, reviewSummary, viewerState, myReview] = await Promise.all([
      this.catalog.getMovieDetail(movieId),
      this.reviews.getSummary(movieId),
      // A guest has no state and no review of their own, and asking the
      // database for either would be a query with nothing to scope it to.
      viewer
        ? this.interactions.getViewerState(viewer.id, movieId)
        : Promise.resolve({ ...GUEST_STATE }),
      viewer
        ? this.reviews.getMyReview(viewer, movieId)
        : Promise.resolve(null),
    ]);

    return { movie, viewerState, reviewSummary, myReview };
  }
}
