import {
  MovieDetailPageDataSchema,
  type MovieDetailPageData,
} from "@/contracts/movie-detail";
import type { MovieSummary } from "@/contracts/movies";
import { ReviewsResponseSchema, type Review } from "@/contracts/reviews";

export interface MovieDetailExperienceFixture {
  pageData: MovieDetailPageData;
  publicReviews: Review[];
}

const GENRE_NAMES: Readonly<Record<number, string>> = {
  12: "Aventura",
  14: "Fantasía",
  16: "Animación",
  18: "Drama",
  28: "Acción",
  35: "Comedia",
  53: "Thriller",
  878: "Ciencia ficción",
  9648: "Misterio",
  10749: "Romance",
  10751: "Familia",
};

const DUNE_DETAIL = MovieDetailPageDataSchema.parse({
  movie: {
    id: 438631,
    title: "Dune",
    originalTitle: "Dune",
    overview:
      "Paul Atreides debe viajar al planeta más peligroso del universo para asegurar el futuro de su familia y de su pueblo. Cuando fuerzas enfrentadas entran en conflicto por el recurso más valioso del planeta, sólo sobrevivirán quienes puedan vencer sus miedos.",
    tagline: "Más allá del miedo, el destino aguarda.",
    posterPath: "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
    backdropPath: "/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
    releaseDate: "2021-09-15",
    runtime: 155,
    originalLanguage: "en",
    genres: [
      { id: 878, name: "Ciencia ficción" },
      { id: 12, name: "Aventura" },
      { id: 18, name: "Drama" },
    ],
    tmdbRating: 7.8,
    tmdbVoteCount: 13400,
    director: {
      id: 137427,
      name: "Denis Villeneuve",
      profilePath: null,
    },
    cast: [
      {
        id: 1190668,
        name: "Timothée Chalamet",
        character: "Paul Atreides",
        profilePath: null,
        order: 0,
      },
      {
        id: 933238,
        name: "Rebecca Ferguson",
        character: "Lady Jessica",
        profilePath: null,
        order: 1,
      },
      {
        id: 25072,
        name: "Oscar Isaac",
        character: "Duke Leto Atreides",
        profilePath: null,
        order: 2,
      },
      {
        id: 505710,
        name: "Zendaya",
        character: "Chani",
        profilePath: null,
        order: 3,
      },
    ],
    keywords: [
      { id: 818, name: "based on novel" },
      { id: 180547, name: "desert planet" },
    ],
    trailer: {
      name: "Dune — Trailer oficial",
      site: "YouTube",
      key: "n9xhJrPXop4",
      official: true,
    },
  },
  viewerState: {
    reaction: null,
    watchedAt: null,
  },
  reviewSummary: {
    recommended: 106,
    notWorthIt: 20,
    total: 126,
    recommendationRate: 84,
  },
  myReview: null,
});

const DUNE_REVIEWS = ReviewsResponseSchema.parse({
  data: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      movieId: 438631,
      author: {
        displayName: "Camila",
        avatarUrl: null,
      },
      verdict: "RECOMMENDED",
      title: "Verla en pantalla grande",
      description:
        "El sonido hace la mitad del trabajo. En casa pierde bastante, pero igual la recomiendo.",
      isMine: false,
      createdAt: "2026-08-15T18:30:00.000Z",
      updatedAt: "2026-08-15T18:30:00.000Z",
    },
    {
      id: "10000000-0000-4000-8000-000000000002",
      movieId: 438631,
      author: {
        displayName: "Nicolás",
        avatarUrl: null,
      },
      verdict: "NOT_WORTH_IT",
      title: "Media película",
      description:
        "Está muy bien hecha, pero termina justo cuando empieza. Esperaría a verla junto con la segunda parte.",
      isMine: false,
      createdAt: "2026-07-29T21:10:00.000Z",
      updatedAt: "2026-07-29T21:10:00.000Z",
    },
  ],
  meta: {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalResults: 2,
    hasNextPage: false,
  },
}).data;

const DUNE_EXPERIENCE: MovieDetailExperienceFixture = {
  pageData: DUNE_DETAIL,
  publicReviews: DUNE_REVIEWS,
};

function createFallbackDetail(
  movie: MovieSummary,
): MovieDetailExperienceFixture {
  const pageData = MovieDetailPageDataSchema.parse({
    movie: {
      ...movie,
      tagline: null,
      runtime: null,
      genres: movie.genreIds.map((id) => ({
        id,
        name: GENRE_NAMES[id] ?? `Género ${id}`,
      })),
      director: null,
      cast: [],
      keywords: [],
      trailer: null,
    },
    viewerState: {
      reaction: null,
      watchedAt: null,
    },
    reviewSummary: {
      recommended: 0,
      notWorthIt: 0,
      total: 0,
      recommendationRate: null,
    },
    myReview: null,
  });

  return { pageData, publicReviews: [] };
}

export function getMovieDetailExperienceFixture(
  movie: MovieSummary,
): MovieDetailExperienceFixture {
  return movie.id === DUNE_DETAIL.movie.id
    ? DUNE_EXPERIENCE
    : createFallbackDetail(movie);
}
