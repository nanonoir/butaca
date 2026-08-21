import { MovieRouteParamsSchema } from "@/contracts/common";
import {
  ReviewsQuerySchema,
  UpsertReviewRequestSchema,
} from "@/contracts/reviews";
import { getReviewService } from "@/features/reviews/review-factory";
import {
  apiData,
  getOptionalViewer,
  readJsonBody,
  requireViewer,
  runApiRoute,
} from "@/lib/api/route";

type RouteContext = { params: Promise<{ movieId: string }> };

/** Community reviews are public: a guest gets the same list with every
 * `isMine` false. */
export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  return runApiRoute(async () => {
    const { movieId } = MovieRouteParamsSchema.parse(await params);
    const { page } = ReviewsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const viewer = await getOptionalViewer();
    const reviews = await getReviewService().getMovieReviews(
      movieId,
      page,
      viewer?.id ?? null,
    );

    return Response.json(reviews);
  });
}

export async function PUT(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  return runApiRoute(async () => {
    const { movieId } = MovieRouteParamsSchema.parse(await params);
    const input = await readJsonBody(request, UpsertReviewRequestSchema);
    const viewer = await requireViewer();

    return apiData(
      await getReviewService().upsertReview(viewer, movieId, input),
    );
  });
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  return runApiRoute(async () => {
    const { movieId } = MovieRouteParamsSchema.parse(await params);
    const viewer = await requireViewer();

    return apiData(await getReviewService().deleteReview(viewer.id, movieId));
  });
}
