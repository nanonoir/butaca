import { describe, expect, it } from "vitest";

import { movieDetailPath, toMovieSlug } from "./movie-slug";

describe("toMovieSlug", () => {
  it("strips the accents a Spanish catalogue is full of", () => {
    expect(toMovieSlug("El código enigma")).toBe("el-codigo-enigma");
    expect(toMovieSlug("Parásitos")).toBe("parasitos");
  });

  it("collapses punctuation instead of carrying it into the address", () => {
    expect(toMovieSlug("Blade Runner 2049")).toBe("blade-runner-2049");
    expect(toMovieSlug("¿Bailamos?")).toBe("bailamos");
    expect(toMovieSlug("Batman: El caballero de la noche")).toBe(
      "batman-el-caballero-de-la-noche",
    );
  });

  /** A title in a script with no Latin letters leaves nothing to slug, and the
   * path has to stay valid anyway. */
  it("gives back nothing when a title has nothing to slug", () => {
    expect(toMovieSlug("홀리데이")).toBe("");
    expect(movieDetailPath(603, "홀리데이")).toBe("/movies/603");
  });

  it("builds the path the id leads", () => {
    expect(movieDetailPath(335984, "Blade Runner 2049")).toBe(
      "/movies/335984/blade-runner-2049",
    );
  });
});
