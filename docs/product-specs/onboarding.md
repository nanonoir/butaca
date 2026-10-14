# PRD — Onboarding

## 1. Product Intent

Onboarding initializes a newly authenticated user's taste profile before the user enters the product.

The flow has two steps:

```text
Genres → Watched and liked movies → Atomic completion → /
```

Onboarding writes normal user preferences and normal movie interactions through the domain and persistence layers.

---

## 2. Locked Product Decisions

| Topic | Decision |
|---|---|
| Flow | Two steps: Genres → Movies |
| Genres | Select 2–8 unique TMDB movie genre IDs |
| Movies | Select 3–8 unique TMDB movie IDs |
| Limit scope | The maximum of 8 applies only to onboarding; not a global preference limit |
| Initial movie semantics | Every selected movie becomes `LIKE` with `watchedAt` set to the completion timestamp |
| Search | Reuse existing movie catalog search endpoint, contracts, pagination, and presentation primitives |
| Genre source | Use TMDB movie genre integration |
| Persistence | Preferences, interactions, and completion timestamp commit in one database transaction |
| Idempotency | Repeating a completed request returns success without rewriting preferences or interactions |
| Retry | Retry one transient client submission failure automatically; preserve state and expose manual Retry |
| Completion route | Redirect to `/` (Discover screen) |
| Route gate | Incomplete authenticated users may access `/onboarding` but not normal product pages |
| Completed users | Completed users requesting `/onboarding` are redirected to `/` |

---

## 3. Step UI & Behavior

- **Step 1 (Genres)**: Grid of TMDB movie genres. User selects between 2 and 8 genres. The progress header displays `Paso 1 de 2` with `Continuar con películas` visible and enabled once >= 2 genres are selected.
- **Step 2 (Movies)**: Shows popular movies initially (`Películas populares`). User can also search for movies. Selecting 3 to 8 movies enables `Completar perfil` beside `Paso 2 de 2`. Selected movies persist across searching and returning to popular.
