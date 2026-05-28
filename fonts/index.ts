/**
 * Font registry — multi-font support for tscircuit silkscreen rendering.
 *
 * Default font "tscircuit2024" remains the root export of
 * @tscircuit/alphabet; this registry exposes a parallel `getFont(name)`
 * lookup so renderers in @tscircuit/core can dispatch on the
 * `silkscreentext.font` prop.
 *
 * Backward compatibility: importing from the root entry point still
 * resolves to the tscircuit2024 font (no changes for existing
 * consumers).
 *
 * Forward compatibility: the registry is open — additional fonts may
 * land at fonts/<name>/index.ts and be wired into FONT_REGISTRY without
 * breaking any existing import path.
 */

import * as tscircuit2024 from "../index"
import * as ubuntu from "./ubuntu/index"

export type FontName = "tscircuit2024" | "ubuntu"

export interface FontModule {
  svgAlphabet: Record<string, string>
  lineAlphabet: Record<
    string,
    Array<{ x1: number; y1: number; x2: number; y2: number }>
  >
  glyphLineAlphabet: Record<
    string,
    Array<{ x1: number; y1: number; x2: number; y2: number }>
  >
  glyphAdvanceRatio: Record<string, number>
  strokeWidthRatio: number
  glyphWidthRatio: number
  spaceWidthRatio: number
  lineHeightRatio: number
  letterSpacingRatio: number
  kerningRatio: Record<string, Record<string, number>>
  textMetrics: {
    glyphWidthRatio: number
    spaceWidthRatio: number
    lineHeightRatio: number
    strokeWidthRatio: number
    letterSpacingRatio: number
  }
}

const FONT_REGISTRY: Record<FontName, FontModule> = {
  tscircuit2024: tscircuit2024 as unknown as FontModule,
  ubuntu: ubuntu as unknown as FontModule,
}

/**
 * Look up a font module by name. Unknown names fall back to
 * "tscircuit2024" so unconfigured callers never crash; emits a console
 * warning in development to flag the silent fallback.
 */
export const getFont = (name?: string): FontModule => {
  if (!name) return FONT_REGISTRY.tscircuit2024
  const font = FONT_REGISTRY[name as FontName]
  if (font) return font
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    console.warn(
      `[@tscircuit/alphabet] unknown font "${name}", falling back to tscircuit2024`,
    )
  }
  return FONT_REGISTRY.tscircuit2024
}

export const FONT_NAMES: readonly FontName[] = Object.keys(
  FONT_REGISTRY,
) as FontName[]

export { tscircuit2024, ubuntu }
