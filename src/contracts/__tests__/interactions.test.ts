import { describe, expect, it } from "vitest";

import {
  DeleteMovieReactionResponseSchema,
  MovieInteractionStateSchema,
  ViewerMovieStateSchema,
} from "../interactions";

describe("ViewerMovieStateSchema", () => {
  it("accepts a neutral state without a watched timestamp", () => {
    const result = ViewerMovieStateSchema.safeParse({
      reaction: null,
      watchedAt: null,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a watched timestamp without a reaction", () => {
    const result = ViewerMovieStateSchema.safeParse({
      reaction: null,
      watchedAt: "2026-08-17T16:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("keeps watched state independent when a reaction is removed", () => {
    const interaction = MovieInteractionStateSchema.safeParse({
      movieId: 438631,
      reaction: null,
      watchedAt: "2026-08-17T16:00:00.000Z",
    });
    const deletion = DeleteMovieReactionResponseSchema.safeParse({
      data: {
        movieId: 438631,
        reaction: null,
        watchedAt: "2026-08-17T16:00:00.000Z",
      },
    });

    expect(interaction.success).toBe(true);
    expect(deletion.success).toBe(true);
  });
});
