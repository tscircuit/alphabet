import { union, type MultiPolygon } from "polygon-clipping"

export interface Point {
  x: number
  y: number
}

export type GlyphOutline = Point[][]

type LineSegment = { x1: number; y1: number; x2: number; y2: number }

const EPSILON = 1e-9

const pointsEqual = (a: Point, b: Point, epsilon = EPSILON) =>
  Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon

const dedupeConsecutivePoints = (points: Point[]): Point[] => {
  if (points.length <= 1) {
    return points.slice()
  }

  const deduped: Point[] = [points[0]]
  for (let i = 1; i < points.length; i += 1) {
    if (!pointsEqual(points[i], deduped[deduped.length - 1])) {
      deduped.push(points[i])
    }
  }

  if (
    deduped.length > 1 &&
    pointsEqual(deduped[0], deduped[deduped.length - 1], 1e-8)
  ) {
    deduped.pop()
  }

  return deduped
}

const getSignedArea = (points: Point[]): number => {
  if (points.length < 3) {
    return 0
  }

  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return area / 2
}

const normalizeRing = (points: Point[]): Point[] => {
  const deduped = dedupeConsecutivePoints(points)
  if (deduped.length < 3 || Math.abs(getSignedArea(deduped)) <= 1e-8) {
    return []
  }

  const closed = deduped.map((point) => ({ x: point.x, y: point.y }))
  closed.push({ ...closed[0] })
  return closed
}

export const parseSvgPathToLineSegments = (pathData: string): LineSegment[] => {
  const segments: LineSegment[] = []
  const segs = pathData
    .split("M")
    .slice(1)
    .map((seg) =>
      seg.split("L").map((pair) => pair.trim().split(" ").map(parseFloat)),
    )

  for (const seg of segs) {
    for (let i = 0; i < seg.length - 1; i += 1) {
      segments.push({
        x1: seg[i][0],
        y1: 1 - seg[i][1],
        x2: seg[i + 1][0],
        y2: 1 - seg[i + 1][1],
      })
    }
  }

  return segments
}

const expandLineSegment = (
  p1: Point,
  p2: Point,
  width: number,
  arcSegments = 16,
): Point[] => {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy)

  if (len <= EPSILON) {
    return []
  }

  const radius = width / 2
  const perpX = (-dy / len) * radius
  const perpY = (dx / len) * radius
  const lineAngle = Math.atan2(dy, dx)
  const points: Point[] = []

  points.push({ x: p1.x + perpX, y: p1.y + perpY })
  points.push({ x: p2.x + perpX, y: p2.y + perpY })

  for (let i = 1; i < arcSegments; i += 1) {
    const angle = lineAngle + Math.PI / 2 - (i / arcSegments) * Math.PI
    points.push({
      x: p2.x + Math.cos(angle) * radius,
      y: p2.y + Math.sin(angle) * radius,
    })
  }

  points.push({ x: p2.x - perpX, y: p2.y - perpY })
  points.push({ x: p1.x - perpX, y: p1.y - perpY })

  for (let i = 1; i < arcSegments; i += 1) {
    const angle = lineAngle - Math.PI / 2 - (i / arcSegments) * Math.PI
    points.push({
      x: p1.x + Math.cos(angle) * radius,
      y: p1.y + Math.sin(angle) * radius,
    })
  }

  return points
}

const multiPolygonToRings = (multiPolygon: MultiPolygon): GlyphOutline =>
  multiPolygon
    .flatMap((polygon) =>
      polygon.map((ring) => normalizeRing(ring.map(([x, y]) => ({ x, y })))),
    )
    .filter((ring) => ring.length > 0)

export const createGlyphOutlineFromSvgPath = (
  pathData: string,
  strokeWidthRatio: number,
): GlyphOutline => {
  const lineSegments = parseSvgPathToLineSegments(pathData)
  const bufferedPolygons: Point[][] = []

  for (const segment of lineSegments) {
    const polygon = expandLineSegment(
      { x: segment.x1, y: segment.y1 },
      { x: segment.x2, y: segment.y2 },
      strokeWidthRatio,
    )
    if (polygon.length > 0) {
      bufferedPolygons.push(polygon)
    }
  }

  if (bufferedPolygons.length === 0) {
    return []
  }

  try {
    const [firstPolygon, ...restPolygons] = bufferedPolygons.map((points) => [
      points.map((point) => [point.x, point.y] as [number, number]),
    ])
    if (!firstPolygon) {
      return []
    }

    const unified = union(firstPolygon, ...restPolygons)
    return multiPolygonToRings(unified)
  } catch (error) {
    console.warn(
      "Outline union failed, falling back to per-segment polygons",
      error,
    )
    return bufferedPolygons
      .map((polygon) => normalizeRing(polygon))
      .filter((polygon) => polygon.length > 0)
  }
}
