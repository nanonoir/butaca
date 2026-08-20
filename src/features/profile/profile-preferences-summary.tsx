"use client";

import { useRouter } from "next/navigation";

import { BUTTON_VARIANT, CONTROL_SIZE, Button } from "@/components/ui/button";
import type { Genre } from "@/contracts/movies";

import { useProfilePreferencesSession } from "./use-profile-preferences-session";

interface ProfilePreferencesSummaryProps {
  genreOptions: readonly Genre[];
  initialPreferredGenreIds: readonly number[];
}

export function ProfilePreferencesSummary({
  genreOptions,
  initialPreferredGenreIds,
}: ProfilePreferencesSummaryProps) {
  const router = useRouter();
  const selectedIds = useProfilePreferencesSession(
    genreOptions,
    initialPreferredGenreIds,
  );

  const selectedIdSet = new Set(selectedIds);
  const selectedGenres = genreOptions.filter((genre) =>
    selectedIdSet.has(genre.id),
  );

  return (
    <section aria-labelledby="profile-tastes-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id="profile-tastes-title"
          className="font-mono text-xs uppercase tracking-[0.14em] text-primary"
        >
          Mis gustos
        </h2>
        <Button
          className="self-start"
          onClick={() => router.push("/profile/preferences")}
          size={CONTROL_SIZE.LG}
          variant={BUTTON_VARIANT.OUTLINE}
        >
          Editar gustos
        </Button>
      </div>
      <ul aria-label="Géneros preferidos" className="mt-5 flex flex-wrap gap-3">
        {selectedGenres.map((genre) => (
          <li
            key={genre.id}
            className="rounded-full bg-secondary px-5 py-2.5 text-base font-medium text-foreground"
          >
            {genre.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
