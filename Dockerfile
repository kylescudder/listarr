FROM oven/bun:1.4.2 AS build
WORKDIR /app
ENV HUSKY=0
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN bun run build

FROM oven/bun:1.4.2 AS runtime
WORKDIR /app
ENV NODE_ENV=production HUSKY=0 HOST=0.0.0.0 PORT=3211
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY --from=build /app/dist ./dist
COPY server/production.ts ./server/production.ts
ARG REVISION=unknown
ENV LISTARR_REVISION=$REVISION
USER bun
EXPOSE 3211
CMD ["bun", "server/production.ts"]
