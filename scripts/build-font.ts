import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import * as opentype from "opentype.js"
import { Polygon, BooleanOperations } from "@flatten-js/core"

import { svgAlphabet } from "../index.ts"

const UNITS_PER_EM = 1000
const ASCENDER = 905
const DESCENDER = -212
const STROKE_WIDTH = 0.12
const SIDE_BEARING_PERCENT = 0.1
const NORMALIZED_BASELINE = 0.76
const DESCENDER_CHARS = new Set(["g", "j", "p", "q", "y", ","])

interface Point {
  x: number
  y: number
}

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
        currentLine = [{ x, y: 1 - y }]
      } else if (type === "L") {
        currentLine.push({ x, y: 1 - y })
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine)
  }

  return lines
}

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
  const perpX = (-dy / len) * radius
  const perpY = (dx / len) * radius
  const lineAngle = Math.atan2(dy, dx)

  const points: Point[] = []

  points.push({ x: p1.x + perpX, y: p1.y + perpY })
  points.push({ x: p2.x + perpX, y: p2.y + perpY })

  for (let i = 1; i < segments; i++) {
    const angle = lineAngle + Math.PI / 2 - (i / segments) * Math.PI
    points.push({
      x: p2.x + Math.cos(angle) * radius,
      y: p2.y + Math.sin(angle) * radius,
    })
  }

  points.push({ x: p2.x - perpX, y: p2.y - perpY })
  points.push({ x: p1.x - perpX, y: p1.y - perpY })

  for (let i = 1; i < segments; i++) {
    const angle = lineAngle - Math.PI / 2 - (i / segments) * Math.PI
    points.push({
      x: p1.x + Math.cos(angle) * radius,
      y: p1.y + Math.sin(angle) * radius,
    })
  }

  return points
}

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

const polygonToPath = (
  polygons: Point[][],
  normalizeBaseline: boolean,
  bbox: ReturnType<typeof getBoundingBox>,
): opentype.Path => {
  const path = new opentype.Path()
  const yOffset = -NORMALIZED_BASELINE * ASCENDER

  for (const polygon of polygons) {
    if (polygon.length === 0) continue

    const first = polygon[0]
    path.moveTo(first.x * UNITS_PER_EM, first.y * ASCENDER + yOffset)

    for (let i = 1; i < polygon.length; i++) {
      const pt = polygon[i]
      path.lineTo(pt.x * UNITS_PER_EM, pt.y * ASCENDER + yOffset)
    }

    path.closePath()
  }

  return path
}

const createGlyphPath = (
  pathData: string,
  normalizeBaseline: boolean,
): { path: opentype.Path; bbox: ReturnType<typeof getBoundingBox> } => {
  const lines = parsePathToSegments(pathData)
  const allPolygons: Point[][] = []

  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const capsule = expandLineSegment(line[i], line[i + 1], STROKE_WIDTH)
      if (capsule.length > 0) {
        allPolygons.push(capsule)
      }
    }
  }

  try {
    if (allPolygons.length === 0) {
      return {
        path: new opentype.Path(),
        bbox: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      }
    }

    const polygons = allPolygons.map(
      (pts) => new Polygon(pts.map((p) => [p.x, p.y])),
    )

    let unified = polygons[0]
    for (let i = 1; i < polygons.length; i++) {
      unified = BooleanOperations.unify(unified, polygons[i])
    }

    const resultPolygons: Point[][] = []
    for (const face of unified.faces) {
      const points: Point[] = []
      for (const edge of face.edges) {
        points.push({ x: edge.start.x, y: edge.start.y })
      }
      resultPolygons.push(points)
    }

    const bbox = getBoundingBox(resultPolygons)
    return {
      path: polygonToPath(resultPolygons, normalizeBaseline, bbox),
      bbox,
    }
  } catch (error) {
    console.warn("Boolean union failed, using simple polygons", error)
    const bbox = getBoundingBox(allPolygons)
    return { path: polygonToPath(allPolygons, normalizeBaseline, bbox), bbox }
  }
}

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

  const normalizeBaseline = !DESCENDER_CHARS.has(char)
  const { path, bbox } = createGlyphPath(pathData, normalizeBaseline)
  const glyphWidth = (bbox.maxX - bbox.minX) * UNITS_PER_EM

  maxGlyphWidth = Math.max(maxGlyphWidth, glyphWidth)

  glyphData.push({ char, codePoint, path, bbox, glyphWidth })
}

const MONOSPACE_WIDTH = maxGlyphWidth + maxGlyphWidth * SIDE_BEARING_PERCENT * 2

const glyphs: opentype.Glyph[] = [
  new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: MONOSPACE_WIDTH,
    path: new opentype.Path(),
  }),
]

for (const { char, codePoint, path, bbox, glyphWidth } of glyphData) {
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

const outputPath = join("dist", "TscircuitAlphabet.ttf")
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, Buffer.from(font.toArrayBuffer()))
writeFileSync("TscircuitAlphabet.ttf", Buffer.from(font.toArrayBuffer()))

console.log(`Font written to ${outputPath}`)
