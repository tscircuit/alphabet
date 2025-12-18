import { expect, test, describe } from "bun:test"
import { svgAlphabet } from "../index"

describe("SVG Character Snapshots", () => {
  test("generates a single SVG snapshot for all characters", async () => {
    const characters = Object.keys(svgAlphabet).sort() // Sort for consistent order
    const numChars = characters.length

    if (numChars === 0) {
      const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`
      await expect(emptySvg).toMatchSvgSnapshot(import.meta.path)
      return
    }

    const charRenderWidth = 1 // Each char is normalized to 1x1 design box
    const charRenderHeight = 1
    const margin = 0.1 // Margin around each character visualization, reduced for larger characters

    const effectiveCellWidth = charRenderWidth + margin
    const effectiveCellHeight = charRenderHeight + margin

    // Determine grid dimensions
    const cols = Math.ceil(Math.sqrt(numChars))
    const rows = Math.ceil(numChars / cols)

    // Calculate overall SVG viewBox dimensions
    const viewBoxWidth = cols * effectiveCellWidth
    const viewBoxHeight = rows * effectiveCellHeight

    const pathElements: string[] = []

    for (let i = 0; i < numChars; i++) {
      const char = characters[i]
      const charPath = svgAlphabet[char as keyof typeof svgAlphabet]

      const rowIndex = Math.floor(i / cols)
      const colIndex = i % cols

      // Calculate translation for this character to position it in the grid
      // Paths are defined in a 0,0 to 1,1 box. We add margin/2 to center it in its cell.
      const translateX = colIndex * effectiveCellWidth + margin / 2
      const translateY = rowIndex * effectiveCellHeight + margin / 2

      pathElements.push(
        `  <path d="${charPath}" transform="translate(${translateX.toFixed(
          3,
        )}, ${translateY.toFixed(
          3,
        )})" stroke="black" stroke-width="0.02" fill="none" stroke-linecap="round" stroke-linejoin="round" />`,
      )
    }

    const svgContent = pathElements.join("\n")
    const backgroundRect = `<rect width="${viewBoxWidth.toFixed(
      3,
    )}" height="${viewBoxHeight.toFixed(3)}" fill="white" />`
    const svgOutput = `<svg viewBox="0 0 ${viewBoxWidth.toFixed(
      3,
    )} ${viewBoxHeight.toFixed(
      3,
    )}" xmlns="http://www.w3.org/2000/svg">\n${backgroundRect}\n${svgContent}\n</svg>`

    await expect(svgOutput).toMatchSvgSnapshot(import.meta.path)
  })
})
