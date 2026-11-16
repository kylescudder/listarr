<img src="assets/icon.svg" width="64" height="64" alt="">

# Listarr

Build a hand-picked movie programme from TMDB and create a custom import list in Radarr. A companion to [Sortarr](https://github.com/kylescudder/sortarr), with the same Scudder Picture House design and self-hosted Bun / TanStack Start pattern. No public hostname has been deployed yet.

## Development

Use Bun 1.4.4 throughout local development, CI and Docker:

```sh
bun install --frozen-lockfile
cp .env.example .env
bun run dev
```

Open http://127.0.0.1:3211. Set `TMDB_READ_TOKEN` to the API Read Access Token from your TMDB account. This stays on the server. Search, picking films and list URL export work without Clerk or Radarr credentials.

## Checks

See [CONTRIBUTING.md](CONTRIBUTING.md).

```sh
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run build
bunx --no-install playwright install chromium
bun run test:e2e
```

The end-to-end harness builds the actual production app, creates an ephemeral RSA key for Clerk session verification, and substitutes TMDB and Radarr only at their outbound HTTP boundaries. It exercises desktop and mobile layouts, search, people and collections, filters, paging, draft persistence, feed export, authorised creation, duplicate creation, denied access and upstream failures. It needs no service keys and never writes to a real Radarr. Real Clerk sign-in and live upstream integrations require separate deployment checks.

## Database

No database is needed. A draft is saved in this browser's local storage. Exported URLs encode an immutable, sorted set of up to 100 TMDB IDs; the server returns Radarr's `[{"id":438631}]` custom-list format without a session or TMDB request. Radarr stores the registered import list itself. Drafts do not sync between devices.

## Deployment

Deploy this service alongside Radarr, following Sortarr's container pattern. Checks on `main` publish `ghcr.io/kylescudder/listarr:main` and a `sha-<full commit>` tag after passing. Release calls the same CI workflow used for pull requests, including a production image build and health/revision smoke test, then builds AMD64 and ARM64 images on native runners and publishes their shared manifest. Forge pulls the checked image; GitHub never reaches the host. CodeQL scans Actions and TypeScript on pushes, pull requests and a daily schedule.

Set the repository variable `VITE_CLERK_PUBLISHABLE_KEY` before building if direct creation is enabled. It is a public build-time value; all other keys are runtime environment variables. A container build can also be run locally:

```sh
docker build --build-arg VITE_CLERK_PUBLISHABLE_KEY="$VITE_CLERK_PUBLISHABLE_KEY" -t listarr .
docker run --rm --env-file .env -e HOST=0.0.0.0 -p 3211:3211 listarr
```

Set `APP_ORIGIN` to the public HTTPS origin. Route that hostname to port 3211. Set `FEED_ORIGIN` if Radarr needs an internal URL, for example `http://listarr:3211`. Radarr must be able to reach `/api/feed` without an interactive login; leave this route outside any reverse-proxy login gate. The feed contains only the film IDs already in its URL and is intentionally public. Search is also public; apply edge rate limiting if exposing a shared TMDB token to the internet.

No host, DNS, existing Compose stack or real Radarr is changed by installing this repository. Add the service to your stack and configure secrets before deploying. Pin a SHA image tag to roll back. `/api/health` reports the image revision.

## Building a programme

Search films, or search people and collections then choose **Explore films**. People include both cast and crew credits with duplicates removed. Leave the search box empty to discover by genre, release year and sort order. These discovery filters do not apply to text searches. Pick up to 100 films across result pages and give the programme a name.

- **Copy Radarr list URL** exports a snapshot. In Radarr, choose Settings → Import Lists → Custom Lists and paste the URL.
- **Create list in Radarr** registers that same snapshot using the configured root folder and quality profile. Films are enabled for automatic addition on Radarr's next sync, monitored as movies only, with **Search on Add off**. This does not trigger an immediate sync, search or download. Existing Radarr monitoring and RSS behaviour still applies.
- Retrying the same film selection returns the existing list rather than creating another. Renaming the draft does not rename an existing Radarr list. Editing the selection produces a new snapshot; existing lists keep their original films.

## Sign-in

Clerk follows this repository's supplied development preferences. Only direct Radarr creation needs sign-in. Set the Clerk publishable key at build time, the server secret key (or trusted PEM verification key) at runtime, and `RADARR_ALLOWED_USER_IDS` to the Clerk user IDs that may use your Radarr. Every creation request checks the signature, expiry, authorised frontend origin and current user allowlist on the server. An empty allowlist denies everyone. Configure account management and sign-in methods in Clerk; there is no local password database.

## Runtime configuration

| Variable                     | Required            | Purpose                                                                   |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------- |
| `TMDB_READ_TOKEN`            | for search          | TMDB API Read Access Token                                                |
| `APP_ORIGIN`                 | for direct creation | Exact browser origin; local default in example is `http://127.0.0.1:3211` |
| `FEED_ORIGIN`                | no                  | Origin Radarr can reach; defaults to `APP_ORIGIN`                         |
| `VITE_CLERK_PUBLISHABLE_KEY` | for direct creation | Public Clerk key, baked into the client at build time                     |
| `CLERK_SECRET_KEY`           | for direct creation | Clerk server key, unless using `CLERK_JWT_KEY`                            |
| `CLERK_JWT_KEY`              | no                  | Trusted PEM public key for offline Clerk verification                     |
| `RADARR_ALLOWED_USER_IDS`    | for direct creation | Comma-separated Clerk user IDs; checked every request                     |
| `RADARR_URL`                 | for direct creation | Server-side Radarr base URL, including any URL base                       |
| `RADARR_API_KEY`             | for direct creation | Radarr API key; never sent to the browser                                 |
| `RADARR_QUALITY_PROFILE_ID`  | for direct creation | Existing Radarr quality profile ID                                        |
| `RADARR_ROOT_FOLDER`         | for direct creation | Existing Radarr root folder path                                          |
| `HOST`                       | no                  | Bind address, `127.0.0.1` locally / `0.0.0.0` in Docker                   |
| `PORT`                       | no                  | Defaults to `3211`                                                        |
| `LISTARR_REVISION`           | no                  | Source revision reported by the health endpoint                           |

This product uses the [TMDB API](https://developer.themoviedb.org/) but is not endorsed or certified by TMDB. Custom feed format follows [Radarr's parser](https://github.com/Radarr/Radarr/blob/develop/src/NzbDrone.Core/ImportLists/RadarrList/RadarrListParser.cs). Never commit `.env`.
