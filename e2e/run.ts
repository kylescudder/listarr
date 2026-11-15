import { generateKeyPairSync } from 'node:crypto'
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048
})
const environment = {
  ...process.env,
  APP_ORIGIN: 'http://127.0.0.1:33211',
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
  PORT: '33211'
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
  if (code) process.exit(code)
}
