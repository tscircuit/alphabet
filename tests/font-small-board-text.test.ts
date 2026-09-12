import { expect, test } from "bun:test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"
import * as opentype from "opentype.js"

test("renders narrow lowercase glyphs with balanced spacing", () => {
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
  const lowercaseIAdvance = font.charToGlyph("i").advanceWidth ?? 0
  const lowercaseLAdvance = font.charToGlyph("l").advanceWidth ?? 0
  const lowercaseIBounds = font.charToGlyph("i").getBoundingBox()
  const lowercaseLBounds = font.charToGlyph("l").getBoundingBox()
  const standardGlyph = font.charToGlyph("a")
  const baselineGlyph = font.charToGlyph("m")
  const standardAdvance = standardGlyph.advanceWidth ?? 0
  expect(lowercaseIAdvance).toBe(400)
  expect(lowercaseLAdvance).toBe(400)
  expect((lowercaseIBounds.x1 + lowercaseIBounds.x2) / 2).toBe(200)
  expect((lowercaseLBounds.x1 + lowercaseLBounds.x2) / 2).toBe(200)
  expect(lowercaseLBounds.y1).toBe(baselineGlyph.getBoundingBox().y1)
  expect(lowercaseIAdvance).toBeLessThan(standardAdvance)
  expect(lowercaseLAdvance).toBeLessThan(standardAdvance)
})
