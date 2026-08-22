"use client";

import { useRef, useState } from "react";

import type { MovieSummary, PaginationMeta } from "@/contracts";

export interface MovieSearchResults {
  data: MovieSummary[];
  meta: PaginationMeta;
}

export interface MovieSearchPort {
  (query: string, page: number): Promise<MovieSearchResults>;
}

/** Shared explicit-search state. Consumers retain ownership of selected movies
 * and any feature-specific presentation. */
export function useMovieSearch(fetchMovies: MovieSearchPort) {
  const [draft, setDraft] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [results, setResults] = useState<MovieSearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const requestId = useRef(0);

  function load(query: string, page: number) {
    const currentRequestId = ++requestId.current;
    setIsLoading(true);
    setHasError(false);

    void fetchMovies(query, page)
      .then(
        (nextResults) => {
          if (currentRequestId === requestId.current) {
            setResults(nextResults);
          }
        },
        () => {
          if (currentRequestId === requestId.current) {
            setHasError(true);
          }
        },
      )
      .finally(() => {
        if (currentRequestId === requestId.current) {
          setIsLoading(false);
        }
      });
  }

  function submit() {
    const query = draft.trim();

    if (!query) {
      return;
    }

    setSubmittedQuery(query);
    setResults(null);
    load(query, 1);
  }

  function changePage(page: number) {
    if (submittedQuery) {
      load(submittedQuery, page);
    }
  }

  function retry() {
    if (submittedQuery) {
      load(submittedQuery, results?.meta.page ?? 1);
    }
  }

  function clear() {
    requestId.current += 1;
    setDraft("");
    setSubmittedQuery(null);
    setResults(null);
    setIsLoading(false);
    setHasError(false);
  }

  return {
    draft,
    submittedQuery,
    results,
    isLoading,
    hasError,
    setDraft,
    submit,
    changePage,
    retry,
    clear,
  };
}
