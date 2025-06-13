import { expect, test, describe } from "bun:test"
import { fontkitAlphabet } from "../fontkitAlphabet"

describe("SVG Character Snapshots", () => {
  test("generates a single SVG snapshot for all characters", async () => {
    const characters = Object.keys(fontkitAlphabet).sort()
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
      const charPath = fontkitAlphabet[char as keyof typeof fontkitAlphabet]

      const rowIndex = Math.floor(i / cols)
      const colIndex = i % cols

      const translateX = colIndex * effectiveCellWidth + margin / 2
      const translateY = rowIndex * effectiveCellHeight + margin / 2

      pathElements.push(
        `  <path d="${charPath}" transform="translate(${translateX.toFixed(3)},${translateY.toFixed(3)})" stroke="black" stroke-width="0.005" fill="none" stroke-linecap="round" stroke-linejoin="round" />`,
      )
    }

    const svgContent = pathElements.join("\n")
    const backgroundRect = `<rect width="${viewBoxWidth.toFixed(3)}" height="${viewBoxHeight.toFixed(3)}" fill="white" />`
    const svgOutput = `<svg viewBox="0 0 ${viewBoxWidth.toFixed(3)} ${viewBoxHeight.toFixed(3)}" xmlns="http://www.w3.org/2000/svg">\n${backgroundRect}\n${svgContent}\n</svg>`

    await expect(svgOutput).toMatchSvgSnapshot(import.meta.path)
  })
})
