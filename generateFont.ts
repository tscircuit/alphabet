import opentype from "opentype.js";
import { writeFileSync } from "fs";
import { lineAlphabet } from "./index";

export const unitsPerEm = 1000;

function buildGlyph(char: string): opentype.Glyph {
  const segments = lineAlphabet[char];
  const path = new opentype.Path();
  if (segments && segments.length > 0) {
    const first = segments[0];
    path.moveTo(first.x1 * unitsPerEm, first.y1 * unitsPerEm);
    path.lineTo(first.x2 * unitsPerEm, first.y2 * unitsPerEm);
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      path.lineTo(seg.x1 * unitsPerEm, seg.y1 * unitsPerEm);
      path.lineTo(seg.x2 * unitsPerEm, seg.y2 * unitsPerEm);
    }
  }
  return new opentype.Glyph({
    name: char,
    unicode: char.charCodeAt(0),
    advanceWidth: unitsPerEm,
    path,
  });
}

export function buildFont(): opentype.Font {
  const glyphs: opentype.Glyph[] = [];
  for (const char of Object.keys(lineAlphabet)) {
    glyphs.push(buildGlyph(char));
  }
  return new opentype.Font({
    familyName: "Alphabet",
    styleName: "Regular",
    unitsPerEm,
    ascender: unitsPerEm,
    descender: 0,
    glyphs,
  });
}

if (import.meta.main) {
  const font = buildFont();
  const out = Buffer.from(font.toArrayBuffer());
  writeFileSync("alphabet.otf", out);
  console.log("alphabet.otf written");
}
