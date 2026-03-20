import { describe, expect, test } from "bun:test"

import outlinePolygons from "../outline-polygons"

const ringsToSvgPath = (rings: Array<Array<{ x: number; y: number }>>) =>
  rings
    .map((ring) => {
      const openRing = ring.length > 1 ? ring.slice(0, -1) : ring
      if (openRing.length === 0) {
        return ""
      }

      const [first, ...rest] = openRing
      const commands = [`M${first.x} ${1 - first.y}`]
      for (const point of rest) {
        commands.push(`L${point.x} ${1 - point.y}`)
      }
      commands.push("Z")
      return commands.join(" ")
    })
    .filter(Boolean)
    .join(" ")

describe("Outline Polygon SVG Snapshots", () => {
  test("generates a single SVG snapshot for all outline polygons", async () => {
    const characters = Object.keys(outlinePolygons).sort()
    const numChars = characters.length

    if (numChars === 0) {
      const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`
      await expect(emptySvg).toMatchSvgSnapshot(import.meta.path)
      return
    }

    const charRenderWidth = 1
    const charRenderHeight = 1
    const margin = 0.14
    const effectiveCellWidth = charRenderWidth + margin
    const effectiveCellHeight = charRenderHeight + margin
    const cols = Math.ceil(Math.sqrt(numChars))
    const rows = Math.ceil(numChars / cols)
    const viewBoxWidth = cols * effectiveCellWidth
    const viewBoxHeight = rows * effectiveCellHeight
    const pathElements: string[] = []

    for (let i = 0; i < numChars; i++) {
      const char = characters[i]
      const rowIndex = Math.floor(i / cols)
      const colIndex = i % cols
      const translateX = colIndex * effectiveCellWidth + margin / 2
      const translateY = rowIndex * effectiveCellHeight + margin / 2

      pathElements.push(
        `  <path d="${ringsToSvgPath(
          outlinePolygons[char as keyof typeof outlinePolygons],
        )}" transform="translate(${translateX.toFixed(3)}, ${translateY.toFixed(
          3,
        )})" fill="black" />`,
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
