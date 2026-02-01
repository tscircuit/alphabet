import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as opentype from "opentype.js"

import { svgAlphabet } from "../index.ts"

const UNITS_PER_EM = 1000
const DESIGN_HEIGHT = UNITS_PER_EM
const STROKE_WIDTH = 0
const VERTICAL_SCALE = 0.93
const HORIZONTAL_SCALE = 0.8

type ArialMetrics = {
  width: number
  height: number
  advanceWidth: number
  leftSideBearing: number
  rightSideBearing: number
  yMin: number
  yMax: number
}

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
  throw new Error("Arial font not found; cannot generate svg alphabet paths.")
}

const arialFont = opentype.loadSync(arialPath)
const arialScale = UNITS_PER_EM / arialFont.unitsPerEm
const useArialSpacing = true

const getArialGlyphMetrics = (char: string): ArialMetrics | null => {
  const glyph = arialFont.charToGlyph(char)
  const bbox = glyph.getBoundingBox()
  const width = (bbox.x2 - bbox.x1) * arialScale
  const height = (bbox.y2 - bbox.y1) * arialScale
  const advanceWidth = (glyph.advanceWidth || 0) * arialScale
  const leftSideBearing = bbox.x1 * arialScale
  const rightSideBearing = advanceWidth - bbox.x2 * arialScale
  const yMin = bbox.y1 * arialScale
  const yMax = bbox.y2 * arialScale

  if (!(width > 0) || !(height > 0) || !(advanceWidth > 0)) {
    return null
  }

  return {
    width,
    height,
    advanceWidth,
    leftSideBearing,
    rightSideBearing,
    yMin,
    yMax,
  }
}

interface Point {
  x: number
  y: number
}

interface Subpath {
  points: Point[]
  closed: boolean
}

const parsePathData = (pathData: string): Subpath[] => {
  const subpaths: Subpath[] = []
  let current: Subpath | null = null
  let currentPoint: Point | null = null
  let subpathStart: Point | null = null

  const commandTokenRegex = /[MLmlZz]/g
  let lastCommand: { cmd: string; index: number } | null = null
  let match: RegExpExecArray | null

  const flushCurrent = () => {
    if (current && current.points.length > 0) {
      subpaths.push(current)
    }
    current = null
    subpathStart = null
  }

  const ensureCurrent = (point: Point) => {
    if (!current) {
      current = { points: [point], closed: false }
      subpathStart = point
    } else if (current.points.length === 0) {
      current.points.push(point)
      subpathStart = point
    }
  }

  const applyCommand = (cmd: string, data: string) => {
    const command = cmd.toUpperCase()
    if (command === "Z") {
      if (current) {
        current.closed = true
      }
      if (subpathStart) {
        currentPoint = { ...subpathStart }
      }
      return
    }

    const numbers = data.match(/[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/g)
    if (!numbers || numbers.length < 2) {
      return
    }

    const isRelative = cmd === cmd.toLowerCase()
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

      const nextPoint = { x, y }

      if (command === "M" && isFirstPair) {
        flushCurrent()
        current = { points: [nextPoint], closed: false }
        subpathStart = nextPoint
        currentPoint = nextPoint
        isFirstPair = false
        continue
      }

      if (command === "M" || command === "L") {
        if (!current) {
          current = { points: [nextPoint], closed: false }
          subpathStart = nextPoint
        } else {
          current.points.push(nextPoint)
        }
        currentPoint = nextPoint
      }

      isFirstPair = false
    }
  }

  while (true) {
    match = commandTokenRegex.exec(pathData)
    if (!match) {
      break
    }
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

  flushCurrent()
  return subpaths
}

const getBoundingBox = (
  subpaths: Subpath[],
): { minX: number; maxX: number; minY: number; maxY: number } => {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const subpath of subpaths) {
    for (const point of subpath.points) {
      const y = 1 - point.y
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  }

  return { minX, maxX, minY, maxY }
}

const formatNumber = (value: number) => {
  const rounded = Number(value.toFixed(6))
  const generated = Object.is(rounded, -0) ? 0 : rounded
  return generated.toString()
}

const serializeSubpaths = (subpaths: Subpath[]): string => {
  const parts: string[] = []

  for (const subpath of subpaths) {
    if (subpath.points.length === 0) {
      continue
    }

    const [first, ...rest] = subpath.points
    parts.push(`M${formatNumber(first.x)} ${formatNumber(first.y)}`)

    for (const point of rest) {
      parts.push(`L${formatNumber(point.x)} ${formatNumber(point.y)}`)
    }

    if (subpath.closed) {
      parts.push("Z")
    }
  }

  return parts.join(" ")
}

const transformSubpaths = (
  subpaths: Subpath[],
  scaleX: number,
  scaleY: number,
  xShift: number,
  yShift: number,
): Subpath[] =>
  subpaths.map((subpath) => ({
    closed: subpath.closed,
    points: subpath.points.map((point) => {
      const yCartesian = 1 - point.y
      const xScaled = point.x * scaleX + xShift
      const yScaled = yCartesian * scaleY + yShift
      return { x: xScaled, y: 1 - yScaled }
    }),
  }))

const generatedAlphabet: Record<string, string> = {}

for (const [char, pathData] of Object.entries(svgAlphabet)) {
  const subpaths = parsePathData(pathData)
  if (subpaths.length === 0) {
    generatedAlphabet[char] = pathData
    continue
  }

  const bbox = getBoundingBox(subpaths)
  const strokePad = STROKE_WIDTH / 2
  const paddedMinX = bbox.minX - strokePad
  const paddedMaxX = bbox.maxX + strokePad
  const paddedMinY = bbox.minY - strokePad
  const paddedMaxY = bbox.maxY + strokePad
  const bboxWidth = paddedMaxX - paddedMinX
  const bboxHeight = paddedMaxY - paddedMinY
  const currentWidth = bboxWidth * UNITS_PER_EM
  const currentHeight = bboxHeight * DESIGN_HEIGHT
  const arialMetrics = getArialGlyphMetrics(char)
  const scaleX =
    arialMetrics && currentWidth > 0
      ? (arialMetrics.width / currentWidth) * HORIZONTAL_SCALE
      : 1
  const scaleY =
    arialMetrics && currentHeight > 0
      ? (arialMetrics.height / currentHeight) * VERTICAL_SCALE
      : 1

  const xMinScaled = paddedMinX * scaleX
  const yMaxScaled = paddedMaxY * scaleY
  const xShift = -xMinScaled
  const yShift =
    useArialSpacing && arialMetrics
      ? arialMetrics.yMax / DESIGN_HEIGHT - yMaxScaled
      : 0

  const transformed = transformSubpaths(
    subpaths,
    scaleX,
    scaleY,
    xShift,
    yShift,
  )

  generatedAlphabet[char] = serializeSubpaths(transformed)
}

const indexPath = join(import.meta.dir, "..", "index.ts")
const indexContent = readFileSync(indexPath, "utf8")
const serializedAlphabet = JSON.stringify(generatedAlphabet, null, 2)
const updatedIndex = indexContent.replace(
  /export const svgAlphabet\s*=\s*\{[\s\S]*?\}\n/,
  `export const svgAlphabet = ${serializedAlphabet}\n`,
)

writeFileSync(indexPath, updatedIndex)
console.log("✓ generated SVG alphabet paths written to index.ts")
