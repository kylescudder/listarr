import { execFileSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048
})
const reservation = Bun.serve({
  port: 0,
  hostname: '127.0.0.1',
  fetch: () => new Response()
})
const port = reservation.port!
await reservation.stop(true)
const origin = `http://127.0.0.1:${port}`
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8'
}).trim()
await Bun.write(
  'artifacts/full-e2e/provenance.json',
  JSON.stringify(
    {
      revision,
      dirty: Boolean(
        execFileSync('git', ['status', '--porcelain'], {
          encoding: 'utf8'
        }).trim()
      ),
      bun: Bun.version,
      origin,
      command: 'bun run test:e2e',
      capturedAt: new Date().toISOString(),
      boundary:
        'TMDB and Radarr only; ephemeral offline JWT verification; Clerk UI disabled'
    },
    null,
    2
  )
)
const environment = {
  ...process.env,
  APP_ORIGIN: origin,
  FEED_ORIGIN: origin,
  E2E_BASE_URL: origin,
  HOST: '127.0.0.1',
  CLERK_SECRET_KEY: '',
  LISTARR_REVISION: revision,
  CLERK_JWT_KEY: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  E2E_PRIVATE_KEY: privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString(),
  RADARR_ALLOWED_USER_IDS: 'user_operator',
  RADARR_URL: 'http://radarr.fixture',
  RADARR_API_KEY: 'fixture-only',
  RADARR_QUALITY_PROFILE_ID: '1',
  RADARR_ROOT_FOLDER: '/movies',
  TMDB_READ_TOKEN: 'fixture-only',
  VITE_CLERK_PUBLISHABLE_KEY: '',
  PORT: String(port)
}
for (const cmd of [
  ['bun', 'run', 'build'],
  ['bunx', '--no-install', 'playwright', 'test']
]) {
  const child = Bun.spawn(cmd, {
    env: environment,
    stdout: 'inherit',
    stderr: 'inherit'
  })
  const code = await child.exited
  if (cmd.includes('test')) {
    const evidence = Bun.spawn(['bun', 'e2e/evidence.ts'], {
      stdout: 'inherit',
      stderr: 'inherit'
    })
    const evidenceCode = await evidence.exited
    if (!code && evidenceCode) process.exit(evidenceCode)
  }
  if (code) process.exit(code)
}
