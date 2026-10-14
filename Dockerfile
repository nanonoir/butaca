# syntax=docker/dockerfile:1

# Debian rather than Alpine. Nothing here needs a native module today --
# pnpm-workspace.yaml even turns sharp's build off, and the only two next/image
# calls are an SVG and an `unoptimized` avatar -- but the host is Ubuntu, and
# matching its libc means a dependency that does need one later installs the
# same way in the image as it does on the server.
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# Everything, including dev dependencies, because the build needs them.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# What ships. Kept apart from `deps` so the two installs cache independently and
# a source edit reinstalls neither.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# No build arguments and no secrets: configuration is read lazily at runtime
# (database, auth, Resend, TMDB), so the build runs without any real value and
# nothing sensitive can end up in a layer.
RUN pnpm build

# One-shot migration job: `docker compose run --rm migrate`. The runner image
# deliberately has no drizzle-kit, schema or migrations, so this separate target
# carries the dev dependencies and only what drizzle-kit reads. It is never
# started by `up` and the web image never runs migrations on boot.
FROM base AS migrate
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY package.json drizzle.config.ts tsconfig.json ./
COPY src/db ./src/db
COPY src/lib/env/migration.ts ./src/lib/env/migration.ts
USER node
CMD ["./node_modules/.bin/drizzle-kit", "migrate"]

# `output: "standalone"` would trim this a lot, and it was the first thing tried.
# Next traces that bundle through the real paths of what it imports and does not
# reproduce pnpm's symlink layout faithfully: the image built clean and then died
# on boot every time, on
# `Cannot find module '.../@swc/helpers/esm/_interop_require_default.js'`.
# Forcing a flat install did not move it. A production install and `next start`
# costs a few hundred megabytes and starts.
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node package.json next.config.ts ./

USER node
EXPOSE 3000

# Liveness. Answered by the process alone, so a TMDB or database outage cannot talk Docker
# into restarting a server that is running fine.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./node_modules/.bin/next", "start"]
