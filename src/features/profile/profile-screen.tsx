import { AVATAR_SIZE, Avatar } from "@/components/ui/avatar";
import { BUTTON_VARIANT, Button } from "@/components/ui/button";
import type { Genre } from "@/contracts/movies";

import { ProfilePreferencesSummary } from "./profile-preferences-summary";

interface ProfileActivityItem {
  label: string;
  value: number;
  tone: "primary" | "default";
}

export interface ProfileScreenProps {
  genreOptions: readonly Genre[];
  profile: {
    displayName: string;
    email: string;
    initials: string;
    preferredGenreIds: readonly number[];
    activity: readonly ProfileActivityItem[];
  };
}

interface SectionHeadingProps {
  id: string;
  children: string;
}

function SectionHeading({ id, children }: SectionHeadingProps) {
  return (
    <h2
      id={id}
      className="font-mono text-xs uppercase tracking-[0.14em] text-primary"
    >
      {children}
    </h2>
  );
}

function ActivityStat({
  item,
  divided,
}: {
  item: ProfileActivityItem;
  divided: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col px-3 py-5 sm:px-5 sm:py-7 ${divided ? "border-l border-border" : ""}`}
    >
      <dt className="order-2 mt-1 truncate text-sm text-muted">{item.label}</dt>
      <dd
        className={`order-1 font-display text-3xl font-semibold leading-none tracking-[-0.025em] sm:text-4xl ${item.tone === "primary" ? "text-primary" : "text-foreground"}`}
      >
        {item.value}
      </dd>
    </div>
  );
}

export function ProfileScreen({ genreOptions, profile }: ProfileScreenProps) {
  return (
    <div className="mx-auto w-full max-w-4xl py-2 md:py-0">
      <header className="flex min-w-0 items-center gap-5">
        <Avatar
          alt={profile.displayName}
          initials={profile.initials}
          size={AVATAR_SIZE.LG}
        />
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.025em] text-foreground">
            {profile.displayName}
          </h1>
          <p className="mt-1 break-words text-base text-muted">
            {profile.email}
          </p>
        </div>
      </header>

      <div className="mt-8 space-y-10">
        <ProfilePreferencesSummary
          genreOptions={genreOptions}
          initialPreferredGenreIds={profile.preferredGenreIds}
        />

        <section aria-labelledby="profile-activity-title">
          <SectionHeading id="profile-activity-title">
            Mi actividad
          </SectionHeading>
          <dl
            aria-label="Resumen de actividad"
            className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-surface-elevated"
          >
            {profile.activity.map((item, index) => (
              <ActivityStat key={item.label} item={item} divided={index > 0} />
            ))}
          </dl>
        </section>

        <section aria-labelledby="profile-account-title">
          <SectionHeading id="profile-account-title">Cuenta</SectionHeading>
          <Button
            className="mt-4 min-h-[4.375rem] w-full justify-start rounded-lg bg-surface-elevated px-5 text-base disabled:opacity-100"
            disabled
            variant={BUTTON_VARIANT.OUTLINE}
          >
            Cerrar sesión
          </Button>
        </section>
      </div>
    </div>
  );
}
