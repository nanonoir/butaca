import type { Genre } from "@/contracts/movies";
import type { MyReview } from "@/contracts/profile";

import { LogoutButton } from "./logout-button";
import { ProfileAvatarEditor } from "./profile-avatar-editor";
import { ProfilePreferencesSummary } from "./profile-preferences-summary";
import { ProfileReviews } from "./profile-reviews";

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
    reviews: MyReview[];
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
      <ProfileAvatarEditor
        displayName={profile.displayName}
        email={profile.email}
        initials={profile.initials}
      />

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

        <section aria-labelledby="profile-reviews-title">
          <SectionHeading id="profile-reviews-title">
            Mis reseñas
          </SectionHeading>
          <ProfileReviews reviews={profile.reviews} />
        </section>

        <section aria-labelledby="profile-account-title">
          <SectionHeading id="profile-account-title">Cuenta</SectionHeading>
          <LogoutButton />
        </section>
      </div>
    </div>
  );
}
