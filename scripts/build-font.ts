import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import * as opentype from "opentype.js"
import { Polygon, BooleanOperations } from "@flatten-js/core"

import { svgAlphabet } from "../index.ts"

const UNITS_PER_EM = 1000
// Match Arial's proportions: ascender at ~90.5% and descender at ~21.2% of em
const ASCENDER = 905
const DESCENDER = -212
const STROKE_WIDTH = 0.12 // Adjust this to make the font thicker or thinner
const SIDE_BEARING_PERCENT = 0.05 // 10% of glyph width on each side

type ArialMetrics = {
  width: number
  height: number
  advanceWidth: number
  leftSideBearing: number
  rightSideBearing: number
  yMin: number
  yMax: number
}

const arialMetricsPath = new URL("./arial-metrics.json", import.meta.url)
const arialMetricsData = JSON.parse(
  readFileSync(arialMetricsPath, "utf8"),
) as Record<string, ArialMetrics>
const useArialSpacing = Object.keys(arialMetricsData).length > 0

const getArialGlyphMetrics = (char: string): ArialMetrics | null => {
  const metrics = arialMetricsData[char]
  if (!metrics) {
    return null
  }
  if (
    !(metrics.width > 0) ||
    !(metrics.height > 0) ||
    !(metrics.advanceWidth > 0)
  ) {
    return null
  }
  return metrics
}

const translatePath = (path: opentype.Path, dx: number, dy: number) => {
  if (dx === 0 && dy === 0) {
    return
  }

  for (const command of path.commands) {
    if ("x1" in command && typeof command.x1 === "number") {
      command.x1 += dx
    }
    if ("y1" in command && typeof command.y1 === "number") {
      command.y1 += dy
    }
    if ("x2" in command && typeof command.x2 === "number") {
      command.x2 += dx
    }
    if ("y2" in command && typeof command.y2 === "number") {
      command.y2 += dy
    }
    if ("x" in command && typeof command.x === "number") {
      command.x += dx
    }
    if ("y" in command && typeof command.y === "number") {
      command.y += dy
    }
  }
}

interface Point {
  x: number
  y: number
}

// Parse SVG path data into line segments (supports implicit L after M).
const parsePathToSegments = (pathData: string): Point[][] => {
  const lines: Point[][] = []
  let currentLine: Point[] = []
  let currentPoint: Point | null = null

  const commandTokenRegex = /[MLml]/g
  let lastCommand: { cmd: string; index: number } | null = null
  let match: RegExpExecArray | null

  const flushLine = () => {
    if (currentLine.length > 0) {
      lines.push(currentLine)
      currentLine = []
    }
  }

  const applyCommand = (cmd: string, data: string) => {
    const numbers = data.match(/[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/g)
    if (!numbers || numbers.length < 2) {
      return
    }

    const isRelative = cmd === cmd.toLowerCase()
    const command = cmd.toUpperCase()
    let isFirstPair = true

    for (let i = 0; i + 1 < numbers.length; i += 2) {
      let x = Number.parseFloat(numbers[i])
      let y = Number.parseFloat(numbers[i + 1])

      if (Number.isNaN(x) || Number.isNaN(y)) {
        continue
      }

      if (isRelative && currentPoint) {
        x += currentPoint.x
        y += currentPoint.y
      }

      const rawPoint = { x, y }
      const flippedPoint = { x, y: 1 - y }

      if (command === "M" && isFirstPair) {
        flushLine()
        currentLine = [flippedPoint]
        currentPoint = rawPoint
        isFirstPair = false
        continue
      }

      if (command === "M" || command === "L") {
        if (currentLine.length === 0 && currentPoint === null) {
          currentLine = [flippedPoint]
        } else {
          currentLine.push(flippedPoint)
        }
        currentPoint = rawPoint
      }

      isFirstPair = false
    }
  }

  while ((match = commandTokenRegex.exec(pathData)) !== null) {
    if (lastCommand) {
      const data = pathData.slice(lastCommand.index + 1, match.index)
      applyCommand(lastCommand.cmd, data)
    }
    lastCommand = { cmd: match[0], index: match.index }
  }

  if (lastCommand) {
    const data = pathData.slice(lastCommand.index + 1)
    applyCommand(lastCommand.cmd, data)
  }

  flushLine()
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

// Convert polygon points to opentype.js path.
const polygonToPath = (
  polygons: Point[][],
  scaleX: number,
  scaleY: number,
): opentype.Path => {
  const path = new opentype.Path()

  for (const polygon of polygons) {
    if (polygon.length === 0) continue

    const first = polygon[0]
    path.moveTo(first.x * UNITS_PER_EM * scaleX, first.y * ASCENDER * scaleY)

    for (let i = 1; i < polygon.length; i++) {
      const pt = polygon[i]
      path.lineTo(pt.x * UNITS_PER_EM * scaleX, pt.y * ASCENDER * scaleY)
    }

    path.closePath()
  }

  return path
}

const createGlyphPolygons = (
  pathData: string,
): { polygons: Point[][]; bbox: ReturnType<typeof getBoundingBox> } => {
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
        polygons: [],
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
    return { polygons: resultPolygons, bbox }
  } catch (error) {
    console.warn("Boolean union failed, using simple polygons", error)
    const bbox = getBoundingBox(allPolygons)
    return { polygons: allPolygons, bbox }
  }
}

// First pass: calculate all glyph data and find the maximum width
const glyphData: Array<{
  char: string
  codePoint: number
  path: opentype.Path
  bbox: ReturnType<typeof getBoundingBox>
  glyphWidth: number
  advanceWidth: number
  scaleX: number
  leftSideBearing: number
  xMin: number
}> = []

let maxAdvanceWidth = 0

for (const [char, pathData] of Object.entries(svgAlphabet)) {
  if (!char) {
    continue
  }

  const codePoint = char.codePointAt(0)

  if (codePoint === undefined) {
    continue
  }

  const { polygons, bbox } = createGlyphPolygons(pathData)
  const bboxWidth = bbox.maxX - bbox.minX
  const bboxHeight = bbox.maxY - bbox.minY
  const currentWidth = bboxWidth * UNITS_PER_EM
  const currentHeight = bboxHeight * ASCENDER

  const arialMetrics = getArialGlyphMetrics(char)
  const scaleX =
    arialMetrics && currentWidth > 0 ? arialMetrics.width / currentWidth : 1
  const scaleY =
    arialMetrics && currentHeight > 0 ? arialMetrics.height / currentHeight : 1

  const path = polygonToPath(polygons, scaleX, scaleY)
  const glyphWidth = currentWidth * scaleX
  const xMin = bbox.minX * UNITS_PER_EM * scaleX
  const advanceWidth =
    arialMetrics && arialMetrics.advanceWidth > 0
      ? arialMetrics.advanceWidth
      : glyphWidth + glyphWidth * SIDE_BEARING_PERCENT * 2
  const fallbackLeftSideBearing = (advanceWidth - glyphWidth) / 2
  const leftSideBearing = arialMetrics
    ? arialMetrics.leftSideBearing
    : fallbackLeftSideBearing
  const yMin = bbox.minY * ASCENDER * scaleY
  const yShift = arialMetrics && useArialSpacing ? arialMetrics.yMin - yMin : 0

  if (useArialSpacing) {
    const xShift = leftSideBearing - xMin
    translatePath(path, xShift, yShift)
  }

  maxAdvanceWidth = Math.max(maxAdvanceWidth, advanceWidth)

  glyphData.push({
    char,
    codePoint,
    path,
    bbox,
    glyphWidth,
    advanceWidth,
    scaleX,
    leftSideBearing,
    xMin,
  })
}

// Calculate fixed monospace width based on the widest glyph (fallback mode).
const MONOSPACE_WIDTH = maxAdvanceWidth

// Second pass: create glyphs with fixed monospace width
const glyphs: opentype.Glyph[] = [
  new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: MONOSPACE_WIDTH,
    path: new opentype.Path(),
  }),
]

for (const {
  char,
  codePoint,
  path,
  advanceWidth,
  leftSideBearing,
  glyphWidth,
  xMin,
} of glyphData) {
  const targetAdvanceWidth = useArialSpacing ? advanceWidth : MONOSPACE_WIDTH
  const targetLeftSideBearing = useArialSpacing
    ? leftSideBearing
    : (targetAdvanceWidth - glyphWidth) / 2

  if (!useArialSpacing) {
    const xShift = targetLeftSideBearing - xMin
    translatePath(path, xShift, 0)
  }

  glyphs.push(
    new opentype.Glyph({
      name: char,
      unicode: codePoint,
      advanceWidth: targetAdvanceWidth,
      path,
      leftSideBearing: targetLeftSideBearing,
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
