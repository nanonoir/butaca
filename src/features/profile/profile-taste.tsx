import type { TasteSummary } from "@/contracts/taste";

interface ProfileTasteProps {
  taste: TasteSummary;
}

function Chips({ items }: { items: readonly { id: number; name: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          className="rounded-full border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
          key={item.id}
        >
          {item.name}
        </li>
      ))}
    </ul>
  );
}

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {children}
    </div>
  );
}

/** What every batch of cards is built from, which until now the viewer only
 * ever saw the results of. */
export function ProfileTaste({ taste }: ProfileTasteProps) {
  if (!taste.hasEnough) {
    return (
      <p className="mt-4 rounded-xl border border-border bg-surface-elevated p-6 text-sm leading-6 text-muted">
        Todavía te estamos conociendo. Con{" "}
        {taste.likedCount === 1
          ? "una película marcada"
          : `${taste.likedCount} películas marcadas`}
        , cualquier cosa que dijéramos sobre tus gustos sería adivinar. Seguí
        marcando en Descubrir y esto se llena solo.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-6 rounded-xl border border-border bg-surface-elevated p-5 sm:p-6">
      {taste.genres.length > 0 ? (
        <Group hint="Ordenados por lo que más elegís." title="Tus géneros">
          <Chips items={taste.genres} />
        </Group>
      ) : null}

      {taste.actors.length > 0 ? (
        <Group
          hint="Aparecen una y otra vez en lo que marcás."
          title="Caras conocidas"
        >
          <Chips items={taste.actors} />
        </Group>
      ) : null}

      {taste.directors.length > 0 ? (
        <Group
          hint="Los que más se repiten detrás de cámara."
          title="Dirección"
        >
          <Chips items={taste.directors} />
        </Group>
      ) : null}

      {taste.avoidedGenres.length > 0 ? (
        <Group
          hint="Los dejamos afuera de tus recomendaciones. Si alguno no corresponde, marcá con me gusta alguna del género y vuelve."
          title="Lo que te estamos evitando"
        >
          {/* With the arithmetic beside it: a genre nobody can see the reason
           * for is a decree, and this one is the most likely to be wrong. */}
          <ul className="mt-2 space-y-2">
            {taste.avoidedGenres.map((genre) => (
              <li
                className="flex flex-wrap items-baseline gap-x-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm"
                key={genre.id}
              >
                <span className="text-foreground">{genre.name}</span>
                <span className="font-mono text-[0.625rem] tracking-[0.08em] text-muted">
                  {genre.disliked} no me gusta
                  {genre.liked > 0 ? ` · ${genre.liked} me gusta` : null}
                </span>
              </li>
            ))}
          </ul>
        </Group>
      ) : null}
    </div>
  );
}
