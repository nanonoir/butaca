"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";

import { AVATAR_SIZE, Avatar } from "@/components/ui/avatar";
import { BUTTON_VARIANT, CONTROL_SIZE, Button } from "@/components/ui/button";

import {
  PROFILE_AVATAR_COLORS,
  PROFILE_AVATAR_FILE_ACCEPT,
  ProfileAvatarChoiceSchema,
  getProfileAvatarFileError,
  type ProfileAvatarChoice,
} from "./profile-avatar-choice";
import { writeProfileAvatarChoice } from "./profile-avatar-session";
import { useProfileAvatarSession } from "./use-profile-avatar-session";

interface ProfileAvatarEditorProps {
  displayName: string;
  email: string;
  initials: string;
}

interface Feedback {
  tone: "success" | "error";
  message: string;
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20" fill="none">
      <path
        d="M6.8 5.5 8 3.8h4l1.2 1.7h1.9A1.9 1.9 0 0 1 17 7.4v7a1.9 1.9 0 0 1-1.9 1.9H4.9A1.9 1.9 0 0 1 3 14.4v-7a1.9 1.9 0 0 1 1.9-1.9h1.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle
        cx="10"
        cy="10.5"
        r="2.7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 12.5V16h12v-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function readPhotoChoice(file: File) {
  return new Promise<ProfileAvatarChoice>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = ProfileAvatarChoiceSchema.safeParse({
        kind: "photo",
        dataUrl: reader.result,
      });

      if (result.success) {
        resolve(result.data);
      } else {
        reject(new Error("Invalid avatar data URL"));
      }
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export function ProfileAvatarEditor({
  displayName,
  email,
  initials,
}: ProfileAvatarEditorProps) {
  const editorId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionChoice = useProfileAvatarSession();
  const [isOpen, setIsOpen] = useState(false);
  const [choiceOverride, setChoiceOverride] =
    useState<ProfileAvatarChoice | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const choice = choiceOverride ?? sessionChoice;
  const selectedColor =
    choice.kind === "color"
      ? PROFILE_AVATAR_COLORS.find((color) => color.id === choice.colorId)
      : undefined;

  function openEditor() {
    setIsOpen(true);
  }

  function closeEditor() {
    setIsOpen(false);
    setFeedback(null);
  }

  function applyChoice(nextChoice: ProfileAvatarChoice) {
    setChoiceOverride(nextChoice);
    const persisted = writeProfileAvatarChoice(
      window.sessionStorage,
      nextChoice,
    );

    setFeedback(
      persisted
        ? { tone: "success", message: "Avatar actualizado" }
        : {
            tone: "error",
            message: "No pudimos conservar el avatar en esta sesión.",
          },
    );
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";

    if (!file) {
      return;
    }

    const validationError = getProfileAvatarFileError(file);

    if (validationError) {
      setFeedback({ tone: "error", message: validationError });
      return;
    }

    try {
      applyChoice(await readPhotoChoice(file));
    } catch {
      setFeedback({
        tone: "error",
        message: "No pudimos leer esa imagen. Intentá de nuevo.",
      });
    }
  }

  return (
    <header>
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-5">
        <button
          type="button"
          aria-controls={editorId}
          aria-expanded={isOpen}
          aria-label="Cambiar avatar"
          className="relative shrink-0 rounded-full transition-transform duration-fast ease-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:active:scale-[0.97]"
          data-motion-transform
          onClick={openEditor}
        >
          <Avatar
            alt={displayName}
            className={selectedColor?.avatarClassName}
            initials={initials}
            size={AVATAR_SIZE.LG}
            src={choice.kind === "photo" ? choice.dataUrl : undefined}
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full border-[3px] border-surface bg-primary text-primary-foreground">
            <CameraIcon />
          </span>
        </button>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.025em] text-foreground">
              {displayName}
            </h1>
            <Button
              className={
                isOpen
                  ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary"
                  : "text-primary ring-1 ring-inset ring-transparent transition-[background-color,border-color,box-shadow,color,transform]! hover:border-transparent! hover:bg-transparent! hover:text-primary! hover:ring-primary"
              }
              onClick={isOpen ? closeEditor : openEditor}
              size={CONTROL_SIZE.SM}
              variant={BUTTON_VARIANT.GHOST}
            >
              {isOpen ? "Listo" : "Cambiar"}
            </Button>
          </div>
          <p className="mt-1 break-words text-base text-muted">{email}</p>
        </div>
      </div>

      {isOpen ? (
        <div
          id={editorId}
          aria-label="Opciones de avatar"
          className="mt-5 rounded-xl border border-border bg-surface-elevated p-4 sm:p-5"
          role="group"
        >
          <div className="flex flex-wrap items-center gap-3">
            {PROFILE_AVATAR_COLORS.map((color) => (
              <Button
                key={color.id}
                aria-label={`Usar color ${color.label}`}
                aria-pressed={
                  choice.kind === "color" && choice.colorId === color.id
                }
                className="size-14! rounded-full border-2 border-transparent p-1! aria-pressed:border-primary! aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface-elevated"
                onClick={() =>
                  applyChoice({ kind: "color", colorId: color.id })
                }
                size={CONTROL_SIZE.LG}
                variant={BUTTON_VARIANT.ICON}
              >
                <Avatar
                  alt={`Vista previa ${color.label}`}
                  className={color.avatarClassName}
                  initials={initials}
                  size={AVATAR_SIZE.MD}
                />
              </Button>
            ))}

            <span
              aria-hidden="true"
              className="mx-1 hidden h-10 w-px bg-border sm:block"
            />

            <input
              ref={fileInputRef}
              aria-label="Seleccionar foto de perfil"
              accept={PROFILE_AVATAR_FILE_ACCEPT}
              className="sr-only"
              onChange={handleFileChange}
              tabIndex={-1}
              type="file"
            />
            <Button
              className="rounded-full border-dashed px-5 text-base"
              onClick={() => fileInputRef.current?.click()}
              size={CONTROL_SIZE.LG}
              variant={BUTTON_VARIANT.OUTLINE}
            >
              <UploadIcon />
              Subir foto
            </Button>
          </div>

          {feedback ? (
            <p
              className="mt-4 text-sm text-primary"
              role={feedback.tone === "error" ? "alert" : "status"}
            >
              {feedback.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
