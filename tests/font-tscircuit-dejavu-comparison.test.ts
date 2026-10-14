import { expect, test } from "bun:test"
import { Resvg } from "@resvg/resvg-js"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as opentype from "opentype.js"

import { svgAlphabet } from "../index"

const DEJAVU_PATHS = [
  join(process.cwd(), "assets", "DejaVuSansMono.ttf"),
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Oblique.ttf",
  join(process.env.HOME || "", "Library", "Fonts", "DejaVuSansMono.ttf"),
  join(process.env.HOME || "", "Library", "Fonts", "DejaVuSansMono-Bold.ttf"),
  join(
    process.env.HOME || "",
    "Library",
    "Fonts",
    "DejaVuSansMono-Oblique.ttf",
  ),
  "/Library/Fonts/DejaVuSansMono.ttf",
  "C:\\Windows\\Fonts\\DejaVuSansMono.ttf",
]

const findDejaVuPath = (): string | null => {
  for (const path of DEJAVU_PATHS) {
    if (existsSync(path)) {
      return path
    }
  }
  return null
}

const escapeXml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

const getGlyphBoundingBox = (font: opentype.Font, char: string) => {
  const glyph = font.charToGlyph(char)
  const bbox = glyph.getBoundingBox()
  return {
    width: Number.isFinite(bbox.x2 - bbox.x1) ? bbox.x2 - bbox.x1 : 0,
    height: Number.isFinite(bbox.y2 - bbox.y1) ? bbox.y2 - bbox.y1 : 0,
  }
}

test("renders glyph ratios vs DejaVu Sans Mono", async () => {
  const dejavuPath = findDejaVuPath()
  if (!dejavuPath) {
    console.warn("DejaVu Sans Mono font not found; skipping comparison test.")
    return
  }

  const fontPath = join(process.cwd(), "TscircuitAlphabet.ttf")
  if (!existsSync(fontPath)) {
    throw new Error(`Missing font file at ${fontPath}`)
  }

  const ourFont = opentype.loadSync(fontPath)
  const dejavuFont = opentype.loadSync(dejavuPath)

  const characters = Object.keys(svgAlphabet).sort()
  const fontSize = 72
  const lineHeight = Math.round(fontSize * 1.35)
  const padding = Math.round(fontSize * 0.6)
  const columnGap = Math.round(fontSize * 0.6)
  const ratioFontSize = Math.round(fontSize * 0.35)
  const ratioColumnWidth = ratioFontSize * 12

  const rows = characters.map((char) => {
    const ourBox = getGlyphBoundingBox(ourFont, char)
    const referenceBox = getGlyphBoundingBox(dejavuFont, char)
    const referenceWidthScaled =
      referenceBox.width * (ourFont.unitsPerEm / dejavuFont.unitsPerEm)
    const referenceHeightScaled =
      referenceBox.height * (ourFont.unitsPerEm / dejavuFont.unitsPerEm)
    const widthRatio =
      referenceWidthScaled > 0 ? ourBox.width / referenceWidthScaled : null
    const heightRatio =
      referenceHeightScaled > 0 ? ourBox.height / referenceHeightScaled : null
    return {
      char,
      ratioLabel: `w:${widthRatio === null ? "n/a" : widthRatio.toFixed(2)} h:${
        heightRatio === null ? "n/a" : heightRatio.toFixed(2)
      }`,
    }
  })

  const width = padding * 2 + fontSize * 2 + columnGap * 2 + ratioColumnWidth
  const height = padding * 2 + rows.length * lineHeight

  const svgRows = rows
    .map((row, index) => {
      const y = padding + fontSize + index * lineHeight
      const xOur = padding
      const xLib = padding + fontSize + columnGap
      const xRatio = padding + fontSize * 2 + columnGap * 2
      return `
  <text x="${xOur}" y="${y}" font-family="TscircuitAlphabet" font-size="${fontSize}" fill="black">${escapeXml(
    row.char,
  )}</text>
  <text x="${xLib}" y="${y}" font-family="DejaVu Sans Mono" font-size="${fontSize}" fill="black">${escapeXml(
    row.char,
  )}</text>
  <text x="${xRatio}" y="${y}" font-family="DejaVu Sans Mono" font-size="${ratioFontSize}" fill="black">${
    row.ratioLabel
  }</text>`
    })
    .join("\n")

  const svgString = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="white"/>
  ${svgRows}
</svg>`

  const resvg = new Resvg(svgString, {
    font: {
      fontFiles: [fontPath, dejavuPath],
      loadSystemFonts: false,
      defaultFontFamily: "TscircuitAlphabet",
    },
  })

  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  const snapshotDir = join(process.cwd(), "tests", "__snapshots__")
  mkdirSync(snapshotDir, { recursive: true })
  const pngPath = join(snapshotDir, "font-dejavu-comparison.png")
  writeFileSync(pngPath, pngBuffer)

  expect(pngBuffer.length).toBeGreaterThan(1000)
  console.log(`PNG snapshot saved to ${pngPath} (${pngBuffer.length} bytes)`)
})

test("renders adjacent letter spacing vs DejaVu Sans Mono", async () => {
  const dejavuPath = findDejaVuPath()
  if (!dejavuPath) {
    console.warn("DejaVu Sans Mono font not found; skipping comparison test.")
    return
  }

  const fontPath = join(process.cwd(), "TscircuitAlphabet.ttf")
  if (!existsSync(fontPath)) {
    throw new Error(`Missing font file at ${fontPath}`)
  }

  const ourFont = opentype.loadSync(fontPath)
  const dejavuFont = opentype.loadSync(dejavuPath)

  const fontSize = 120
  const padding = Math.round(fontSize * 0.6)
  const lineHeight = Math.round(fontSize * 1.4)
  const tracking = Math.round(fontSize * 0.12)
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
  const pairs = letters.map((letter) => `${letter}${letter.toLowerCase()}`)

  const tokens = pairs.flatMap((pair) => [
    { text: pair, fontFamily: "TscircuitAlphabet", font: ourFont },
    { text: pair, fontFamily: "DejaVu Sans Mono", font: dejavuFont },
  ])

  const measureTextWidth = (
    font: opentype.Font,
    text: string,
    size: number,
  ): number => {
    let width = 0
    for (const ch of text) {
      const glyph = font.charToGlyph(ch)
      width += (glyph.advanceWidth || 0) / font.unitsPerEm
    }
    return width * size
  }

  let x = padding
  const positioned = tokens.map((token) => {
    const width = measureTextWidth(token.font, token.text, fontSize)
    const entry = { ...token, x }
    x += width + tracking
    return entry
  })

  const width = Math.ceil(x + padding)
  const height = padding * 2 + lineHeight

  const svgString = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="white"/>
  ${positioned
    .map(
      (token) =>
        `<text x="${token.x}" y="${padding + fontSize}" font-family="${
          token.fontFamily
        }" font-size="${fontSize}" fill="black">${escapeXml(
          token.text,
        )}</text>`,
    )
    .join("\n  ")}
</svg>`

  const resvg = new Resvg(svgString, {
    font: {
      fontFiles: [fontPath, dejavuPath],
      loadSystemFonts: false,
      defaultFontFamily: "TscircuitAlphabet",
    },
  })

  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  const snapshotDir = join(process.cwd(), "tests", "__snapshots__")
  mkdirSync(snapshotDir, { recursive: true })
  const pngPath = join(snapshotDir, "font-dejavu-adjacent-comparison.png")
  writeFileSync(pngPath, pngBuffer)

  expect(pngBuffer.length).toBeGreaterThan(1000)
  console.log(`PNG snapshot saved to ${pngPath} (${pngBuffer.length} bytes)`)
})
