import { expect, test } from "bun:test"
import { renderTextToPng } from "./helpers/render-text-to-png"

test("renders punctuation and symbols", async () => {
  const text = ".,*()-+=_[]<>'\"/\\"
  const pngBuffer = renderTextToPng(text, {
    filename: "font-punctuation.png",
  })
  expect(pngBuffer.length).toBeGreaterThan(1000)
})
