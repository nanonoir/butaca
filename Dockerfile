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

# These two are not runtime configuration. Next inlines every NEXT_PUBLIC_ value
# into the client bundle while building, and this project also validates them
# during the build -- without them `next build` stops with
# `Invalid public environment`. They have to be build arguments, and they end up
# readable in the shipped JavaScript, which is what a publishable key is for.
#
# Everything else is read at runtime and must NOT be baked in.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}

RUN pnpm build

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

# Answered by the process alone, so a TMDB or Supabase outage cannot talk Docker
# into restarting a server that is running fine.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./node_modules/.bin/next", "start"]
