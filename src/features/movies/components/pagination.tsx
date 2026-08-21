import { BUTTON_VARIANT, Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}

function getVisiblePages(page: number, totalPages: number) {
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const lastPage = Math.min(totalPages, firstPage + 4);

  return Array.from(
    { length: lastPage - firstPage + 1 },
    (_, index) => firstPage + index,
  );
}

export function Pagination({
  page,
  totalPages,
  hasNextPage,
  disabled = false,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <nav aria-label="Paginación de resultados" className="flex flex-wrap gap-2">
      <Button
        aria-label="Página anterior"
        disabled={disabled || page === 1}
        onClick={() => onPageChange(page - 1)}
        variant={BUTTON_VARIANT.OUTLINE}
      >
        Anterior
      </Button>
      {visiblePages.map((visiblePage) => (
        <Button
          aria-current={visiblePage === page ? "page" : undefined}
          aria-label={`Página ${visiblePage}`}
          disabled={disabled || visiblePage === page}
          key={visiblePage}
          onClick={() => onPageChange(visiblePage)}
          variant={
            visiblePage === page
              ? BUTTON_VARIANT.PRIMARY
              : BUTTON_VARIANT.OUTLINE
          }
        >
          {visiblePage}
        </Button>
      ))}
      <Button
        aria-label="Página siguiente"
        disabled={disabled || !hasNextPage}
        onClick={() => onPageChange(page + 1)}
        variant={BUTTON_VARIANT.OUTLINE}
      >
        Siguiente
      </Button>
    </nav>
  );
}
