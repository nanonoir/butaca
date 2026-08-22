import type { MetadataRoute } from "next";

/** The two android-chrome sizes in `public/favicon` exist for this and nothing
 * else, so without a manifest they would sit unused. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Butaca",
    short_name: "Butaca",
    description: "Descubrimiento de películas y recomendaciones personales.",
    start_url: "/",
    display: "standalone",
    background_color: "#070811",
    theme_color: "#b9a5ff",
    icons: [
      {
        src: "/favicon/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
