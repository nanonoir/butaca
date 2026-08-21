import { PageHeader } from "@/components/shared/page-header";
import { MoviePosterCard } from "@/components/shared/movie-poster-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const POSTER_TONE = {
  PRIMARY: "primary",
  MUTED: "muted",
} as const;

type PosterTone = (typeof POSTER_TONE)[keyof typeof POSTER_TONE];

const COLOR_ROLES = [
  { label: "Background", className: "bg-background" },
  { label: "Foreground", className: "bg-foreground" },
  { label: "Surface", className: "bg-surface" },
  { label: "Surface muted", className: "bg-surface-muted" },
  { label: "Surface elevated", className: "bg-surface-elevated" },
  { label: "Primary", className: "bg-primary" },
  { label: "Primary hover", className: "bg-primary-hover" },
  { label: "Primary foreground", className: "bg-primary-foreground" },
  { label: "Secondary", className: "bg-secondary" },
  { label: "Muted", className: "bg-muted" },
  { label: "Muted foreground", className: "bg-muted-foreground" },
  { label: "Border", className: "border-2 border-border bg-surface" },
  { label: "Input", className: "border-2 border-input bg-surface-muted" },
  { label: "Ring", className: "bg-surface ring-2 ring-ring" },
  { label: "Overlay", className: "bg-overlay" },
] as const;

function PosterPlaceholder({
  tone = POSTER_TONE.PRIMARY,
}: {
  tone?: PosterTone;
}) {
  return (
    <div
      className={`flex size-full items-end p-4 ${tone === POSTER_TONE.PRIMARY ? "bg-primary/15" : "bg-secondary"}`}
      data-testid="poster-placeholder"
    >
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
        Poster slot
      </span>
    </div>
  );
}

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="font-display text-2xl font-medium tracking-[-0.02em] text-foreground"
    >
      {children}
    </h2>
  );
}

export default function UIFoundationPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 py-4 md:py-8">
      <PageHeader
        eyebrow="Internal validation"
        title="UI Foundation"
        action={
          <span className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface-muted px-4 text-sm font-medium text-muted">
            Static contract
          </span>
        }
      />

      <section aria-labelledby="overview-title" className="max-w-3xl">
        <h2 id="overview-title" className="sr-only">
          Validation overview
        </h2>
        <p className="text-base leading-7 text-muted">
          A contributor surface for checking Butaca&apos;s semantic language,
          component contracts, shell geometry, keyboard focus, and
          reduced-motion behavior. This route contains no product data or
          feature logic.
        </p>
      </section>

      <section aria-labelledby="tokens-title" className="space-y-6">
        <SectionHeading id="tokens-title">Semantic roles</SectionHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {COLOR_ROLES.map(({ label, className }) => (
            <div
              key={label}
              className="overflow-hidden rounded-lg border border-border"
            >
              <div className={`h-14 ${className}`} data-testid="color-swatch" />
              <div className="bg-surface-muted px-4 py-3">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {className}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="controls-title" className="space-y-6">
        <SectionHeading id="controls-title">Controls and states</SectionHeading>
        <div className="grid gap-8 rounded-lg border border-border bg-surface-muted p-5 md:grid-cols-2 md:p-6">
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">
              Button variants
            </p>
            <div className="flex flex-wrap gap-3">
              <Button>Primary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="icon" aria-label="Open preview">
                <span aria-hidden="true">+</span>
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">Input states</p>
            <Input label="Search" placeholder="Type to inspect focus" />
            <Input
              label="Invalid"
              defaultValue="Needs attention"
              invalid
              error="Review this value."
            />
            <Input label="Disabled" placeholder="Unavailable" disabled />
          </div>
        </div>
      </section>

      <section aria-labelledby="identity-title" className="space-y-6">
        <SectionHeading id="identity-title">
          Typography and identity
        </SectionHeading>
        <div className="grid gap-8 rounded-lg border border-border bg-surface-muted p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-6">
          <div>
            <p className="font-display text-4xl font-semibold leading-none tracking-[-0.035em] text-foreground">
              Bricolage for presence.
            </p>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted">
              Instrument Sans keeps interface copy readable, while Space Mono
              identifies metadata and inspection labels.
            </p>
          </div>
          <div className="flex items-center gap-3" aria-label="Avatar sizes">
            <Avatar initials="BT" alt="Butaca team, small" size="sm" />
            <Avatar initials="BT" alt="Butaca team, medium" />
            <Avatar
              src="/window.svg"
              initials="BT"
              alt="Local image rendering example"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="components-title" className="space-y-6">
        <SectionHeading id="components-title">Shared components</SectionHeading>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <MoviePosterCard
            title="Presentation card"
            year="Example year"
            poster={<PosterPlaceholder />}
            presentationSlot={
              <Button size="sm" variant="outline">
                View
              </Button>
            }
          />
          <MoviePosterCard
            title="Without optional year"
            poster={<PosterPlaceholder tone="muted" />}
          />
        </div>
      </section>

      <section aria-labelledby="shell-title" className="space-y-6">
        <SectionHeading id="shell-title">
          Shell and motion checks
        </SectionHeading>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [
              "Navigation",
              "Desktop labels reveal on hover and focus. Mobile labels stay visible.",
            ],
            [
              "Keyboard",
              "Tab through the controls to inspect the visible focus ring and order.",
            ],
            [
              "Reduced motion",
              "The shell removes translation and scale while retaining state feedback.",
            ],
          ].map(([label, copy]) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-surface-muted p-5"
            >
              <h3 className="font-medium text-foreground">{label}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
