import { describe, expect, it } from "vitest";

import {
  ApiErrorCodeSchema,
  LikesQuerySchema,
  LikesWatchedFilterSchema,
  MovieReactionSchema,
  PageQuerySchema,
  PaginationMetaSchema,
  TrailerSchema,
  type LikesWatchedFilter,
} from "..";

describe("public contracts entry point", () => {
  it("exposes documented schemas without internal module imports", () => {
    expect(MovieReactionSchema.parse("LIKE")).toBe("LIKE");
    expect(ApiErrorCodeSchema.parse("NOT_FOUND")).toBe("NOT_FOUND");
  });

  it("keeps inferred types aligned with their runtime schemas", () => {
    const watchedFilter: LikesWatchedFilter = "watched";

    expect(LikesWatchedFilterSchema.parse(watchedFilter)).toBe("watched");
  });

  it("accepts a trailer from a provider-neutral site", () => {
    const result = TrailerSchema.safeParse({
      name: "Official Trailer",
      site: "Vimeo",
      key: "trailer-key",
      official: true,
    });

    expect(result.success).toBe(true);
  });

  it("rejects page inputs below one and page sizes other than twenty", () => {
    expect(PageQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(
      PaginationMetaSchema.safeParse({
        page: 1,
        pageSize: 10,
        totalPages: 1,
        totalResults: 1,
        hasNextPage: false,
      }).success,
    ).toBe(false);
  });

  it("defaults an omitted likes filter to all", () => {
    expect(LikesQuerySchema.parse({}).watched).toBe("all");
  });
});
