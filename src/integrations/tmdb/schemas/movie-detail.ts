import { z } from "zod";

import { TmdbGenreSchema, TmdbMovieCoreSchema } from "./common";

export const TmdbCastMemberSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  character: z.string(),
  profile_path: z.string().nullable(),
  order: z.number().int().min(0),
});

export const TmdbCrewMemberSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  job: z.string(),
  profile_path: z.string().nullable(),
});

export const TmdbKeywordSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
});

export const TmdbVideoSchema = z.object({
  name: z.string(),
  site: z.string(),
  type: z.string(),
  official: z.boolean(),
  iso_639_1: z.string().nullable(),
  key: z.string(),
});

export const TmdbMovieDetailResponseSchema = TmdbMovieCoreSchema.extend({
  tagline: z.string(),
  runtime: z.number().int().nullable(),
  genres: z.array(TmdbGenreSchema),
  credits: z.object({
    cast: z.array(TmdbCastMemberSchema),
    crew: z.array(TmdbCrewMemberSchema),
  }),
  keywords: z.object({
    keywords: z.array(TmdbKeywordSchema),
  }),
  videos: z.object({
    results: z.array(TmdbVideoSchema),
  }),
});

export type TmdbCastMember = z.infer<typeof TmdbCastMemberSchema>;
export type TmdbCrewMember = z.infer<typeof TmdbCrewMemberSchema>;
export type TmdbKeyword = z.infer<typeof TmdbKeywordSchema>;
export type TmdbVideo = z.infer<typeof TmdbVideoSchema>;
export type TmdbMovieDetailResponse = z.infer<
  typeof TmdbMovieDetailResponseSchema
>;
