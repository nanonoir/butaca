export const PROFILE_FIXTURE = {
  displayName: "Sofía Ramírez",
  email: "sofia.ramirez@correo.com",
  initials: "SR",
  preferredGenres: ["Ciencia ficción", "Drama", "Thriller"],
  activity: [
    { label: "Me gusta", value: 10, tone: "primary" },
    { label: "Vistas", value: 6, tone: "default" },
    { label: "Reseñas", value: 1, tone: "default" },
  ],
} as const;
