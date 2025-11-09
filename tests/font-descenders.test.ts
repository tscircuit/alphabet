import { expect, test } from "bun:test"
import { Resvg } from "@resvg/resvg-js"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

test("renders descender characters", async () => {
  const lines = ["gjpqy,", "jumping quickly"]
  const fontSize = 100
  const lineHeight = fontSize * 1.8
  const padding = fontSize * 0.9
  const maxLineLength = Math.max(...lines.map((l) => l.length))
  const width = maxLineLength * fontSize * 1.392 + padding * 2
  const height = lineHeight * lines.length + padding * 2

  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")

  const svgString = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="white"/>
  ${lines
    .map(
      (line, i) =>
        `<text x="${padding}" y="${
          fontSize + padding + i * lineHeight
        }" font-family="TscircuitAlphabet" font-size="${fontSize}" fill="black">${escapeXml(
          line,
        )}</text>`,
    )
    .join("\n  ")}
</svg>`

  const fontPath = join(process.cwd(), "TscircuitAlphabet.ttf")
  const resvg = new Resvg(svgString, {
    font: {
      fontFiles: [fontPath],
      loadSystemFonts: false,
      defaultFontFamily: "TscircuitAlphabet",
    },
  })

  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  const snapshotDir = join(process.cwd(), "tests", "__snapshots__")
  mkdirSync(snapshotDir, { recursive: true })
  const pngPath = join(snapshotDir, "font-descenders.png")
  writeFileSync(pngPath, pngBuffer)

  expect(pngBuffer.length).toBeGreaterThan(1000)
  console.log(`PNG snapshot saved to ${pngPath} (${pngBuffer.length} bytes)`)
})
