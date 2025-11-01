import { expect, test } from "bun:test"
import { renderTextToPng } from "./helpers/render-text-to-png"

test("renders lowercase alphabet", async () => {
  const text = "abcdefghijklmnopqrstuvwxyz"
  const pngBuffer = renderTextToPng(text, {
    filename: "font-lowercase.png",
  })
  expect(pngBuffer.length).toBeGreaterThan(1000)
})
