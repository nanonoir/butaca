export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_LANGUAGE = "es-AR";
export const TMDB_REGION = "AR";
export const TMDB_INCLUDE_ADULT = false;
export const TMDB_TIMEOUT_MS = 10_000;

export type TmdbConfig = {
  accessToken: string;
  baseUrl: string;
  language: string;
  region: string;
  includeAdult: boolean;
  timeoutMs: number;
};

export function createTmdbConfig(accessToken: string): TmdbConfig {
  return {
    accessToken,
    baseUrl: TMDB_BASE_URL,
    language: TMDB_LANGUAGE,
    region: TMDB_REGION,
    includeAdult: TMDB_INCLUDE_ADULT,
    timeoutMs: TMDB_TIMEOUT_MS,
  };
}
