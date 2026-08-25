/** The id carries the identity and the slug is for the person reading the
 * address bar. Keeping them apart is what makes the link durable: titles are
 * localised and change under us -- the catalogue moved from one Spanish
 * variant to another and every slug moved with it -- and two different films
 * share a title often enough to matter. A wrong slug still resolves, and gets
 * corrected on arrival. */
export function toMovieSlug(title: string): string {
  return title
    .normalize("NFD")
    // Combining marks, built from codepoints so the range stays readable in
    // a source file rather than being an invisible span of accents.
    .replace(
      new RegExp(
        `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
        "g",
      ),
      "",
    )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function movieDetailPath(movieId: number, title: string): string {
  const slug = toMovieSlug(title);

  return slug ? `/movies/${movieId}/${slug}` : `/movies/${movieId}`;
}
