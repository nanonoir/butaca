# PRD — Movie Catalog Completion

## Overview

**Feature:** Movie Catalog Completion  
**Status:** Canonical Product Spec  
**Scope:** Inline movie search in Discover, catalog service completion, Similar Movies, and integration with the movie-detail modal  

---

## Product Decisions

| Topic | Decision |
|---|---|
| Search location | Embedded directly in the Discover screen. No separate `/search` page or navigation item. |
| Search trigger | Explicit submission only (Enter key or search button). Typing MUST NOT trigger API requests. |
| Search presentation | Submitted results replace the Discover recommendation stack with a movie grid. |
| Search exit | Clearing or closing search restores the recommendation stack. |
| Search pagination | Numbered pagination (`PAGE_SIZE = 20`). No infinite scroll or load-more. |
| Movie detail navigation | Search and Similar Movies open the existing `MovieDetailScreen` modal. |
| Detail API shape | Aggregate `MovieDetailPageData` response. |
