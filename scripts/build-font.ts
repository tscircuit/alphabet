import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import * as opentype from "opentype.js"
import { Polygon, BooleanOperations } from "@flatten-js/core"

import { svgAlphabet } from "../index.ts"

const UNITS_PER_EM = 1000
// Match Arial's proportions: ascender at ~90.5% and descender at ~21.2% of em
const ASCENDER = 905
const DESCENDER = -212
const STROKE_WIDTH = 0.12  // Adjust this to make the font thicker or thinner
const SIDE_BEARING_PERCENT = 0.1 // 10% of glyph width on each side

interface Point {
  x: number
  y: number
}

// Parse SVG path data into line segments
const parsePathToSegments = (pathData: string): Point[][] => {
  const normalized = pathData.replace(/\s+/g, " ").trim()
  const segments = normalized.match(/[ML][^ML]*/g) ?? []
  const lines: Point[][] = []
  let currentLine: Point[] = []

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

      if (type === "M") {
        if (currentLine.length > 0) {
          lines.push(currentLine)
        }
        currentLine = [{ x, y: 1 - y }] // Flip y-axis
      } else if (type === "L") {
        currentLine.push({ x, y: 1 - y }) // Flip y-axis
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine)
  }

  return lines
}

// Create a capsule shape (rectangle with rounded ends) for a line segment
const expandLineSegment = (p1: Point, p2: Point, width: number, segments = 8): Point[] => {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.sqrt(dx * dx + dy * dy)

  if (len === 0) return []

  const radius = width / 2

  // Perpendicular unit vector
  const perpX = (-dy / len) * radius
  const perpY = (dx / len) * radius

  // Calculate the angle of the line
  const lineAngle = Math.atan2(dy, dx)

  const points: Point[] = []

  // Side 1: from p1 to p2 (offset in perpendicular direction)
  points.push({ x: p1.x + perpX, y: p1.y + perpY })
  points.push({ x: p2.x + perpX, y: p2.y + perpY })

  // Semicircle around p2 (from +perp to -perp)
  for (let i = 1; i < segments; i++) {
    const angle = lineAngle + Math.PI / 2 - (i / segments) * Math.PI
    points.push({
      x: p2.x + Math.cos(angle) * radius,
      y: p2.y + Math.sin(angle) * radius,
    })
  }

  // Side 2: from p2 to p1 (offset in opposite perpendicular direction)
  points.push({ x: p2.x - perpX, y: p2.y - perpY })
  points.push({ x: p1.x - perpX, y: p1.y - perpY })

  // Semicircle around p1 (from -perp to +perp)
  for (let i = 1; i < segments; i++) {
    const angle = lineAngle - Math.PI / 2 - (i / segments) * Math.PI
    points.push({
      x: p1.x + Math.cos(angle) * radius,
      y: p1.y + Math.sin(angle) * radius,
    })
  }

  return points
}

// Calculate bounding box of polygons in normalized coordinates
const getBoundingBox = (
  polygons: Point[][],
): { minX: number; maxX: number; minY: number; maxY: number } => {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const polygon of polygons) {
    for (const point of polygon) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }
  }

  return { minX, maxX, minY, maxY }
}

// Convert polygon points to opentype.js path
// Scale to match the ascender height (glyphs go from baseline 0 to ascender)
const polygonToPath = (polygons: Point[][]): opentype.Path => {
  const path = new opentype.Path()

  for (const polygon of polygons) {
    if (polygon.length === 0) continue

    const first = polygon[0]
    path.moveTo(first.x * UNITS_PER_EM, first.y * ASCENDER)

    for (let i = 1; i < polygon.length; i++) {
      const pt = polygon[i]
      path.lineTo(pt.x * UNITS_PER_EM, pt.y * ASCENDER)
    }

    path.closePath()
  }

  return path
}

// Translate an opentype.js path by (dx, dy) in font units
const translatePath = (path: opentype.Path, dx: number, dy: number): void => {
  for (const cmd of path.commands) {
    if ((cmd as any).x !== undefined) (cmd as any).x += dx
    if ((cmd as any).y !== undefined) (cmd as any).y += dy
    if ((cmd as any).x1 !== undefined) (cmd as any).x1 += dx
    if ((cmd as any).y1 !== undefined) (cmd as any).y1 += dy
    if ((cmd as any).x2 !== undefined) (cmd as any).x2 += dx
    if ((cmd as any).y2 !== undefined) (cmd as any).y2 += dy
  }
}

const createGlyphPath = (
  pathData: string,
  normalizeBaseline: boolean,
): { path: opentype.Path; bbox: ReturnType<typeof getBoundingBox> } => {
  const lines = parsePathToSegments(pathData)

  if (normalizeBaseline) {
    // Find minimum Y across all line points (normalized coords)
    let minY = Number.POSITIVE_INFINITY
    for (const line of lines) {
      for (const p of line) {
        minY = Math.min(minY, p.y)
      }
    }
    if (Number.isFinite(minY)) {
      // Shift so stroked outline (with radius = STROKE_WIDTH/2) sits on baseline
      const dy = -minY + STROKE_WIDTH / 2
      for (const line of lines) {
        for (const p of line) {
          p.y += dy
        }
      }
    }
  }
  const allPolygons: Point[][] = []

  // Expand each line segment into a capsule with rounded caps
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const capsule = expandLineSegment(line[i], line[i + 1], STROKE_WIDTH)
      if (capsule.length > 0) {
        allPolygons.push(capsule)
      }
    }
  }

  // Use boolean union to merge overlapping polygons
  try {
    if (allPolygons.length === 0) {
      return {
        path: new opentype.Path(),
        bbox: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      }
    }

    // Create polygons
    const polygons = allPolygons.map(
      (pts) => new Polygon(pts.map((p) => [p.x, p.y])),
    )

    // Union all polygons using BooleanOperations
    let unified = polygons[0]
    for (let i = 1; i < polygons.length; i++) {
      unified = BooleanOperations.unify(unified, polygons[i])
    }

    // Convert back to point arrays
    const resultPolygons: Point[][] = []
    for (const face of unified.faces) {
      const points: Point[] = []
      for (const edge of face.edges) {
        points.push({ x: edge.start.x, y: edge.start.y })
      }
      resultPolygons.push(points)
    }

    const bbox = getBoundingBox(resultPolygons)
    return { path: polygonToPath(resultPolygons), bbox }
  } catch (error) {
    console.warn("Boolean union failed, using simple polygons", error)
    const bbox = getBoundingBox(allPolygons)
    return { path: polygonToPath(allPolygons), bbox }
  }
}

// First pass: calculate all glyph data and find the maximum width
const glyphData: Array<{
  char: string
  codePoint: number
  path: opentype.Path
  bbox: ReturnType<typeof getBoundingBox>
  glyphWidth: number
}> = []

let maxGlyphWidth = 0

const DESCENDERS = new Set(["g", "j", "p", "q", "y", ","])

for (const [char, pathData] of Object.entries(svgAlphabet)) {
  if (!char) {
    continue
  }

  const codePoint = char.codePointAt(0)

  if (codePoint === undefined) {
    continue
  }

  const { path, bbox } = createGlyphPath(pathData, !DESCENDERS.has(char))
  const glyphWidth = (bbox.maxX - bbox.minX) * UNITS_PER_EM

  maxGlyphWidth = Math.max(maxGlyphWidth, glyphWidth)

  glyphData.push({ char, codePoint, path, bbox, glyphWidth })
}

// Calculate fixed monospace width based on the widest glyph
const MONOSPACE_WIDTH = maxGlyphWidth + maxGlyphWidth * SIDE_BEARING_PERCENT * 2

// Second pass: create glyphs with fixed monospace width
const glyphs: opentype.Glyph[] = [
  new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: MONOSPACE_WIDTH,
    path: new opentype.Path(),
  }),
]

for (const { char, codePoint, path, bbox, glyphWidth } of glyphData) {
  // Center the glyph within the monospace width
  const leftSideBearing =
    (MONOSPACE_WIDTH - glyphWidth) / 2 - bbox.minX * UNITS_PER_EM

  glyphs.push(
    new opentype.Glyph({
      name: char,
      unicode: codePoint,
      advanceWidth: MONOSPACE_WIDTH,
      path,
      leftSideBearing,
    }),
  )
}

glyphs.sort((a, b) => (a.unicode ?? 0) - (b.unicode ?? 0))

const font = new opentype.Font({
  familyName: "TscircuitAlphabet",
  styleName: "Regular",
  unitsPerEm: UNITS_PER_EM,
  ascender: ASCENDER,
  descender: DESCENDER,
  glyphs,
})

type HheaTable = { ascent?: number; descent?: number; lineGap?: number; advanceWidthMax?: number }
type OS2Table = {
  sTypoAscender?: number
  sTypoDescender?: number
  sTypoLineGap?: number
  usWinAscent?: number
  usWinDescent?: number
  xAvgCharWidth?: number
  panose?: { proportion?: number } | undefined
}
type PostTable = { isFixedPitch?: number }
type FontTables = { hhea?: HheaTable; os2?: OS2Table; post?: PostTable }
type FontWithTables = { tables?: FontTables }

const tables = (font as unknown as FontWithTables).tables
if (tables?.hhea) {
  tables.hhea.ascent = ASCENDER
  tables.hhea.descent = DESCENDER
  tables.hhea.lineGap = 0
  tables.hhea.advanceWidthMax = Math.round(MONOSPACE_WIDTH)
}
if (tables?.os2) {
  tables.os2.sTypoAscender = ASCENDER
  tables.os2.sTypoDescender = DESCENDER
  tables.os2.sTypoLineGap = 0
  tables.os2.usWinAscent = ASCENDER
  tables.os2.usWinDescent = -DESCENDER
  tables.os2.xAvgCharWidth = Math.round(MONOSPACE_WIDTH)
  tables.os2.panose = tables.os2.panose ?? {}
  tables.os2.panose.proportion = 9 // monospace
}
if (tables?.post) {
  tables.post.isFixedPitch = 1
}

const outputPath = join("dist", "TscircuitAlphabet.ttf")
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, Buffer.from(font.toArrayBuffer()))
writeFileSync("TscircuitAlphabet.ttf", Buffer.from(font.toArrayBuffer()))

console.log(`Font written to ${outputPath}`)
