import { expect, test } from "bun:test"
import { renderTextToPng } from "./helpers/render-text-to-png"

test("renders common phrases", async () => {
  const text = "Hello World!"
  const pngBuffer = renderTextToPng(text, {
    filename: "font-hello-world.png",
  })
  expect(pngBuffer.length).toBeGreaterThan(1000)
})
