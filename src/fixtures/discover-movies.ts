import { DiscoverResponseSchema } from "@/contracts/discover";

export const DISCOVER_MOVIES_FIXTURE = DiscoverResponseSchema.parse({
  data: {
    movies: [
      {
        id: 438631,
        title: "Dune",
        originalTitle: "Dune",
        overview:
          "Paul Atreides debe viajar al planeta más peligroso del universo para asegurar el futuro de su familia y de su pueblo.",
        posterPath: "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
        backdropPath: "/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
        genreIds: [878, 12],
        releaseDate: "2021-09-15",
        originalLanguage: "en",
        tmdbRating: 7.8,
        tmdbVoteCount: 13400,
      },
      {
        id: 329865,
        title: "La llegada",
        originalTitle: "Arrival",
        overview:
          "Una lingüista intenta comprender a visitantes extraterrestres antes de que la tensión global desencadene un conflicto.",
        posterPath: "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg",
        backdropPath: null,
        genreIds: [18, 878, 9648],
        releaseDate: "2016-11-10",
        originalLanguage: "en",
        tmdbRating: 7.6,
        tmdbVoteCount: 18400,
      },
      {
        id: 335984,
        title: "Blade Runner 2049",
        originalTitle: "Blade Runner 2049",
        overview:
          "Un nuevo blade runner descubre un secreto capaz de alterar el orden social y sale en busca de una leyenda perdida.",
        posterPath: "/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg",
        backdropPath: "/ilRyazdMJwN05exqhwK4tMKBYZs.jpg",
        genreIds: [18, 878, 53],
        releaseDate: "2017-10-04",
        originalLanguage: "en",
        tmdbRating: 7.6,
        tmdbVoteCount: 13700,
      },
      {
        id: 545611,
        title: "Todo en todas partes al mismo tiempo",
        originalTitle: "Everything Everywhere All at Once",
        overview:
          "Una mujer común atraviesa múltiples universos para salvar lo que ama y reconectar con su familia.",
        posterPath: "/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
        backdropPath: "/ss0Os3uWJfQAENILHZUdX8Tt1OC.jpg",
        genreIds: [28, 12, 878],
        releaseDate: "2022-03-24",
        originalLanguage: "en",
        tmdbRating: 7.7,
        tmdbVoteCount: 7200,
      },
      {
        id: 129,
        title: "El viaje de Chihiro",
        originalTitle: "千と千尋の神隠し",
        overview:
          "Una niña entra en un mundo de espíritus y debe encontrar el valor para volver a casa junto a sus padres.",
        posterPath: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
        backdropPath: "/Ab8mkHmkYADjU7wQiOkia9BzGvS.jpg",
        genreIds: [16, 14, 10751],
        releaseDate: "2001-07-20",
        originalLanguage: "ja",
        tmdbRating: 8.5,
        tmdbVoteCount: 17100,
      },
    ],
    batchSize: 20,
    returned: 5,
  },
});
