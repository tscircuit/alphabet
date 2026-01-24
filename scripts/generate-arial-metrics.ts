import { writeFileSync } from "node:fs"
import { join } from "node:path"
import * as opentype from "opentype.js"

import { svgAlphabet } from "../index.ts"

const UNITS_PER_EM = 1000
const ARIAL_PATHS = [
  "/usr/share/fonts/truetype/msttcorefonts/Arial.ttf",
  "/usr/share/fonts/truetype/msttcorefonts/arial.ttf",
  "/usr/share/fonts/truetype/microsoft/Arial.ttf",
  "/Library/Fonts/Arial.ttf",
  "C:\\Windows\\Fonts\\Arial.ttf",
]

const findArialPath = (): string | null => {
  for (const path of ARIAL_PATHS) {
    try {
      if (Bun.file(path).size > 0) {
        return path
      }
    } catch {
      // ignore
    }
  }
  return null
}

const arialPath = findArialPath()
if (!arialPath) {
  throw new Error("Arial font not found; cannot generate metrics.")
}

const arialFont = opentype.loadSync(arialPath)
const scale = UNITS_PER_EM / arialFont.unitsPerEm

const metrics: Record<
  string,
  {
    width: number
    height: number
    advanceWidth: number
    leftSideBearing: number
    rightSideBearing: number
    yMin: number
    yMax: number
  }
> = {}

for (const char of Object.keys(svgAlphabet)) {
  const glyph = arialFont.charToGlyph(char)
  const bbox = glyph.getBoundingBox()

  const width = (bbox.x2 - bbox.x1) * scale
  const height = (bbox.y2 - bbox.y1) * scale
  const advanceWidth = (glyph.advanceWidth || 0) * scale
  const leftSideBearing = bbox.x1 * scale
  const rightSideBearing = advanceWidth - bbox.x2 * scale
  const yMin = bbox.y1 * scale
  const yMax = bbox.y2 * scale

  metrics[char] = {
    width,
    height,
    advanceWidth,
    leftSideBearing,
    rightSideBearing,
    yMin,
    yMax,
  }
}

const outputPath = join(import.meta.dir, "arial-metrics.json")
writeFileSync(outputPath, JSON.stringify(metrics, null, 2))
console.log(`Wrote Arial metrics to ${outputPath}`)
