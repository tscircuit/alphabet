import { execSync } from "node:child_process"
import { join } from "node:path"
import { expect, test } from "bun:test"
import * as opentype from "opentype.js"

test("builds an explicit space glyph with the exported advance", () => {
  execSync("bun scripts/build-font.ts", {
    cwd: join(import.meta.dir, ".."),
    stdio: "pipe",
  })

  const font = opentype.loadSync(
    join(import.meta.dir, "..", "TscircuitAlphabet.ttf"),
  )
  const space = font.charToGlyph(" ")

  expect(space.unicode).toBe(32)
  expect(space.advanceWidth).toBe(692)
  expect(space.path.commands).toHaveLength(0)
})
