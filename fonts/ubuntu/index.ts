/**
 * Ubuntu font module — provides the same shape as root index.ts so
 * `getFont("ubuntu")` returns a drop-in alphabet.
 *
 * Source: Ubuntu-R.ttf v0.83 by Canonical Ltd., licensed under the
 * Ubuntu Font Licence 1.0 (see LICENSES/UFL-1.0.txt). Bundled here
 * to enable PCB silkscreen rendering via tscircuit's font dispatch.
 *
 * Glyph paths regenerated via:
 *   `bun scripts/generate-ubuntu-data.ts`
 */

import { svgAlphabet } from "./svg-alphabet.generated"
import { glyphAdvanceRatio } from "./glyph-advance-ratio.generated"
import {
  strokeWidthRatio,
  glyphWidthRatio,
  spaceWidthRatio,
  lineHeightRatio,
  letterSpacingRatio,
} from "./metrics.generated"

/**
 * lineAlphabet — derived from svgAlphabet at module load. Same parsing
 * logic as the root tscircuit2024 alphabet so downstream renderers
 * receive identical shape regardless of which font is selected.
 *
 * Each entry is an array of {x1, y1, x2, y2} line segments in
 * unit-square cartesian coords. M moves the pen; L draws a segment
 * from the current pen position to the L target.
 */
export const lineAlphabet: Record<
  string,
  Array<{ x1: number; y1: number; x2: number; y2: number }>
> = {}
for (const letter in svgAlphabet) {
  lineAlphabet[letter] = []
  const path = (svgAlphabet as Record<string, string>)[letter]
  // Path is "M x y L x y L x y M x y L x y ..."
  // Multiple M segments split into separate subpaths.
  const subpaths = path.split("M").filter((s) => s.trim().length > 0)
  for (const sub of subpaths) {
    // Each subpath: "x y L x y L x y ..."
    const points: Array<{ x: number; y: number }> = []
    const tokens = sub.trim().split("L")
    for (const tok of tokens) {
      const [xStr, yStr] = tok.trim().split(/\s+/)
      const x = Number.parseFloat(xStr)
      const y = Number.parseFloat(yStr)
      if (Number.isFinite(x) && Number.isFinite(y)) {
        points.push({ x, y })
      }
    }
    for (let i = 0; i < points.length - 1; i++) {
      lineAlphabet[letter].push({
        x1: points[i].x,
        y1: points[i].y,
        x2: points[i + 1].x,
        y2: points[i + 1].y,
      })
    }
  }
}

export const glyphLineAlphabet = lineAlphabet
export const kerningRatio = {} as Record<string, Record<string, number>>

export const textMetrics = {
  glyphWidthRatio,
  spaceWidthRatio,
  lineHeightRatio,
  strokeWidthRatio,
  letterSpacingRatio,
}

export {
  svgAlphabet,
  glyphAdvanceRatio,
  strokeWidthRatio,
  glyphWidthRatio,
  spaceWidthRatio,
  lineHeightRatio,
  letterSpacingRatio,
}
