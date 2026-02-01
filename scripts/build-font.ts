import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import * as opentype from "opentype.js"
import { Polygon, BooleanOperations } from "@flatten-js/core"

import { svgAlphabet } from "../index.ts"

const UNITS_PER_EM = 1000
// Match Arial's proportions: ascender at ~90.5% and descender at ~21.2% of em
const ASCENDER = 940
const DESCENDER = -212
const STROKE_WIDTH = 0.1 // Adjust this to make the font thicker or thinner
const SIDE_BEARING_PERCENT = 0.03 // 3% of glyph width on each side
const SIDE_BEARING_MIN = 26

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
const expandLineSegment = (
  p1: Point,
  p2: Point,
  width: number,
  segments = 8,
): Point[] => {
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

const createGlyphPath = (
  pathData: string,
): { path: opentype.Path; bbox: ReturnType<typeof getBoundingBox> } => {
  const lines = parsePathToSegments(pathData)
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

for (const [char, pathData] of Object.entries(svgAlphabet)) {
  if (!char) {
    continue
  }

  const codePoint = char.codePointAt(0)

  if (codePoint === undefined) {
    continue
  }

  const { path, bbox } = createGlyphPath(pathData)
  const glyphWidth = (bbox.maxX - bbox.minX) * UNITS_PER_EM

  maxGlyphWidth = Math.max(maxGlyphWidth, glyphWidth)

  glyphData.push({ char, codePoint, path, bbox, glyphWidth })
}

// Proportional spacing: width based on glyph size

// Second pass: create glyphs with fixed monospace width
const glyphs: opentype.Glyph[] = [
  new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: maxGlyphWidth + SIDE_BEARING_MIN * 2,
    path: new opentype.Path(),
  }),
]

for (const { char, codePoint, path, bbox, glyphWidth } of glyphData) {
  const sideBearing = Math.max(
    glyphWidth * SIDE_BEARING_PERCENT,
    SIDE_BEARING_MIN,
  )
  const advanceWidth = glyphWidth + sideBearing * 2
  const leftSideBearing = sideBearing - bbox.minX * UNITS_PER_EM

  glyphs.push(
    new opentype.Glyph({
      name: char,
      unicode: codePoint,
      advanceWidth,
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

const outputPath = join("dist", "TscircuitAlphabet.ttf")
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, Buffer.from(font.toArrayBuffer()))
writeFileSync("TscircuitAlphabet.ttf", Buffer.from(font.toArrayBuffer()))

console.log(`Font written to ${outputPath}`)
