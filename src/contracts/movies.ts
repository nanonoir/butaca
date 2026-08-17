import { z } from "zod";

import {
  DateOnlySchema,
  TmdbGenreIdSchema,
  TmdbKeywordIdSchema,
  TmdbMovieIdSchema,
  TmdbPersonIdSchema,
} from "./common";

export const GenreSchema = z.object({
  id: TmdbGenreIdSchema,
  name: z.string().min(1),
});

export const PersonSummarySchema = z.object({
  id: TmdbPersonIdSchema,
  name: z.string().min(1),
  profilePath: z.string().nullable(),
});

export const CastMemberSchema = z.object({
  id: TmdbPersonIdSchema,
  name: z.string().min(1),
  character: z.string(),
  profilePath: z.string().nullable(),
  order: z.number().int().min(0),
});

export const KeywordSchema = z.object({
  id: TmdbKeywordIdSchema,
  name: z.string().min(1),
});

export const TrailerSchema = z.object({
  name: z.string().min(1),
  site: z.string().min(1),
  key: z.string().min(1),
  official: z.boolean(),
});

export const MovieSummarySchema = z.object({
  id: TmdbMovieIdSchema,
  title: z.string().min(1),
  originalTitle: z.string().min(1),
  overview: z.string(),
  posterPath: z.string().nullable(),
  backdropPath: z.string().nullable(),
  genreIds: z.array(TmdbGenreIdSchema),
  releaseDate: DateOnlySchema.nullable(),
  originalLanguage: z.string().min(2),
  tmdbRating: z.number().min(0).max(10),
  tmdbVoteCount: z.number().int().min(0),
});

export const MovieDetailSchema = z.object({
  id: TmdbMovieIdSchema,
  title: z.string().min(1),
  originalTitle: z.string().min(1),
  overview: z.string(),
  tagline: z.string().nullable(),
  posterPath: z.string().nullable(),
  backdropPath: z.string().nullable(),
  releaseDate: DateOnlySchema.nullable(),
  runtime: z.number().int().positive().nullable(),
  originalLanguage: z.string().min(2),
  genres: z.array(GenreSchema),
  tmdbRating: z.number().min(0).max(10),
  tmdbVoteCount: z.number().int().min(0),
  director: PersonSummarySchema.nullable(),
  cast: z.array(CastMemberSchema).max(20),
  keywords: z.array(KeywordSchema).max(50),
  trailer: TrailerSchema.nullable(),
});

export type Genre = z.infer<typeof GenreSchema>;
export type PersonSummary = z.infer<typeof PersonSummarySchema>;
export type CastMember = z.infer<typeof CastMemberSchema>;
export type Keyword = z.infer<typeof KeywordSchema>;
export type Trailer = z.infer<typeof TrailerSchema>;
export type MovieSummary = z.infer<typeof MovieSummarySchema>;
export type MovieDetail = z.infer<typeof MovieDetailSchema>;
