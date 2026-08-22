import Image from "next/image";

import { PageHeader } from "@/components/shared/page-header";

const PRODUCT_PILLARS = [
  {
    title: "Descubrí",
    copy: "Recorré una selección de películas que se ajusta a tus gustos.",
  },
  {
    title: "Guardá tu historia",
    copy: "Me gusta, No me gusta y Vista registran tus preferencias sin mezclar reacción y visualización.",
  },
  {
    title: "Preguntale a Buti",
    copy: "Transformá una intención o un ánimo en recomendaciones concretas.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 py-4 md:py-8">
      <PageHeader eyebrow="Butaca" title="Acerca de Butaca" />

      <section aria-labelledby="about-product-title" className="max-w-3xl">
        <h2 className="sr-only" id="about-product-title">
          Qué es Butaca
        </h2>
        <p className="text-base leading-7 text-muted">
          Encontrá tu próxima película sin perderte en el catálogo. Butaca
          combina tus géneros, reacciones y películas vistas para ordenar
          recomendaciones personales; Buti te ayuda a afinarlas conversando.
        </p>
      </section>

      <section aria-labelledby="about-pillars-title" className="space-y-6">
        <h2
          className="font-display text-2xl font-medium tracking-[-0.02em] text-foreground"
          id="about-pillars-title"
        >
          Una experiencia que aprende de vos
        </h2>
        <ul
          aria-label="Cómo te acompaña Butaca"
          className="grid gap-4 md:grid-cols-3"
        >
          {PRODUCT_PILLARS.map(({ title, copy }, index) => (
            <li
              className="rounded-lg border border-border bg-surface-muted p-5 md:p-6"
              key={title}
            >
              <span className="font-mono text-xs tracking-[0.14em] text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-5 font-display text-xl font-medium tracking-[-0.02em] text-foreground">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tmdb-title" className="space-y-6">
        <h2
          className="font-display text-2xl font-medium tracking-[-0.02em] text-foreground"
          id="tmdb-title"
        >
          Información cinematográfica
        </h2>
        <div className="grid gap-8 rounded-lg border border-border bg-surface-muted p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:items-center md:p-6">
          <div
            className="relative w-full max-w-[24rem]"
            style={{ aspectRatio: "489.04 / 35.4" }}
          >
            <Image
              alt="The Movie Database (TMDB)"
              className="object-contain object-left"
              fill
              sizes="(min-width: 768px) 24rem, calc(100vw - 3rem)"
              src="/tmdb-logo.svg"
            />
          </div>
          <div className="space-y-3 text-sm leading-6 text-muted">
            <p>
              This product uses the TMDB API but is not endorsed or certified by
              TMDB.
            </p>
            <p>Movie information and images provided by TMDB.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
