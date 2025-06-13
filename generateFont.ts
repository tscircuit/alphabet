import opentype from "opentype.js"
import { svgAlphabet } from "./index"
import { writeFileSync } from "fs"

export const unitsPerEm = 1000

export function svgToPath(d: string): opentype.Path {
  const path = new opentype.Path()
  const segments = d.split("M").slice(1)
  for (const seg of segments) {
    const points = seg
      .split("L")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split(/[, ]+/).map(Number))
    if (points.length === 0) continue
    path.moveTo(points[0][0] * unitsPerEm, (1 - points[0][1]) * unitsPerEm)
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i][0] * unitsPerEm, (1 - points[i][1]) * unitsPerEm)
    }
  }
  return path
}

export function buildFont(): opentype.Font {
  const glyphs: opentype.Glyph[] = [
  new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: unitsPerEm,
    path: new opentype.Path(),
  }),
  ]

  for (const [char, d] of Object.entries(svgAlphabet)) {
    const glyphPath = svgToPath(d)
    glyphs.push(
      new opentype.Glyph({
        name: char,
        unicode: char.charCodeAt(0),
        advanceWidth: unitsPerEm,
        path: glyphPath,
      }),
    )
  }

  return new opentype.Font({
    familyName: "Alphabet",
    styleName: "Regular",
    unitsPerEm,
    ascender: unitsPerEm,
    descender: 0,
    glyphs,
  })
}

if (import.meta.main) {
  const font = buildFont()
  const buf = Buffer.from(font.toArrayBuffer())
  writeFileSync("alphabet.otf", buf)
  console.log("alphabet.otf written")
}
