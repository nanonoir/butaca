import { z } from "zod";

export const PAGE_SIZE = 20 as const;

export const TmdbMovieIdSchema = z.number().int().positive();

export const TmdbGenreIdSchema = z.number().int().positive();

export const TmdbPersonIdSchema = z.number().int().positive();

export const TmdbKeywordIdSchema = z.number().int().positive();

export const UuidSchema = z.uuid();

export const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const MovieRouteParamsSchema = z.object({
  movieId: z.coerce.number().int().positive(),
});

export const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export const PaginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.literal(PAGE_SIZE),
  totalPages: z.number().int().min(0),
  totalResults: z.number().int().min(0),
  hasNextPage: z.boolean(),
});

export const apiDataResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema,
  });

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: PaginationMetaSchema,
  });

export type TmdbMovieId = z.infer<typeof TmdbMovieIdSchema>;
export type TmdbGenreId = z.infer<typeof TmdbGenreIdSchema>;
export type TmdbPersonId = z.infer<typeof TmdbPersonIdSchema>;
export type TmdbKeywordId = z.infer<typeof TmdbKeywordIdSchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
