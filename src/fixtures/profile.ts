import { GenreSchema } from "@/contracts/movies";
import { UpdatePreferencesRequestSchema } from "@/contracts/preferences";

export const PROFILE_GENRE_OPTIONS_FIXTURE = GenreSchema.array().parse([
  { id: 878, name: "Ciencia ficción" },
  { id: 18, name: "Drama" },
  { id: 53, name: "Thriller" },
  { id: 27, name: "Terror" },
  { id: 35, name: "Comedia" },
  { id: 10749, name: "Romance" },
  { id: 14, name: "Fantasía" },
  { id: 28, name: "Acción" },
  { id: 16, name: "Animación" },
  { id: 9648, name: "Misterio" },
  { id: 12, name: "Aventura" },
  { id: 99, name: "Documental" },
]);

export const PROFILE_PREFERRED_GENRE_IDS_FIXTURE =
  UpdatePreferencesRequestSchema.parse({
    preferredGenreIds: [878, 18, 53],
  }).preferredGenreIds;

export const PROFILE_FIXTURE = {
  displayName: "Sofía Ramírez",
  email: "sofia.ramirez@correo.com",
  initials: "SR",
  preferredGenreIds: PROFILE_PREFERRED_GENRE_IDS_FIXTURE,
  activity: [
    { label: "Me gusta", value: 10, tone: "primary" },
    { label: "Vistas", value: 6, tone: "default" },
    { label: "Reseñas", value: 1, tone: "default" },
  ],
} as const;
