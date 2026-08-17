import { z } from "zod";

import {
  IsoDateTimeSchema,
  TmdbMovieIdSchema,
  apiDataResponseSchema,
} from "./common";

export const MovieReactionSchema = z.enum(["LIKE", "DISLIKE"]);

export const ViewerMovieStateSchema = z
  .object({
    reaction: MovieReactionSchema.nullable(),
    watchedAt: IsoDateTimeSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.reaction === null && value.watchedAt !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["watchedAt"],
        message: "watchedAt cannot exist without a reaction",
      });
    }
  });

export const SetMovieReactionRequestSchema = z.object({
  reaction: MovieReactionSchema,
});

export const MovieInteractionStateSchema = z.object({
  movieId: TmdbMovieIdSchema,
  reaction: MovieReactionSchema,
  watchedAt: IsoDateTimeSchema.nullable(),
});

export const SetMovieReactionResponseSchema = apiDataResponseSchema(
  MovieInteractionStateSchema,
);

export const SetWatchedRequestSchema = z.object({
  watched: z.boolean(),
});

export const SetWatchedResponseSchema = apiDataResponseSchema(
  MovieInteractionStateSchema,
);

export const DeleteMovieReactionResponseSchema = apiDataResponseSchema(
  z.object({
    movieId: TmdbMovieIdSchema,
    reaction: z.null(),
    watchedAt: z.null(),
  }),
);

export type MovieReaction = z.infer<typeof MovieReactionSchema>;
export type ViewerMovieState = z.infer<typeof ViewerMovieStateSchema>;
export type MovieInteractionState = z.infer<typeof MovieInteractionStateSchema>;
