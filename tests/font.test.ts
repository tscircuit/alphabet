import { expect, test, describe } from "bun:test"
import opentype from "opentype.js"
import { buildFont } from "../generateFont"

const font = buildFont()
const characters = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");

function glyphToPathData(glyph: opentype.Glyph): string {
  let d = ""
  let prevX = 0
  let prevY = 0
  let started = false

  const box = glyph.getBoundingBox()
  const width = box.x2 - box.x1
  const height = box.y2 - box.y1
  const scale = 1 / Math.max(width, height)

  function normX(x: number) {
    return ((x - box.x1) * scale).toFixed(3)
  }

  function normY(y: number) {
    return (1 - (y - box.y1) * scale).toFixed(3)
  }

  function addLine(x: number, y: number) {
    d += `${started ? "L" : "M"}${normX(x)} ${normY(y)}`
    started = true
  }

  function cubic(p0: number, p1: number, p2: number, p3: number, t: number) {
    const mt = 1 - t
    return (
      mt * mt * mt * p0 +
      3 * mt * mt * t * p1 +
      3 * mt * t * t * p2 +
      t * t * t * p3
    )
  }

  function quad(p0: number, p1: number, p2: number, t: number) {
    const mt = 1 - t
    return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2
  }

  for (const cmd of glyph.path.commands) {
    if (cmd.type === "M") {
      addLine(cmd.x, cmd.y)
      prevX = cmd.x
      prevY = cmd.y
    } else if (cmd.type === "L") {
      addLine(cmd.x, cmd.y)
      prevX = cmd.x
      prevY = cmd.y
    } else if (cmd.type === "C") {
      for (let t = 0.1; t <= 1; t += 0.1) {
        addLine(
          cubic(prevX, cmd.x1, cmd.x2, cmd.x, t),
          cubic(prevY, cmd.y1, cmd.y2, cmd.y, t),
        )
      }
      prevX = cmd.x
      prevY = cmd.y
    } else if (cmd.type === "Q") {
      for (let t = 0.1; t <= 1; t += 0.1) {
        addLine(
          quad(prevX, cmd.x1, cmd.x, t),
          quad(prevY, cmd.y1, cmd.y, t),
        )
      }
      prevX = cmd.x
      prevY = cmd.y
    } else if (cmd.type === "Z") {
      // Ignore close commands to keep a single stroke
    }
  }
  return d
}

describe("Alphabet Font SVG", () => {
  test("generates svg snapshot from font", async () => {
    const numChars = characters.length

    if (numChars === 0) {
      const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`
      await expect(emptySvg).toMatchSvgSnapshot(import.meta.path)
      return
    }

    const charRenderWidth = 1
    const charRenderHeight = 1
    const margin = 0.1

    const effectiveCellWidth = charRenderWidth + margin
    const effectiveCellHeight = charRenderHeight + margin

    const cols = Math.ceil(Math.sqrt(numChars))
    const rows = Math.ceil(numChars / cols)

    const viewBoxWidth = cols * effectiveCellWidth
    const viewBoxHeight = rows * effectiveCellHeight

    const pathElements: string[] = []
    for (let i = 0; i < numChars; i++) {
      const char = characters[i]
      const glyph = font.charToGlyph(char)
      const pathData = glyphToPathData(glyph)

      const rowIndex = Math.floor(i / cols)
      const colIndex = i % cols
      const translateX = colIndex * effectiveCellWidth + margin / 2
      const translateY = rowIndex * effectiveCellHeight + margin / 2

      pathElements.push(
        `  <path d="${pathData}" transform="translate(${translateX.toFixed(3)}, ${translateY.toFixed(3)})" stroke="black" stroke-width="0.02" fill="none" stroke-linecap="round" stroke-linejoin="round" />`,
      )
    }

    const svgContent = pathElements.join("\n")
    const backgroundRect = `<rect width="${viewBoxWidth.toFixed(3)}" height="${viewBoxHeight.toFixed(3)}" fill="white" />`
    const svgOutput = `<svg viewBox="0 0 ${viewBoxWidth.toFixed(3)} ${viewBoxHeight.toFixed(3)}" xmlns="http://www.w3.org/2000/svg">\n${backgroundRect}\n${svgContent}\n</svg>`

    await expect(svgOutput).toMatchSvgSnapshot(import.meta.path)
  })
})
