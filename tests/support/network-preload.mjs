// TEST-ONLY network preload for the real Next server under E2E.
//
// Usage (the orchestrator, never the image or production):
//   NODE_OPTIONS="--import file:///<repo>/tests/support/network-preload.mjs" next start
//
// It replaces `globalThis.fetch` so that exactly two external providers are
// answered locally and everything else goes to the real implementation:
//   - api.resend.com            -> request is written to BUTACA_TEST_OUTBOX_DIR
//                                  and answered as accepted (or as failed when
//                                  a control file asks for it)
//   - api.themoviedb.org        -> small deterministic fixtures
// The application code has no knowledge of this file and no mock flag.
//
// Nothing is printed: outbox files contain links and tokens by design, so they
// live only in the temporary directory the test run owns.

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const TEST_DATABASE_NAME = /^butaca_[a-z0-9_]*test[a-z0-9_]*$/;

function assertSafeEnvironment() {
  if (process.env.BUTACA_TEST_DATABASE !== "1") {
    throw new Error("network-preload: BUTACA_TEST_DATABASE=1 is required");
  }

  const outbox = process.env.BUTACA_TEST_OUTBOX_DIR;

  if (!outbox) {
    throw new Error("network-preload: BUTACA_TEST_OUTBOX_DIR is required");
  }

  let url;

  try {
    url = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("network-preload: DATABASE_URL is not a valid URL");
  }

  const extraHosts = (process.env.BUTACA_TEST_DATABASE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const host = url.hostname.toLowerCase();

  if (!LOCAL_HOSTS.has(host) && !extraHosts.includes(host)) {
    throw new Error("network-preload: database host is not isolated");
  }

  if (!TEST_DATABASE_NAME.test(url.pathname.replace(/^\//, ""))) {
    throw new Error("network-preload: database name must match butaca_*test*");
  }

  mkdirSync(outbox, { recursive: true });

  return outbox;
}

const outboxDir = assertSafeEnvironment();

const fixtureDir = fileURLToPath(
  new URL("../../src/fixtures/tmdb/", import.meta.url),
);
const readFixture = (name) =>
  JSON.parse(readFileSync(join(fixtureDir, name), "utf8"));

const baseList = readFixture("movie-list.json");
const genres = readFixture("genres.json");
const baseDetail = readFixture("movie-detail.json");

// Enough distinct films for onboarding (3 required, 8 max) and discovery.
const movies = [
  ...baseList.results,
  ...[
    ["Faro del norte", "Northern Lighthouse", [7101, 7103]],
    ["Ecos del puerto", "Harbor Echoes", [7102, 7103]],
    ["El último tren", "The Last Train", [7101, 7102]],
    ["Cartas al mar", "Letters to the Sea", [7101, 7103]],
  ].map(([title, original, genreIds], index) => ({
    ...baseList.results[0],
    id: 8103 + index,
    title,
    original_title: original,
    overview: `${title}: una historia de prueba.`,
    genre_ids: genreIds,
    vote_average: 7 + index / 10,
    vote_count: 900 + index,
  })),
];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const list = (results) =>
  json({
    page: 1,
    results,
    total_pages: 1,
    total_results: results.length,
  });

function tmdbResponse(url) {
  const path = url.pathname.replace(/^\/3/, "");

  if (path === "/genre/movie/list") {
    return json(genres);
  }

  if (path === "/search/movie") {
    const query = (url.searchParams.get("query") ?? "").toLowerCase();
    const matches = movies.filter((movie) =>
      `${movie.title} ${movie.original_title}`.toLowerCase().includes(query),
    );

    return list(matches);
  }

  if (path === "/movie/popular" || path === "/discover/movie") {
    return list(movies);
  }

  if (path === "/search/person") {
    return json({ page: 1, results: [], total_pages: 0, total_results: 0 });
  }

  if (/^\/person\/\d+\/movie_credits$/.test(path)) {
    return json({ cast: [], crew: [] });
  }

  const related = /^\/movie\/(\d+)\/(similar|recommendations)$/.exec(path);

  if (related) {
    return list(movies.filter((movie) => String(movie.id) !== related[1]));
  }

  const detail = /^\/movie\/(\d+)$/.exec(path);

  if (detail) {
    const movie = movies.find((candidate) => String(candidate.id) === detail[1]);

    if (!movie) {
      return json({ status_code: 34, status_message: "Not found" }, 404);
    }

    const { genre_ids: genreIds, ...core } = movie;

    return json({
      ...baseDetail,
      ...core,
      genres: genres.genres.filter((genre) => genreIds.includes(genre.id)),
    });
  }

  return json({ status_code: 34, status_message: "Not found" }, 404);
}

/** `resend-status` in the outbox directory makes the next sends answer with that
 * HTTP status (delete the file to accept again). Lets a test run fail mail on
 * purpose without any application flag. */
function resendStatus() {
  try {
    const value = Number(
      readFileSync(join(outboxDir, "resend-status"), "utf8").trim(),
    );

    return Number.isInteger(value) && value >= 100 ? value : 200;
  } catch {
    return 200;
  }
}

async function resendResponse(request) {
  const body = JSON.parse(
    typeof request.body === "string" ? request.body : "{}",
  );
  const status = resendStatus();
  const name = `${Date.now()}-${randomUUID()}.json`;
  const temporary = join(outboxDir, `.${name}.tmp`);

  writeFileSync(
    temporary,
    JSON.stringify({
      to: body.to,
      from: body.from,
      subject: body.subject,
      text: body.text,
      html: body.html,
      status,
      receivedAt: new Date().toISOString(),
    }),
  );
  // Rename last so a reader never sees a half-written message.
  renameSync(temporary, join(outboxDir, name));

  return status >= 200 && status < 300
    ? json({ id: randomUUID() }, status)
    : json({ name: "provider_error", message: "stubbed failure" }, status);
}

const realFetch = globalThis.fetch;

globalThis.fetch = async function stubbedFetch(input, init) {
  let url;

  try {
    url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
  } catch {
    return realFetch(input, init);
  }

  if (url.hostname === "api.resend.com") {
    return resendResponse({ body: init?.body });
  }

  if (url.hostname === "api.themoviedb.org") {
    return tmdbResponse(url);
  }

  return realFetch(input, init);
};
