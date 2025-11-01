import { expect, test } from "bun:test"
import { renderTextToPng } from "./helpers/render-text-to-png"

test("renders text with large font size", async () => {
  const text = "Large Font Wrapping Test 123"
  const pngBuffer = renderTextToPng(text, {
    fontSize: 200,
    maxWidth: 2400,
    filename: "font-large-size.png",
  })
  expect(pngBuffer.length).toBeGreaterThan(1000)
})
