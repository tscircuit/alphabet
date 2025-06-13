import opentype from "opentype.js"
import { svgAlphabet } from "./index"
import { writeFileSync } from "fs"
import { parseSVG } from "svg-path-parser"

export const unitsPerEm = 1000

export function svgToPath(d: string): opentype.Path {
  const path = new opentype.Path()
  const commands = parseSVG(d)
  for (const cmd of commands) {
    switch (cmd.code) {
      case "M":
        path.moveTo(cmd.x * unitsPerEm, (1 - cmd.y) * unitsPerEm)
        break
      case "L":
        path.lineTo(cmd.x * unitsPerEm, (1 - cmd.y) * unitsPerEm)
        break
      case "C":
        path.curveTo(
          cmd.x1 * unitsPerEm,
          (1 - cmd.y1) * unitsPerEm,
          cmd.x2 * unitsPerEm,
          (1 - cmd.y2) * unitsPerEm,
          cmd.x * unitsPerEm,
          (1 - cmd.y) * unitsPerEm,
        )
        break
      case "Q":
        path.quadraticCurveTo(
          cmd.x1 * unitsPerEm,
          (1 - cmd.y1) * unitsPerEm,
          cmd.x * unitsPerEm,
          (1 - cmd.y) * unitsPerEm,
        )
        break
      case "Z":
        path.close()
        break
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
