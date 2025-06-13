import { openSync } from "fontkit"

// Characters to extract paths for
const CHARACTERS =
  "0123456789" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "abcdefghijklmnopqrstuvwxyz" +
  ".,:;!?\"\u00b0$/()|-+='#&\\_*[]{}<>~%@"

const FONT_PATH =
  process.env.FONT_PATH ?? "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

const font = openSync(FONT_PATH)

export const fontkitAlphabet: Record<string, string> = {}

const run = font.layout(CHARACTERS)

for (let i = 0; i < run.glyphs.length; i++) {
  const glyph = run.glyphs[i]
  const char = CHARACTERS[i]
  const { minX, minY, maxX, maxY } = glyph.bbox
  const width = maxX - minX || 1
  const height = maxY - minY || 1

  const segments: string[] = []
  const seenSegments = new Set<string>()
  let currentX = 0
  let currentY = 0
  let startX = 0
  let startY = 0
  let lastSegment: string | null = null

  for (const cmd of glyph.path.commands) {
    switch (cmd.command) {
      case "moveTo":
        currentX = cmd.args[0]
        currentY = cmd.args[1]
        startX = currentX
        startY = currentY
        {
          const seg = `M${((currentX - minX) / width).toFixed(3)} ${(
            (maxY - currentY) /
            height
          ).toFixed(3)}`
          if (seg !== lastSegment && !seenSegments.has(seg)) {
            segments.push(seg)
            seenSegments.add(seg)
            lastSegment = seg
          }
        }
        break
      case "lineTo":
        currentX = cmd.args[0]
        currentY = cmd.args[1]
        {
          const seg = `L${((currentX - minX) / width).toFixed(3)} ${(
            (maxY - currentY) /
            height
          ).toFixed(3)}`
          if (seg !== lastSegment && !seenSegments.has(seg)) {
            segments.push(seg)
            seenSegments.add(seg)
            lastSegment = seg
          }
        }
        break
      case "quadraticCurveTo":
        // Approximate quadratic curves with a straight line to the end point
        currentX = cmd.args[2]
        currentY = cmd.args[3]
        {
          const seg = `L${((currentX - minX) / width).toFixed(3)} ${(
            (maxY - currentY) /
            height
          ).toFixed(3)}`
          if (seg !== lastSegment && !seenSegments.has(seg)) {
            segments.push(seg)
            seenSegments.add(seg)
            lastSegment = seg
          }
        }
        break
      case "bezierCurveTo":
        // Approximate cubic curves with a straight line to the end point
        currentX = cmd.args[4]
        currentY = cmd.args[5]
        {
          const seg = `L${((currentX - minX) / width).toFixed(3)} ${(
            (maxY - currentY) /
            height
          ).toFixed(3)}`
          if (seg !== lastSegment && !seenSegments.has(seg)) {
            segments.push(seg)
            seenSegments.add(seg)
            lastSegment = seg
          }
        }
        break
      case "closePath":
        // Ignore the closing segment to avoid drawing strokes twice
        break
    }
  }
  // Deduplicate segments so each stroke is drawn only once
  fontkitAlphabet[char] = segments.join("")
}
