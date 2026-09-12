import { expect, test } from "bun:test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"
import * as opentype from "opentype.js"

test("renders adjacent lowercase l characters without a misleading gap", () => {
  const fontPath = join(process.cwd(), "TscircuitAlphabet.ttf")
  const svg = `<svg width="640" height="320" xmlns="http://www.w3.org/2000/svg">
  <rect width="640" height="320" fill="black"/>
  <rect x="80" y="40" width="480" height="240" fill="none" stroke="#888" stroke-width="3"/>
  <text x="320" y="160" fill="#f2eda1" font-family="TscircuitAlphabet" font-size="25" text-anchor="middle" dominant-baseline="central">text in small board</text>
</svg>`
  const pngBuffer = Buffer.from(
    new Resvg(svg, {
      font: {
        fontFiles: [fontPath],
        loadSystemFonts: false,
        defaultFontFamily: "TscircuitAlphabet",
      },
    })
      .render()
      .asPng(),
  )
  const snapshotDirectory = join(process.cwd(), "tests", "__snapshots__")
  mkdirSync(snapshotDirectory, { recursive: true })
  writeFileSync(join(snapshotDirectory, "font-small-board-text.png"), pngBuffer)

  expect(pngBuffer.length).toBeGreaterThan(1000)

  const font = opentype.loadSync(fontPath)
  const lowercaseLAdvance = font.charToGlyph("l").advanceWidth ?? 0
  const standardAdvance = font.charToGlyph("a").advanceWidth ?? 0
  expect(lowercaseLAdvance).toBe(200)
  expect(lowercaseLAdvance).toBeLessThan(standardAdvance)
})
