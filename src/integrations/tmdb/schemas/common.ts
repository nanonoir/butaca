import { z } from "zod";

export const TmdbGenreSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
});

export const TmdbGenresResponseSchema = z.object({
  genres: z.array(TmdbGenreSchema),
});

export const TmdbMovieCoreSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  original_title: z.string(),
  overview: z.string(),
  poster_path: z.string().nullable(),
  backdrop_path: z.string().nullable(),
  release_date: z.string(),
  original_language: z.string(),
  vote_average: z.number(),
  vote_count: z.number().int().min(0),
});

export type TmdbGenre = z.infer<typeof TmdbGenreSchema>;
export type TmdbGenresResponse = z.infer<typeof TmdbGenresResponseSchema>;
