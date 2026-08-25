"use client";

import { useId, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Avatar } from "@/components/ui/avatar";
import { BUTTON_VARIANT, CONTROL_SIZE, Button } from "@/components/ui/button";
import { Pagination } from "@/features/movies/components/pagination";
import {
  UpsertReviewRequestSchema,
  type Review,
  type ReviewSummary,
  type ReviewVerdict,
  type UpsertReviewRequest,
} from "@/contracts/reviews";

export type ReviewEditorMode = "create" | "edit" | null;

const REVIEW_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Three at a time, like the similar movies. A review is a block of text
 * rather than a tile, so a dozen of them turn the page into a scroll with the
 * rest of the detail stranded above it. */
const REVIEWS_PER_PAGE = 3;

interface MovieReviewsProps {
  summary: ReviewSummary;
  publicReviews: Review[];
  myReview: Review | null;
  editorMode: ReviewEditorMode;
  onCloseEditor: () => void;
  onDeleteReview: () => void;
  onOpenCreate: () => void;
  onOpenEdit: () => void;
  onSaveReview: (review: UpsertReviewRequest) => void;
}

function ThumbIcon({
  className,
  direction = "up",
}: {
  className?: string;
  direction?: "up" | "down";
}) {
  return (
    <svg
      aria-hidden="true"
      className={`${className ?? ""} ${direction === "down" ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7.7 10.1 11.4 4c.5-.8 1.7-.5 1.7.5v4.3h4.8c1.2 0 2.1 1.1 1.8 2.3l-1.4 6.1c-.2.8-.9 1.4-1.8 1.4H7.7m0-8.5v8.5H4.9a.9.9 0 0 1-.9-.9V11c0-.5.4-.9.9-.9h2.8Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m4 20 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Zm9.8-12.6 3 3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m6.5 6.5 11 11m0-11-11 11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function formatReviewDate(value: string) {
  return REVIEW_DATE_FORMATTER.format(new Date(value));
}

function Verdict({ verdict }: { verdict: ReviewVerdict }) {
  const recommended = verdict === "RECOMMENDED";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${recommended ? "text-primary" : "text-muted"}`}
    >
      <ThumbIcon className="size-3.5" direction={recommended ? "up" : "down"} />
      {recommended ? "Recomienda" : "No la recomienda"}
    </span>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article
      aria-label={`Reseña de ${review.author.displayName}`}
      className="border-t border-border py-6 first:border-t-0 first:pt-0"
    >
      <header className="flex items-start gap-3">
        <Avatar
          alt={review.author.displayName}
          className="bg-surface-elevated! text-muted! ring-1 ring-border"
          initials={getInitials(review.author.displayName)}
          size="sm"
          src={review.author.avatarUrl ?? undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="font-display text-base font-semibold text-foreground">
              {review.author.displayName}
            </h3>
            <Verdict verdict={review.verdict} />
          </div>
        </div>
        <time
          className="shrink-0 font-mono text-[0.625rem] text-muted-foreground"
          dateTime={review.createdAt}
        >
          {formatReviewDate(review.createdAt)}
        </time>
      </header>
      <h4 className="mt-4 font-display text-base font-semibold text-foreground">
        {review.title}
      </h4>
      <p className="mt-2 text-sm leading-6 text-muted">{review.description}</p>
    </article>
  );
}

function CommunitySummary({ summary }: { summary: ReviewSummary }) {
  const rate = summary.recommendationRate ?? 0;

  return (
    <section aria-labelledby="community-heading">
      <h2
        className="font-mono text-xs uppercase tracking-[0.14em] text-muted"
        id="community-heading"
      >
        La comunidad
      </h2>
      <div className="mt-4 rounded-xl border border-border bg-surface-elevated p-5 sm:p-6">
        {summary.total > 0 ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <strong className="font-display text-4xl font-semibold tracking-[-0.03em] text-primary">
                {rate}%
              </strong>
              <span className="text-sm font-medium text-foreground">
                la recomienda
              </span>
            </div>
            <div
              aria-label={`${rate}% recomienda esta película`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={rate}
              className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${rate}%` }}
              />
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              {summary.total} reseñas
            </p>
          </>
        ) : (
          <p className="text-sm leading-6 text-muted">
            Todavía no hay reseñas. Podés ser la primera persona en compartir
            una.
          </p>
        )}
      </div>
    </section>
  );
}

function OwnReview({
  review,
  onDelete,
  onEdit,
}: {
  review: Review;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <article
      aria-label="Tu reseña"
      className="rounded-xl border border-primary/35 bg-primary/7 p-5 sm:p-6"
    >
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">
        Tu reseña
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Verdict verdict={review.verdict} />
        <div className="flex items-center gap-1">
          <Button
            aria-label="Editar"
            className="px-3 text-xs hover:bg-transparent hover:text-primary"
            onClick={onEdit}
            size={CONTROL_SIZE.SM}
            variant={BUTTON_VARIANT.GHOST}
          >
            Editar
          </Button>
          <Button
            aria-label="Eliminar"
            className="px-3 text-xs hover:bg-transparent hover:text-primary"
            onClick={onDelete}
            size={CONTROL_SIZE.SM}
            variant={BUTTON_VARIANT.GHOST}
          >
            Eliminar
          </Button>
        </div>
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
        {review.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted">{review.description}</p>
    </article>
  );
}

function ReviewEditor({
  initialReview,
  mode,
  onClose,
  onSave,
}: {
  initialReview: Review | null;
  mode: Exclude<ReviewEditorMode, null>;
  onClose: () => void;
  onSave: (review: UpsertReviewRequest) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const [verdict, setVerdict] = useState<ReviewVerdict | null>(
    initialReview?.verdict ?? null,
  );
  const [title, setTitle] = useState(initialReview?.title ?? "");
  const [description, setDescription] = useState(
    initialReview?.description ?? "",
  );
  const draft = { verdict, title, description };
  const isValid = UpsertReviewRequestSchema.safeParse(draft).success;
  const heading = mode === "edit" ? "Editar reseña" : "Escribir reseña";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = UpsertReviewRequestSchema.safeParse(draft);

    if (result.success) {
      onSave(result.data);
    }
  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.08 : 0.18 }}
    >
      <button
        aria-label="Cerrar editor de reseña"
        className="absolute inset-0 size-full bg-overlay backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <motion.section
        aria-label={heading}
        aria-modal="true"
        animate={{ transform: "translate3d(0, 0, 0)" }}
        className="relative z-10 max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-xl border border-border bg-surface-elevated p-5 shadow-floating sm:rounded-xl sm:p-7"
        initial={
          shouldReduceMotion
            ? undefined
            : { transform: "translate3d(0, 1.5rem, 0)" }
        }
        role="dialog"
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">
              Tu opinión
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
              {heading}
            </h2>
          </div>
          <Button
            aria-label="Cerrar"
            autoFocus
            className="rounded-full border border-border"
            onClick={onClose}
            variant={BUTTON_VARIANT.ICON}
          >
            <CloseIcon className="size-5" />
          </Button>
        </div>

        <form className="mt-7 space-y-6" onSubmit={handleSubmit}>
          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              ¿La recomendarías?
            </legend>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(
                [
                  ["RECOMMENDED", "Recomiendo", "up"],
                  ["NOT_WORTH_IT", "No vale la pena", "down"],
                ] as const
              ).map(([value, label, direction]) => {
                const selected = verdict === value;

                return (
                  <Button
                    aria-pressed={selected}
                    className={`min-h-16 rounded-lg px-3 ${selected ? "border-primary bg-primary/12 text-primary hover:bg-primary/12" : "text-muted hover:border-primary hover:bg-transparent hover:text-primary"}`}
                    key={value}
                    onClick={() => setVerdict(value)}
                    variant={BUTTON_VARIANT.OUTLINE}
                  >
                    <ThumbIcon className="size-5" direction={direction} />
                    {label}
                  </Button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <div className="flex items-center justify-between gap-4">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor={titleId}
              >
                Título
              </label>
              <span className="font-mono text-[0.625rem] text-muted-foreground">
                {title.length} / 30
              </span>
            </div>
            <input
              className="mt-2 min-h-11 w-full rounded-lg border border-input bg-surface-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-fast ease-ui placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40"
              id={titleId}
              maxLength={30}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Resumí tu opinión"
              value={title}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor={descriptionId}
              >
                Reseña
              </label>
              <span className="font-mono text-[0.625rem] text-muted-foreground">
                {description.length} / 400
              </span>
            </div>
            <textarea
              className="mt-2 min-h-36 w-full resize-y rounded-lg border border-input bg-surface-muted px-4 py-3 text-sm leading-6 text-foreground outline-none transition-[border-color,box-shadow] duration-fast ease-ui placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40"
              id={descriptionId}
              maxLength={400}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Contá qué te gustó o qué no funcionó"
              value={description}
            />
          </div>

          <Button className="w-full" disabled={!isValid} type="submit">
            Publicar reseña
          </Button>
        </form>
      </motion.section>
    </motion.div>
  );
}

export function MovieReviews({
  summary,
  publicReviews,
  myReview,
  editorMode,
  onCloseEditor,
  onDeleteReview,
  onOpenCreate,
  onOpenEdit,
  onSaveReview,
}: MovieReviewsProps) {
  const [reviewsPage, setReviewsPage] = useState(1);
  const totalReviewPages = Math.ceil(publicReviews.length / REVIEWS_PER_PAGE);
  const visibleReviews = publicReviews.slice(
    (reviewsPage - 1) * REVIEWS_PER_PAGE,
    reviewsPage * REVIEWS_PER_PAGE,
  );
  return (
    <div className="space-y-5">
      <CommunitySummary summary={summary} />

      {myReview ? (
        <OwnReview
          onDelete={onDeleteReview}
          onEdit={onOpenEdit}
          review={myReview}
        />
      ) : (
        <Button
          className="w-full border-border hover:border-primary hover:bg-transparent hover:text-primary"
          onClick={onOpenCreate}
          size={CONTROL_SIZE.LG}
          variant={BUTTON_VARIANT.OUTLINE}
        >
          <PencilIcon className="size-4" />
          Escribir reseña
        </Button>
      )}

      <section aria-labelledby="public-reviews-heading" className="pt-2">
        {/* Beside the heading rather than under the list. A pager at the foot
         * moves out from under the pointer as the reviews it swapped resize,
         * and leaves the reader at the bottom of something they have not read
         * yet; up here the list refreshes below and is read from the top.
         * It also stops sitting level with the similar movies' own pager. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            className="font-mono text-xs uppercase tracking-[0.14em] text-muted"
            id="public-reviews-heading"
          >
            Reseñas
          </h2>
          {totalReviewPages > 1 ? (
            <Pagination
              hasNextPage={reviewsPage < totalReviewPages}
              label="Paginación de reseñas"
              onPageChange={setReviewsPage}
              page={reviewsPage}
              totalPages={totalReviewPages}
            />
          ) : null}
        </div>
        <div className="mt-4">
          {publicReviews.length > 0 ? (
            visibleReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          ) : (
            <p className="border-t border-border py-6 text-sm text-muted">
              Todavía no hay reseñas públicas.
            </p>
          )}
        </div>
      </section>

      <AnimatePresence>
        {editorMode ? (
          <ReviewEditor
            initialReview={myReview}
            key={editorMode}
            mode={editorMode}
            onClose={onCloseEditor}
            onSave={onSaveReview}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
