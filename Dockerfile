ARG BUN_IMAGE=oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d
FROM ${BUN_IMAGE} AS build
WORKDIR /app
ENV HUSKY=0
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN bun run typecheck && bun run build

FROM ${BUN_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production HUSKY=0 HOST=0.0.0.0 PORT=3211
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY --from=build /app/dist ./dist
COPY server/production.ts ./server/production.ts
ARG LISTARR_REVISION=development
ENV LISTARR_REVISION=$LISTARR_REVISION
LABEL org.opencontainers.image.source="https://github.com/kylescudder/listarr"
LABEL org.opencontainers.image.revision=$LISTARR_REVISION
USER bun
EXPOSE 3211
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 CMD bun -e "const r = await fetch('http://127.0.0.1:' + (process.env.PORT || '3211') + '/api/health'); process.exit(r.ok ? 0 : 1)"
CMD ["bun", "server/production.ts"]
