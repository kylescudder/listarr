import { sign } from 'node:crypto'
export function token(
  subject = 'user_operator',
  claims: Record<string, unknown> = {}
) {
  const now = Math.floor(Date.now() / 1000)
  const head = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'fixture' })
  ).toString('base64url')
  const body = Buffer.from(
    JSON.stringify({
      sub: subject,
      iss: 'https://fixture.clerk.accounts.dev',
      sid: 'sess_fixture',
      azp: process.env.APP_ORIGIN,
      iat: now,
      nbf: now - 5,
      exp: now + 300,
      ...claims
    })
  ).toString('base64url')
  const signature = sign(
    'RSA-SHA256',
    Buffer.from(`${head}.${body}`),
    process.env.E2E_PRIVATE_KEY!
  ).toString('base64url')
  return `${head}.${body}.${signature}`
}
