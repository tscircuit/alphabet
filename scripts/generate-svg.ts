import { svgAlphabet } from '../index'
import { writeFileSync } from 'fs'

function generateSvg(): string {
  const characters = Object.keys(svgAlphabet).sort()
  const numChars = characters.length

  const margin = 0.1
  const charWidth = 1
  const charHeight = 1
  const cellWidth = charWidth + margin
  const cellHeight = charHeight + margin
  const cols = Math.ceil(Math.sqrt(numChars))
  const rows = Math.ceil(numChars / cols)
  const width = cols * cellWidth
  const height = rows * cellHeight

  const paths: string[] = []
  for (let i = 0; i < numChars; i++) {
    const ch = characters[i]
    const path = svgAlphabet[ch as keyof typeof svgAlphabet]
    const row = Math.floor(i / cols)
    const col = i % cols
    const tx = col * cellWidth + margin / 2
    const ty = row * cellHeight + margin / 2
    paths.push(`  <path d="${path}" transform="translate(${tx.toFixed(3)}, ${ty.toFixed(3)})" stroke="black" stroke-width="0.02" fill="none" stroke-linecap="round" stroke-linejoin="round" />`)
  }

  const backgroundRect = `<rect width="${width.toFixed(3)}" height="${height.toFixed(3)}" fill="white" />`
  return `<svg viewBox="0 0 ${width.toFixed(3)} ${height.toFixed(3)}" xmlns="http://www.w3.org/2000/svg">\n${backgroundRect}\n${paths.join('\n')}\n</svg>`
}

const svg = generateSvg()
writeFileSync('characters.svg', svg)
console.log('Wrote characters.svg')
