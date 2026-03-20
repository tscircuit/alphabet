import { writeFileSync } from "node:fs"
import { join } from "node:path"

import { strokeWidthRatio, svgAlphabet } from "../index.ts"
import { createGlyphOutlineFromSvgPath } from "./glyph-outline-utils"

const generatedOutlineAlphabet: Record<
  string,
  Array<Array<{ x: number; y: number }>>
> = {}

for (const [char, pathData] of Object.entries(svgAlphabet)) {
  generatedOutlineAlphabet[char] = createGlyphOutlineFromSvgPath(
    pathData,
    strokeWidthRatio,
  )
}

const outlinePolygonsPath = join(import.meta.dir, "..", "outline-polygons.ts")
const serializedOutlineAlphabet = JSON.stringify(
  generatedOutlineAlphabet,
  null,
  2,
)
const outlineModule = `const outlinePolygons = ${serializedOutlineAlphabet} as Record<string, Array<Array<{ x: number; y: number }>>>\n\nexport default outlinePolygons\nexport { outlinePolygons, outlinePolygons as glyphOutlineAlphabet }\n`

writeFileSync(outlinePolygonsPath, outlineModule)
console.log("✓ generated outline polygons written to outline-polygons.ts")
