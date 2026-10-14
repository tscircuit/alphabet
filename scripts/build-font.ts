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

// Keep the DejaVu Sans Mono outlines, but do not keep its terminal-style fixed
// cells. PCB labels are read as compact annotations, so each glyph gets an
// optical advance based on its ink width plus a small, consistent side bearing.
// Wide glyphs never exceed the source font's advance.
const OPTICAL_SIDE_BEARING_RATIO = 0.035
const SPACE_ADVANCE_RATIO = 0.35

const clonePath = (sourcePath: opentype.Path): opentype.Path => {
  const path = new opentype.Path()
  path.commands = sourcePath.commands.map((command) => ({ ...command }))
  return path
}

const translatePathX = (
  sourcePath: opentype.Path,
  deltaX: number,
): opentype.Path => {
  const path = new opentype.Path()
  path.commands = sourcePath.commands.map((command) => {
    const translated = { ...command }
    if ("x" in translated && typeof translated.x === "number") {
      translated.x += deltaX
    }
    if ("x1" in translated && typeof translated.x1 === "number") {
      translated.x1 += deltaX
    }
    if ("x2" in translated && typeof translated.x2 === "number") {
      translated.x2 += deltaX
    }
    return translated
  })
  return path
}

const getOpticalGlyphMetrics = (sourceGlyph: opentype.Glyph) => {
  const sourceAdvance = sourceGlyph.advanceWidth ?? sourceFont.unitsPerEm
  if (!sourceGlyph.path.commands.length) {
    return {
      advanceWidth: Math.round(sourceFont.unitsPerEm * SPACE_ADVANCE_RATIO),
      leftSideBearing: 0,
      path: clonePath(sourceGlyph.path),
    }
  }

  const bounds = sourceGlyph.getBoundingBox()
  const inkWidth = bounds.x2 - bounds.x1
  const sideBearing = sourceFont.unitsPerEm * OPTICAL_SIDE_BEARING_RATIO
  const advanceWidth = Math.round(
    Math.min(sourceAdvance, inkWidth + sideBearing * 2),
  )
  const leftSideBearing = (advanceWidth - inkWidth) / 2
  const deltaX = leftSideBearing - bounds.x1

  return {
    advanceWidth,
    leftSideBearing,
    path: translatePathX(sourceGlyph.path, deltaX),
  }
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
  const metrics = getOpticalGlyphMetrics(sourceGlyph)
  glyphs.push(
    new opentype.Glyph({
      name: sourceGlyph.name,
      unicode: codePoint,
      advanceWidth: metrics.advanceWidth,
      leftSideBearing: metrics.leftSideBearing,
      path: metrics.path,
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
