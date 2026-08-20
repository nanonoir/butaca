import { PageHeader } from "@/components/shared/page-header";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 py-6 md:py-10">
      <PageHeader eyebrow="Para vos" title="Descubrir" />

      <section className="grid gap-8 border-b border-border pb-10 md:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)] md:items-end">
        <div className="max-w-2xl">
          <p className="font-display text-2xl leading-tight tracking-[-0.02em] text-foreground md:text-3xl">
            Películas elegidas para vos, una por una.
          </p>
          <p className="mt-4 max-w-prose text-base leading-7 text-muted">
            Esta vista todavía está en construcción.
          </p>
        </div>
        <p className="max-w-xs text-sm leading-6 text-muted-foreground md:justify-self-end">
          El espacio de descubrimiento estará disponible cuando esta vista esté
          lista.
        </p>
      </section>

      <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
        Implementación en curso
      </p>
    </div>
  );
}
