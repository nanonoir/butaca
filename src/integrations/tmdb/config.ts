import "server-only";

export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
/** TMDB has no Argentine translations, so asking for es-AR quietly fell back to
 * Spain: Die Hard came back as "Jungla de cristal" and The Shawshank Redemption
 * as "Cadena perpetua". es-MX is the Latin American track, and it is what these
 * films were released under here -- "Duro de matar", "Sueño de fuga", "Tiempos
 * Violentos". Where no Latin American title exists TMDB falls back to Spain
 * anyway, so nothing is lost by asking.
 *
 * The region stays AR: it decides release dates and certifications, not titles. */
export const TMDB_LANGUAGE = "es-MX";
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
