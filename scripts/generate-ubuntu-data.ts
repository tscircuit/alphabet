/**
 * Generate Ubuntu font glyph data for `<silkscreentext font="ubuntu">`.
 *
 * Pipeline:
 *   1. Load assets/Ubuntu-L.ttf (Canonical, UFL 1.0) — Light weight
 *   2. For each char in CHARSET, fetch the glyph's path commands from
 *      opentype.js
 *   3. Flatten quadratic + cubic Beziers to short L segments (subdivision
 *      at FLATNESS_TOLERANCE)
 *   4. Normalize all coordinates into the [0,1] unit square. Y axis is
 *      flipped to match @tscircuit/alphabet's cartesian convention
 *      (y=0 at top, y=1 at bottom — same as `index.ts` does for
 *      tscircuit2024).
 *   5. Emit `fonts/ubuntu/svg-alphabet.generated.ts` containing the
 *      svgAlphabet record + glyph advance ratios
 *
 * Run via: `bun scripts/generate-ubuntu-data.ts`
 *
 * Vendor TTF + licence are tracked under assets/ and LICENSES/
 * respectively (UFL 1.0 — permissive).
 */

import { writeFileSync } from "node:fs"
import { join } from "node:path"
import * as opentype from "opentype.js"

// Ubuntu Light variant — Regular weight stroke renders too thick at
// PCB silkscreen scale (≥0.15mm stroke width at fontSize 0.8mm),
// owner request 2026-05-28. Light keeps glyph contour shape, reduces
// stroke thickness by ~40%.
const TTF_PATH = join(import.meta.dir, "..", "assets", "Ubuntu-L.ttf")
const OUT_DIR = join(import.meta.dir, "..", "fonts", "ubuntu")
const SVG_OUT = join(OUT_DIR, "svg-alphabet.generated.ts")
const ADVANCE_OUT = join(OUT_DIR, "glyph-advance-ratio.generated.ts")
const METRICS_OUT = join(OUT_DIR, "metrics.generated.ts")

/** Characters we want to ship. Latin (matches root index.ts svgAlphabet
 *  keys) + Ukrainian Cyrillic subset (А-Я а-я + ґҐ єЄ іІ їЇ). */
const CHARSET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
  "!\"#$'()*+,-./<=>[\\]^_" +
  "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ" +
  "абвгдежзийклмнопрстуфхцчшщъыьэюя" +
  "ҐґЄєІіЇї"

/** Bezier flatness threshold in unit-square space. 0.004 gives ~250
 *  subdivisions of a unit-wide curve — sub-pixel at silkscreen scale
 *  (fontSize 0.8mm = 800 µm; 0.004 unit ≈ 3.2 µm). */
const FLATNESS_TOLERANCE = 0.004

const font = opentype.loadSync(TTF_PATH)
const unitsPerEm = font.unitsPerEm

/** Reference height for normalization. Pick from the tallest glyph's
 *  bounding box so descenders + ascenders all fit inside [0, 1] Y. */
const referenceGlyphs = CHARSET.split("").map((c) => font.charToGlyph(c))
const allBBoxes = referenceGlyphs.map((g) => g.getBoundingBox())
const yMin = Math.min(...allBBoxes.map((b) => b.y1))
const yMax = Math.max(...allBBoxes.map((b) => b.y2))
const designHeight = yMax - yMin

/** Width metric. Use 'H' as canonical capital cap height anchor. */
const capH = font.charToGlyph("H").getBoundingBox()
const designCapWidth = capH.x2 - capH.x1

/** Normalize Ubuntu coords (font units, Y up, baseline at 0) to
 *  unit-square (X in [0..glyphWidth], Y in [0..1] with 0 at top). */
const normalizeX = (x: number) => x / designHeight
/** opentype.js getPath() returns SVG-DOWN Y coords (ascender = negative,
 *  baseline = 0, descender = positive). Convert to unit-square Y-DOWN
 *  by adding to yMax (which is the font's max ascender, positive in
 *  font Y-up) so that glyph top maps to small normalized values and
 *  glyph bottom maps to large ones. */
const normalizeY = (y: number) => (yMax + y) / designHeight

type Point = { x: number; y: number }

/** Subdivide a quadratic Bezier to line segments. */
const flattenQuadratic = (
  p0: Point,
  p1: Point,
  p2: Point,
  tol: number,
): Point[] => {
  const dx = p0.x - 2 * p1.x + p2.x
  const dy = p0.y - 2 * p1.y + p2.y
  const errSquared = dx * dx + dy * dy
  if (errSquared <= tol * tol * 4) {
    return [p2]
  }
  // Subdivide at t=0.5
  const m01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
  const m12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  const m = { x: (m01.x + m12.x) / 2, y: (m01.y + m12.y) / 2 }
  return [
    ...flattenQuadratic(p0, m01, m, tol),
    ...flattenQuadratic(m, m12, p2, tol),
  ]
}

/** Subdivide a cubic Bezier. */
const flattenCubic = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  tol: number,
): Point[] => {
  const dx = p0.x - 3 * p1.x + 3 * p2.x - p3.x
  const dy = p0.y - 3 * p1.y + 3 * p2.y - p3.y
  const errSquared = dx * dx + dy * dy
  if (errSquared <= tol * tol * 8) {
    return [p3]
  }
  const m01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
  const m12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  const m23 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 }
  const m012 = { x: (m01.x + m12.x) / 2, y: (m01.y + m12.y) / 2 }
  const m123 = { x: (m12.x + m23.x) / 2, y: (m12.y + m23.y) / 2 }
  const m = { x: (m012.x + m123.x) / 2, y: (m012.y + m123.y) / 2 }
  return [
    ...flattenCubic(p0, m01, m012, m, tol),
    ...flattenCubic(m, m123, m23, p3, tol),
  ]
}

/** Convert an opentype.Path to an "M x y L x y L x y ..." svgAlphabet
 *  string in unit-square cartesian coords. */
const glyphToSvgPath = (
  glyph: opentype.Glyph,
  xOrigin: number,
): string => {
  const path = glyph.getPath(0, 0, unitsPerEm)
  const segments: string[] = []
  let current: Point | null = null

  for (const cmd of path.commands) {
    switch (cmd.type) {
      case "M": {
        const p = {
          x: normalizeX(cmd.x - xOrigin),
          y: normalizeY(cmd.y),
        }
        segments.push(`M${p.x.toFixed(6)} ${p.y.toFixed(6)}`)
        current = p
        break
      }
      case "L": {
        const p = {
          x: normalizeX(cmd.x - xOrigin),
          y: normalizeY(cmd.y),
        }
        segments.push(`L${p.x.toFixed(6)} ${p.y.toFixed(6)}`)
        current = p
        break
      }
      case "Q": {
        if (!current) break
        const p1 = {
          x: normalizeX(cmd.x1 - xOrigin),
          y: normalizeY(cmd.y1),
        }
        const p2 = {
          x: normalizeX(cmd.x - xOrigin),
          y: normalizeY(cmd.y),
        }
        const pts = flattenQuadratic(current, p1, p2, FLATNESS_TOLERANCE)
        for (const pt of pts) {
          segments.push(`L${pt.x.toFixed(6)} ${pt.y.toFixed(6)}`)
        }
        current = p2
        break
      }
      case "C": {
        if (!current) break
        const p1 = {
          x: normalizeX(cmd.x1 - xOrigin),
          y: normalizeY(cmd.y1),
        }
        const p2 = {
          x: normalizeX(cmd.x2 - xOrigin),
          y: normalizeY(cmd.y2),
        }
        const p3 = {
          x: normalizeX(cmd.x - xOrigin),
          y: normalizeY(cmd.y),
        }
        const pts = flattenCubic(current, p1, p2, p3, FLATNESS_TOLERANCE)
        for (const pt of pts) {
          segments.push(`L${pt.x.toFixed(6)} ${pt.y.toFixed(6)}`)
        }
        current = p3
        break
      }
      case "Z": {
        // Close path is implicit in svgAlphabet pattern; root index.ts
        // also doesn't carry explicit Z. Skip.
        break
      }
    }
  }
  return segments.join(" ")
}

const svgAlphabet: Record<string, string> = {}
const glyphAdvanceRatio: Record<string, number> = {}

for (const ch of CHARSET) {
  const glyph = font.charToGlyph(ch)
  if (!glyph || glyph.path.commands.length === 0) {
    console.warn(`skip "${ch}" — no glyph path`)
    continue
  }
  const bbox = glyph.getBoundingBox()
  const xOrigin = bbox.x1
  svgAlphabet[ch] = glyphToSvgPath(glyph, xOrigin)
  glyphAdvanceRatio[ch] = (glyph.advanceWidth ?? 0) / designHeight
}

// Compute aggregate metrics
const advanceMean =
  Object.values(glyphAdvanceRatio).reduce((a, b) => a + b, 0) /
  Object.values(glyphAdvanceRatio).length
const spaceGlyph = font.charToGlyph(" ")
const spaceAdvance = (spaceGlyph.advanceWidth ?? 0) / designHeight
const capHeight = (capH.y2 - capH.y1) / designHeight

const metrics = {
  strokeWidthRatio: 0.05, // Ubuntu Light natural stroke / em (lighter than Regular)
  glyphWidthRatio: advanceMean,
  spaceWidthRatio: spaceAdvance,
  lineHeightRatio:
    (font.ascender - font.descender + font.tables.os2.sTypoLineGap) /
    designHeight,
  letterSpacingRatio: 0,
  capHeight,
}

console.log(
  `Ubuntu metrics: strokeWidthRatio=${metrics.strokeWidthRatio}, ` +
    `glyphWidthRatio=${metrics.glyphWidthRatio.toFixed(4)}, ` +
    `lineHeightRatio=${metrics.lineHeightRatio.toFixed(4)}, ` +
    `capHeight=${metrics.capHeight.toFixed(4)}`,
)

// Emit svg-alphabet.generated.ts
const svgModule = `// AUTO-GENERATED by scripts/generate-ubuntu-data.ts — do not edit by hand.
// Source: Ubuntu-L.ttf v0.83 (Light weight) by Canonical Ltd., UFL 1.0 (see LICENSES/UFL-1.0.txt).
//
// To regenerate: \`bun scripts/generate-ubuntu-data.ts\`

export const svgAlphabet: Record<string, string> = ${JSON.stringify(svgAlphabet, null, 2)}
`
writeFileSync(SVG_OUT, svgModule)
console.log(`✓ wrote ${SVG_OUT}`)

// Emit glyph-advance-ratio.generated.ts
const advanceModule = `// AUTO-GENERATED by scripts/generate-ubuntu-data.ts — do not edit by hand.

export const glyphAdvanceRatio: Record<string, number> = ${JSON.stringify(glyphAdvanceRatio, null, 2)}
`
writeFileSync(ADVANCE_OUT, advanceModule)
console.log(`✓ wrote ${ADVANCE_OUT}`)

// Emit metrics.generated.ts
const metricsModule = `// AUTO-GENERATED by scripts/generate-ubuntu-data.ts — do not edit by hand.

export const strokeWidthRatio = ${metrics.strokeWidthRatio}
export const glyphWidthRatio = ${metrics.glyphWidthRatio}
export const spaceWidthRatio = ${metrics.spaceWidthRatio}
export const lineHeightRatio = ${metrics.lineHeightRatio}
export const letterSpacingRatio = ${metrics.letterSpacingRatio}
export const capHeight = ${metrics.capHeight}
`
writeFileSync(METRICS_OUT, metricsModule)
console.log(`✓ wrote ${METRICS_OUT}`)

console.log(
  `\nDone. ${Object.keys(svgAlphabet).length} glyphs generated.\n` +
    `Next: bun run build to bundle into dist/, then publish.`,
)
