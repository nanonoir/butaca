"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BUTTON_VARIANT, CONTROL_SIZE, Button } from "@/components/ui/button";
import type { Genre } from "@/contracts/movies";
import { UpdatePreferencesRequestSchema } from "@/contracts/preferences";

import { writePreferredGenreIds } from "./profile-preferences-session";
import { useProfilePreferencesSession } from "./use-profile-preferences-session";

interface EditProfilePreferencesScreenProps {
  genreOptions: readonly Genre[];
  initialPreferredGenreIds: readonly number[];
}

function BackIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20" fill="none">
      <path
        d="m12.5 4.5-5 5.5 5 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20" fill="none">
      <path
        d="m4.5 10 3.25 3.25 7.75-7.75"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getSelectionLabel(count: number) {
  return `${count} ${count === 1 ? "seleccionado" : "seleccionados"}`;
}

export function EditProfilePreferencesScreen({
  genreOptions,
  initialPreferredGenreIds,
}: EditProfilePreferencesScreenProps) {
  const router = useRouter();
  const sessionSelectedIds = useProfilePreferencesSession(
    genreOptions,
    initialPreferredGenreIds,
  );
  const [selectionOverride, setSelectionOverride] = useState<number[] | null>(
    null,
  );
  const [storageError, setStorageError] = useState<string | null>(null);
  const selectedIds = selectionOverride ?? sessionSelectedIds;

  const validationResult = UpdatePreferencesRequestSchema.safeParse({
    preferredGenreIds: selectedIds,
  });
  const selectedIdSet = new Set(selectedIds);

  function toggleGenre(genreId: number) {
    setStorageError(null);
    setSelectionOverride((currentOverride) => {
      const currentIds = currentOverride ?? sessionSelectedIds;

      return currentIds.includes(genreId)
        ? currentIds.filter((currentId) => currentId !== genreId)
        : [...currentIds, genreId];
    });
  }

  function savePreferences() {
    if (!validationResult.success) {
      return;
    }

    setStorageError(null);
    const saved = writePreferredGenreIds(
      window.sessionStorage,
      validationResult.data.preferredGenreIds,
    );

    if (!saved) {
      setStorageError("No pudimos guardar tus gustos. Intentá de nuevo.");
      return;
    }

    router.push("/profile");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-3xl flex-col py-1 md:min-h-[calc(100dvh-5rem)] md:py-0">
      <Link
        href="/profile"
        className="inline-flex min-h-11 self-start items-center gap-2 rounded-md px-2 text-sm font-medium text-muted transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <BackIcon />
        Perfil
      </Link>

      <header className="mt-5">
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-4xl">
          Editar gustos
        </h1>
        <p id="genre-guidance" className="mt-3 text-base text-muted sm:text-lg">
          Agregá o quitá géneros. Mínimo 2.
        </p>
      </header>

      <div
        aria-describedby="genre-guidance"
        aria-label="Géneros disponibles"
        className="mt-8 flex flex-wrap gap-3"
        role="group"
      >
        {genreOptions.map((genre) => {
          const selected = selectedIdSet.has(genre.id);

          return (
            <Button
              key={genre.id}
              aria-pressed={selected}
              className="rounded-full border-border px-6 text-base aria-pressed:border-primary! aria-pressed:bg-primary/15 aria-pressed:text-primary aria-pressed:hover:bg-primary/20"
              onClick={() => toggleGenre(genre.id)}
              size={CONTROL_SIZE.LG}
              variant={BUTTON_VARIANT.OUTLINE}
            >
              {selected ? <CheckIcon /> : null}
              {genre.name}
            </Button>
          );
        })}
      </div>

      <div className="mt-auto border-t border-border pt-5">
        <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-6">
          <p
            aria-live="polite"
            className="font-mono text-xs tracking-[0.08em] text-muted"
          >
            {getSelectionLabel(selectedIds.length)}
          </p>
          <Button
            className="min-h-[4.375rem] w-full rounded-xl text-base font-semibold sm:ml-auto sm:max-w-[33rem]"
            disabled={!validationResult.success}
            onClick={savePreferences}
            size={CONTROL_SIZE.LG}
          >
            Guardar cambios
          </Button>
        </div>
        {storageError ? (
          <p aria-live="assertive" className="mt-3 text-sm text-primary">
            {storageError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
