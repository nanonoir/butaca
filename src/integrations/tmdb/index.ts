import "server-only";

import { getDatabase } from "../../db";
import { MovieCacheRepository } from "../../db/repositories";
import { getServerEnv } from "../../lib/env/server";

import { TmdbAdapter } from "./adapter";
import { TmdbClient } from "./client";
import { createTmdbConfig } from "./config";

let tmdb: TmdbAdapter | undefined;

export function getTmdb(): TmdbAdapter {
  if (!tmdb) {
    const config = createTmdbConfig(getServerEnv().TMDB_ACCESS_TOKEN);
    const client = new TmdbClient(config);
    const cache = new MovieCacheRepository(getDatabase());

    tmdb = new TmdbAdapter(client, cache, config.language);
  }

  return tmdb;
}

export { TmdbAdapter } from "./adapter";
export type { PaginatedMovies, TmdbDiscoverOptions } from "./adapter";
export { TmdbError } from "./errors";
export type { TmdbErrorCode } from "./errors";
