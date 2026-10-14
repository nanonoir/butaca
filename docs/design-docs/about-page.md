# Design: About Page & TMDB Attribution

## 1. Goal

Provide the product information and legal attribution screen (`/about`) satisfying TMDB API Terms of Use while maintaining consistent application shell styling.

## 2. Key Architectural Decisions

### 2.1 TMDB Attribution Compliance
- TMDB API requires clear product attribution stating that the product uses TMDB but is not endorsed or certified by TMDB.
- Features the official approved TMDB logo SVG (`public/tmdb-logo.svg`).
- Mentions direct TMDB catalog usage for movie discovery and metadata.

### 2.2 Server Component Architecture
- Static Server Component rendering inside the standard `AppShell` and `MainSurface`.
- Fully responsive layout with semantic tokens (`text-foreground`, `bg-surface`, `border-border`).
