import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import * as opentype from "opentype.js"

import { svgAlphabet } from "../index.ts"

const UNITS_PER_EM = 1000
const ASCENDER = UNITS_PER_EM
const DESCENDER = 0

const createGlyphPath = (pathData: string) => {
  const path = new opentype.Path()
  const normalized = pathData.replace(/\s+/g, " ").trim()
  const segments = normalized.match(/[ML][^ML]*/g) ?? []

  for (const segment of segments) {
    const type = segment[0]
    const coords = segment
      .slice(1)
      .trim()
      .split(/[ ,]+/)
      .filter(Boolean)
      .map((value) => Number.parseFloat(value))

    for (let i = 0; i < coords.length; i += 2) {
      const x = coords[i]
      const y = coords[i + 1]

      if (typeof x !== "number" || typeof y !== "number") {
        continue
      }

      const scaledX = x * UNITS_PER_EM
      const scaledY = (1 - y) * UNITS_PER_EM

      if (type === "M") {
        path.moveTo(scaledX, scaledY)
      } else if (type === "L") {
        path.lineTo(scaledX, scaledY)
      }
    }
  }

  return path
}

const glyphs: opentype.Glyph[] = [
  new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: UNITS_PER_EM,
    path: new opentype.Path(),
  }),
]

for (const [char, pathData] of Object.entries(svgAlphabet)) {
  if (!char) {
    continue
  }

  const codePoint = char.codePointAt(0)

  if (codePoint === undefined) {
    continue
  }

  glyphs.push(
    new opentype.Glyph({
      name: char,
      unicode: codePoint,
      advanceWidth: UNITS_PER_EM,
      path: createGlyphPath(pathData),
    }),
  )
}

glyphs.sort((a, b) => (a.unicode ?? 0) - (b.unicode ?? 0))

const font = new opentype.Font({
  familyName: "TSCircuitAlphabet",
  styleName: "Regular",
  unitsPerEm: UNITS_PER_EM,
  ascender: ASCENDER,
  descender: DESCENDER,
  glyphs,
})

const outputPath = join("dist", "alphabet.ttf")
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, Buffer.from(font.toArrayBuffer()))

console.log(`Font written to ${outputPath}`)
