import { Resvg } from "@resvg/resvg-js"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Helper function to render text using the TTF font and save as PNG
 */
export function renderTextToPng(
  text: string,
  options: {
    fontSize?: number
    maxWidth?: number
    filename: string
  },
): Buffer {
  const fontSize = options.fontSize || 100
  const padding = fontSize * 0.9
  const maxWidth = options.maxWidth || 1400
  // Use actual monospace width from font: 1.392 * fontSize per character
  const charsPerLine = Math.floor((maxWidth - padding * 2) / (fontSize * 1.392))

  // Escape special XML characters
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")

  // Split text into lines if it's too long
  const lines: string[] = []
  for (let i = 0; i < text.length; i += charsPerLine) {
    lines.push(text.substring(i, i + charsPerLine))
  }

  const lineHeight = fontSize * 1.5
  const height = lines.length * lineHeight + padding * 2

  // Create SVG with text using the custom font
  const svgString = `<svg width="${maxWidth}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${maxWidth}" height="${height}" fill="white"/>
  ${lines
    .map(
      (line, i) =>
        `<text x="${padding}" y="${fontSize + padding + i * lineHeight}" font-family="TscircuitAlphabet" font-size="${fontSize}" fill="black">${escapeXml(line)}</text>`,
    )
    .join("\n  ")}
</svg>`

  // Load the custom font
  const fontPath = join(process.cwd(), "TscircuitAlphabet.ttf")

  // Render SVG to PNG using resvg with custom font
  const resvg = new Resvg(svgString, {
    font: {
      fontFiles: [fontPath],
      loadSystemFonts: false,
      defaultFontFamily: "TscircuitAlphabet",
    },
  })

  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  // Save PNG to snapshots directory
  const snapshotDir = join(process.cwd(), "tests", "__snapshots__")
  mkdirSync(snapshotDir, { recursive: true })
  const pngPath = join(snapshotDir, options.filename)
  writeFileSync(pngPath, pngBuffer)

  console.log(`PNG snapshot saved to ${pngPath} (${pngBuffer.length} bytes)`)

  return Buffer.from(pngBuffer)
}
