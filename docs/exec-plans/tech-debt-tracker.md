# Technical Debt Tracker

This file tracks concrete, verifiable technical debt identified in the codebase.
Do not add speculative ideas, wishlist items, or vague suggestions. Each entry must describe a concrete issue, its impact, and references to relevant code.

## Active Technical Debt

### TD-001: Vite Native Config Loader Warning in Vitest
- **Discovered**: 2026-08 (Foundation Backend / Testing setup)
- **Location**: `vitest.config.ts`, `package.json`
- **Description**: Running `vitest run` outputs a warning: `ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a .mjs extension or set "type": "module" in package.json`. Vitest currently defaults to loading CommonJS when `"type": "module"` is not in `package.json`.
- **Impact**: Non-blocking cosmetic warning in test output. Future Vitest / Vite major versions may require `.mjs` or `"type": "module"`.
- **Remediation**: Rename `vitest.config.ts` to `vitest.config.mjs` (and `vitest.integration.config.ts` to `vitest.integration.config.mjs`) or evaluate full project ESM compatibility before setting `"type": "module"`.
