import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import * as opentype from "opentype.js"
import { Polygon, BooleanOperations } from "@flatten-js/core"

import { svgAlphabet } from "../index.ts"

const UNITS_PER_EM = 1000
const ASCENDER = UNITS_PER_EM
const DESCENDER = 0
const STROKE_WIDTH = 0.05 // Adjust this to make the font thicker or thinner
const ADVANCE_WIDTH = UNITS_PER_EM * 1.2 // Add extra space for better letter spacing

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

// Create a rectangle polygon around a line segment
const expandLineSegment = (p1: Point, p2: Point, width: number): Point[] => {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.sqrt(dx * dx + dy * dy)

  if (len === 0) return []

  // Perpendicular unit vector
  const perpX = (-dy / len) * (width / 2)
  const perpY = (dx / len) * (width / 2)

  // Create a rectangle around the line
  return [
    { x: p1.x + perpX, y: p1.y + perpY },
    { x: p2.x + perpX, y: p2.y + perpY },
    { x: p2.x - perpX, y: p2.y - perpY },
    { x: p1.x - perpX, y: p1.y - perpY },
  ]
}

// Convert polygon points to opentype.js path
const polygonToPath = (polygons: Point[][]): opentype.Path => {
  const path = new opentype.Path()

  for (const polygon of polygons) {
    if (polygon.length === 0) continue

    const first = polygon[0]
    path.moveTo(first.x * UNITS_PER_EM, first.y * UNITS_PER_EM)

    for (let i = 1; i < polygon.length; i++) {
      const pt = polygon[i]
      path.lineTo(pt.x * UNITS_PER_EM, pt.y * UNITS_PER_EM)
    }

    path.closePath()
  }

  return path
}

const createGlyphPath = (pathData: string) => {
  const lines = parsePathToSegments(pathData)
  const allPolygons: Point[][] = []

  // Expand each line segment into a polygon
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const rect = expandLineSegment(line[i], line[i + 1], STROKE_WIDTH)
      if (rect.length > 0) {
        allPolygons.push(rect)
      }
    }
  }

  // Use boolean union to merge overlapping polygons
  try {
    if (allPolygons.length === 0) {
      return new opentype.Path()
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

    return polygonToPath(resultPolygons)
  } catch (error) {
    console.warn("Boolean union failed, using simple polygons", error)
    return polygonToPath(allPolygons)
  }
}

const glyphs: opentype.Glyph[] = [
  new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: ADVANCE_WIDTH,
    path: new opentype.Path(),
  }),
]

for (const [char, pathData] of Object.entries(svgAlphabet)) {
  if (!char) {
    continue
  }

  const codePoint = char.codePointAt(0)

  if (codePoint === undefined) {
    continue
  }

  let charAdvanceWidth = ADVANCE_WIDTH

  if (char === " ") {
    charAdvanceWidth = UNITS_PER_EM * 0.6
  }

  glyphs.push(
    new opentype.Glyph({
      name: char,
      unicode: codePoint,
      advanceWidth: charAdvanceWidth,
      path: createGlyphPath(pathData),
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
