import { expect, test } from "bun:test"
import { svgAlphabet } from "../index"
import { renderTextToPng } from "./helpers/render-text-to-png"

test("renders all special characters", async () => {
  // Extract all special characters (non-alphanumeric) from svgAlphabet
  const specialCharacters = Object.keys(svgAlphabet)
    .filter((char) => !/[a-zA-Z0-9]/.test(char))
    .sort()
    .join("")
  const pngBuffer = renderTextToPng(specialCharacters, {
    filename: "font-special-characters.png",
  })
  expect(pngBuffer.length).toBeGreaterThan(1000)
})
