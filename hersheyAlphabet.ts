import { stringToPaths } from "hershey"

const CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.*()-+=_[]<>\\'\""

export const hersheyAlphabet: Record<string, string> = {}

for (const ch of CHARACTERS) {
  const { bounds, paths } = stringToPaths(ch)
  const width = bounds.maxX - bounds.minX || 1
  const height = bounds.maxY - bounds.minY || 1
  const segments: string[] = []

  for (const path of paths) {
    for (let i = 0; i < path.length; i++) {
      const [x, y] = path[i]
      const px = ((x - bounds.minX) / width).toFixed(3)
      const py = ((bounds.maxY - y) / height).toFixed(3)
      segments.push(`${i === 0 ? 'M' : 'L'}${px} ${py}`)
    }
  }

  hersheyAlphabet[ch] = segments.join("")
}
