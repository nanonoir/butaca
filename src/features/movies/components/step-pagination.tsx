import { BUTTON_VARIANT, Button } from "@/components/ui/button";

interface StepPaginationProps {
  page: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  disabled?: boolean;
  label?: string;
  onPrevious: () => void;
  onNext: () => void;
}

/** One step at a time, with the page you are on between the two moves.
 *
 * The alternative -- a row of numbered pages -- spends its width on jumps
 * almost nobody makes, and spends the most of it on the narrow screens that
 * can least afford it. Two buttons stay the same size at any page count. */
export function StepPagination({
  page,
  hasPreviousPage,
  hasNextPage,
  disabled = false,
  label = "Paginación de resultados",
  onPrevious,
  onNext,
}: StepPaginationProps) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-3">
      <Button
        aria-label="Página anterior"
        disabled={disabled || !hasPreviousPage}
        onClick={onPrevious}
        variant={BUTTON_VARIANT.OUTLINE}
      >
        Atrás
      </Button>
      <p aria-live="polite" className="text-sm text-muted">
        Página {page}
      </p>
      <Button
        aria-label="Página siguiente"
        disabled={disabled || !hasNextPage}
        onClick={onNext}
        variant={BUTTON_VARIANT.OUTLINE}
      >
        Continuar
      </Button>
    </nav>
  );
}
