import { expect, test } from "bun:test"
import { renderTextToPng } from "./helpers/render-text-to-png"

test("renders numbers", async () => {
  const text = "0123456789"
  const pngBuffer = renderTextToPng(text, {
    filename: "font-numbers.png",
  })
  expect(pngBuffer.length).toBeGreaterThan(1000)
})
