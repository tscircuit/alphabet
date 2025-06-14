import { expect, test, describe } from "bun:test"
import opentype from "opentype.js"
import { buildFont, unitsPerEm } from "../generateFont"

const font = buildFont()
const characters = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");

function glyphToPathData(glyph: opentype.Glyph): string {
  let d = ""
  for (const cmd of glyph.path.commands) {
    if (cmd.type === "M") {
      d += `M${(cmd.x / unitsPerEm).toFixed(3)} ${(1 - cmd.y / unitsPerEm).toFixed(3)}`
    } else if (cmd.type === "L") {
      d += `L${(cmd.x / unitsPerEm).toFixed(3)} ${(1 - cmd.y / unitsPerEm).toFixed(3)}`
    } else if (cmd.type === "Z") {
      d += "Z"
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
