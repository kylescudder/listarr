import path from 'node:path'

type Attachment = { path?: string; contentType: string }
type Suite = {
  suites?: Suite[]
  specs?: {
    title: string
    tests: {
      projectName: string
      results: { status: string; retry: number; attachments: Attachment[] }[]
    }[]
  }[]
}
const root = 'artifacts/full-e2e'
const report = (await Bun.file(`${root}/results.json`).json()) as Suite & {
  stats: unknown
}
const provenance = await Bun.file(`${root}/provenance.json`).json()
const rows: string[] = []
const media: string[] = []
let index = 0
async function visit(suite: Suite) {
  for (const spec of suite.specs || [])
    for (const test of spec.tests)
      for (const result of test.results) {
        const identity = `${spec.title} / ${test.projectName} / attempt ${result.retry}`
        const images = result.attachments.filter(
          (a) => a.contentType === 'image/png' && a.path
        )
        const video = result.attachments.find(
          (a) => a.contentType === 'video/webm'
        )
        // Automatic end-state screenshots cover every browser test; API-only cases have no page.
        const image = images.at(-1)
        const file = `${String(++index).padStart(2, '0')}-${test.projectName}.png`
        if (image?.path) {
          await Bun.write(`${root}/media/${file}`, Bun.file(image.path))
          media.push(
            `\n<details><summary>${identity}: ${result.status}</summary>\n\n![${identity}](./media/${file})\n\n</details>`
          )
        }
        rows.push(
          `| ${identity} | ${result.status} | ${image ? `[PNG](./media/${file})` : 'N/A: API assertions, no visual surface'} | ${video?.path ? path.relative(root, video.path) : 'N/A'} |`
        )
      }
  for (const child of suite.suites || []) await visit(child)
}
await visit(report)
await Bun.write(
  `${root}/evidence.md`,
  `# Listarr production e2e evidence\n\nRevision: ${provenance.revision}; dirty: ${provenance.dirty}; Bun ${provenance.bun}; ${provenance.capturedAt}.\n\nCommand: \`E2E_EVIDENCE=1 bun run test:e2e\`. TMDB/Radarr boundary fixtures; offline ephemeral JWTs; Clerk UI disabled. Chromium desktop 1440×1000, mobile 390×844 (not iOS Safari). Fixture films have no posters; these are real app placeholders.\n\nResults: \`${JSON.stringify(report.stats)}\`. Raw logs, JSON/HTML report, original recordings and provenance are retained by CI in playwright-evidence.\n\n| Test / project / attempt | Result | Screenshot | Source recording (artifact-relative) |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n${media.join('\n')}\n\nPNG capture does not replace assertions. Real Clerk login/account UI and live upstreams remain unverified; see e2e/README.md for scope. Inspection/upload status must be recorded by the reviewer publishing this evidence.\n`
)
