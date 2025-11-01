import { expect, test } from "bun:test"
import { renderTextToPng } from "./helpers/render-text-to-png"

test("renders mixed case with numbers", async () => {
  const text = "The Quick Brown Fox 123"
  const pngBuffer = renderTextToPng(text, {
    filename: "font-mixed-case.png",
  })
  expect(pngBuffer.length).toBeGreaterThan(1000)
})
