import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import * as opentype from "opentype.js"

import { svgAlphabet } from "../index.ts"

const SOURCE_FONT_PATH = join(
  import.meta.dir,
  "..",
  "assets",
  "DejaVuSansMono.ttf",
)
const SOURCE_LICENSE_PATH = join(
  import.meta.dir,
  "..",
  "assets",
  "DEJAVU-LICENSE.txt",
)

const clonePath = (sourcePath: opentype.Path): opentype.Path => {
  const path = new opentype.Path()
  path.commands = sourcePath.commands.map((command) => ({ ...command }))
  return path
}

const sourceFont = opentype.loadSync(SOURCE_FONT_PATH)
const supportedCharacters = [" ", ...Object.keys(svgAlphabet)]
  .filter((char, index, chars) => chars.indexOf(char) === index)
  .sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))

const sourceNotdef = sourceFont.glyphs.get(0)
const glyphs: opentype.Glyph[] = [
  new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: sourceNotdef.advanceWidth,
    leftSideBearing: sourceNotdef.leftSideBearing,
    path: clonePath(sourceNotdef.path),
  }),
]

for (const char of supportedCharacters) {
  const codePoint = char.codePointAt(0)
  if (codePoint === undefined) continue

  const glyphIndex = sourceFont.charToGlyphIndex(char)
  if (glyphIndex === 0) {
    throw new Error(`DejaVu Sans Mono does not contain ${JSON.stringify(char)}`)
  }

  const sourceGlyph = sourceFont.glyphs.get(glyphIndex)
  glyphs.push(
    new opentype.Glyph({
      name: sourceGlyph.name,
      unicode: codePoint,
      advanceWidth: sourceGlyph.advanceWidth,
      leftSideBearing: sourceGlyph.leftSideBearing,
      path: clonePath(sourceGlyph.path),
    }),
  )
}

const font = new opentype.Font({
  familyName: "TscircuitAlphabet",
  styleName: "Regular",
  unitsPerEm: sourceFont.unitsPerEm,
  ascender: sourceFont.ascender,
  descender: sourceFont.descender,
  glyphs,
})

const outputPath = join("dist", "TscircuitAlphabet.ttf")
const fontBuffer = Buffer.from(font.toArrayBuffer())
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, fontBuffer)
writeFileSync("TscircuitAlphabet.ttf", fontBuffer)
writeFileSync(
  join("dist", "DEJAVU-LICENSE.txt"),
  readFileSync(SOURCE_LICENSE_PATH),
)

console.log(
  `Font written to ${outputPath} using DejaVu Sans Mono (${supportedCharacters.length} glyphs)`,
)
