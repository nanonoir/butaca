import { describe, expect, it, vi } from "vitest";

import {
  MovieInteractionStateSchema,
  ViewerMovieStateSchema,
} from "@/contracts";

import type { UserMovieInteractionRecord } from "../../db/schema/user-movie-interactions";

import { InteractionService } from "./interaction-service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const MOVIE_ID = 157_336;
const WATCHED_AT = new Date("2026-08-20T12:00:00.000Z");

function createRepository() {
  return {
    findByUserAndMovie: vi.fn(),
    upsertReaction: vi.fn(),
    setWatched: vi.fn(),
    delete: vi.fn(),
  };
}

function createRecord(
  overrides: Partial<UserMovieInteractionRecord> = {},
): UserMovieInteractionRecord {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    userId: USER_ID,
    movieId: MOVIE_ID,
    reaction: "LIKE",
    watchedAt: null,
    createdAt: WATCHED_AT,
    updatedAt: WATCHED_AT,
    ...overrides,
  };
}

describe("getViewerState", () => {
  it("reports an untouched movie as empty state", async () => {
    const repository = createRepository();
    repository.findByUserAndMovie.mockResolvedValue(null);

    const state = await new InteractionService(repository).getViewerState(
      USER_ID,
      MOVIE_ID,
    );

    expect(state).toEqual({ reaction: null, watchedAt: null });
    expect(ViewerMovieStateSchema.safeParse(state).success).toBe(true);
  });

  it("serializes the stored date as an ISO instant", async () => {
    const repository = createRepository();
    repository.findByUserAndMovie.mockResolvedValue(
      createRecord({ watchedAt: WATCHED_AT }),
    );

    await expect(
      new InteractionService(repository).getViewerState(USER_ID, MOVIE_ID),
    ).resolves.toEqual({
      reaction: "LIKE",
      watchedAt: "2026-08-20T12:00:00.000Z",
    });
  });

  it("always scopes the read by the caller's user id", async () => {
    const repository = createRepository();
    repository.findByUserAndMovie.mockResolvedValue(null);

    await new InteractionService(repository).getViewerState(
      OTHER_USER_ID,
      MOVIE_ID,
    );

    expect(repository.findByUserAndMovie).toHaveBeenCalledWith(
      OTHER_USER_ID,
      MOVIE_ID,
    );
  });
});

describe("setReaction", () => {
  it("returns a state the response contract accepts", async () => {
    const repository = createRepository();
    repository.upsertReaction.mockResolvedValue(
      createRecord({ reaction: "DISLIKE" }),
    );

    const state = await new InteractionService(repository).setReaction(
      USER_ID,
      MOVIE_ID,
      "DISLIKE",
    );

    expect(state).toEqual({
      movieId: MOVIE_ID,
      reaction: "DISLIKE",
      watchedAt: null,
    });
    expect(MovieInteractionStateSchema.safeParse(state).success).toBe(true);
  });

  it("preserves watchedAt when switching reaction", async () => {
    const repository = createRepository();
    repository.upsertReaction.mockResolvedValue(
      createRecord({ reaction: "DISLIKE", watchedAt: WATCHED_AT }),
    );

    await expect(
      new InteractionService(repository).setReaction(
        USER_ID,
        MOVIE_ID,
        "DISLIKE",
      ),
    ).resolves.toMatchObject({ watchedAt: "2026-08-20T12:00:00.000Z" });
  });
});

describe("removeReaction", () => {
  it("keeps watchedAt when the movie was already watched", async () => {
    const repository = createRepository();
    repository.delete.mockResolvedValue(true);
    repository.findByUserAndMovie.mockResolvedValue(
      createRecord({ reaction: null, watchedAt: WATCHED_AT }),
    );

    await expect(
      new InteractionService(repository).removeReaction(USER_ID, MOVIE_ID),
    ).resolves.toEqual({
      movieId: MOVIE_ID,
      reaction: null,
      watchedAt: "2026-08-20T12:00:00.000Z",
    });
  });

  it("reports no watched mark when the row was removed entirely", async () => {
    const repository = createRepository();
    repository.delete.mockResolvedValue(true);
    repository.findByUserAndMovie.mockResolvedValue(null);

    await expect(
      new InteractionService(repository).removeReaction(USER_ID, MOVIE_ID),
    ).resolves.toEqual({
      movieId: MOVIE_ID,
      reaction: null,
      watchedAt: null,
    });
  });

  it("rejects removing a reaction that does not exist", async () => {
    const repository = createRepository();
    repository.delete.mockResolvedValue(false);

    await expect(
      new InteractionService(repository).removeReaction(USER_ID, MOVIE_ID),
    ).rejects.toMatchObject({ code: "REACTION_NOT_FOUND" });
    expect(repository.findByUserAndMovie).not.toHaveBeenCalled();
  });
});

describe("setWatched", () => {
  it("marks a movie as watched without requiring a reaction", async () => {
    const repository = createRepository();
    repository.setWatched.mockResolvedValue(
      createRecord({ reaction: null, watchedAt: WATCHED_AT }),
    );

    const state = await new InteractionService(repository).setWatched(
      USER_ID,
      MOVIE_ID,
      true,
    );

    expect(state).toEqual({
      movieId: MOVIE_ID,
      reaction: null,
      watchedAt: "2026-08-20T12:00:00.000Z",
    });
    expect(repository.setWatched.mock.calls[0]?.[2]).toBeInstanceOf(Date);
  });

  it("clears the watched mark without touching the reaction", async () => {
    const repository = createRepository();
    repository.setWatched.mockResolvedValue(
      createRecord({ reaction: "LIKE", watchedAt: null }),
    );

    await expect(
      new InteractionService(repository).setWatched(USER_ID, MOVIE_ID, false),
    ).resolves.toEqual({
      movieId: MOVIE_ID,
      reaction: "LIKE",
      watchedAt: null,
    });
    expect(repository.setWatched).toHaveBeenCalledWith(USER_ID, MOVIE_ID, null);
  });

  it("reports an empty state when unwatching removed the row", async () => {
    const repository = createRepository();
    repository.setWatched.mockResolvedValue(null);

    await expect(
      new InteractionService(repository).setWatched(USER_ID, MOVIE_ID, false),
    ).resolves.toEqual({
      movieId: MOVIE_ID,
      reaction: null,
      watchedAt: null,
    });
  });
});
