import { expect, test } from "bun:test"
import { renderTextToPng } from "./helpers/render-text-to-png"

test("renders uppercase alphabet", async () => {
  const text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const pngBuffer = renderTextToPng(text, {
    filename: "font-uppercase.png",
  })
  expect(pngBuffer.length).toBeGreaterThan(1000)
})
