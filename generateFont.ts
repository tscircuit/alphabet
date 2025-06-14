import opentype from "opentype.js";
import { writeFileSync } from "fs";
import { sourceSansProRegularBase64 } from "./fontData";

const baseFont = opentype.parse(Buffer.from(sourceSansProRegularBase64, "base64").buffer);
export const unitsPerEm = baseFont.unitsPerEm;

function cubic(p0: number, p1: number, p2: number, p3: number, t: number) {
  const mt = 1 - t;
  return (
    mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3
  );
}

function quad(p0: number, p1: number, p2: number, t: number) {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}
function flattenGlyph(glyph: opentype.Glyph): opentype.Path {
  const path = new opentype.Path();
  const cmds = glyph.getPath(0, 0, unitsPerEm).commands;
  let prevX = 0;
  let prevY = 0;
  let started = false;

  const add = (x: number, y: number) => {
    if (!started) {
      path.moveTo(x, y);
      started = true;
    } else {
      path.lineTo(x, y);
    }
  };

  for (const cmd of cmds) {
    if (cmd.type === "M") {
      add(cmd.x, cmd.y);
      prevX = cmd.x;
      prevY = cmd.y;
    } else if (cmd.type === "L") {
      add(cmd.x, cmd.y);
      prevX = cmd.x;
      prevY = cmd.y;
    } else if (cmd.type === "C") {
      for (let t = 0.1; t <= 1; t += 0.1) {
        add(
          cubic(prevX, cmd.x1, cmd.x2, cmd.x, t),
          cubic(prevY, cmd.y1, cmd.y2, cmd.y, t),
        );
      }
      prevX = cmd.x;
      prevY = cmd.y;
    } else if (cmd.type === "Q") {
      for (let t = 0.1; t <= 1; t += 0.1) {
        add(quad(prevX, cmd.x1, cmd.x, t), quad(prevY, cmd.y1, cmd.y, t));
      }
      prevX = cmd.x;
      prevY = cmd.y;
    } else if (cmd.type === "Z") {
      // ignore close
    }
  }
  return path;
}

function buildGlyph(char: string): opentype.Glyph {
  const srcGlyph = baseFont.charToGlyph(char);
  const path = flattenGlyph(srcGlyph);
  return new opentype.Glyph({
    name: char,
    unicode: char.charCodeAt(0),
    advanceWidth: unitsPerEm,
    path,
  });
}

export function buildFont(): opentype.Font {
  const glyphs: opentype.Glyph[] = [];
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  for (const char of chars) {
    glyphs.push(buildGlyph(char));
  }
  return new opentype.Font({
    familyName: "Alphabet",
    styleName: "Regular",
    unitsPerEm,
    ascender: baseFont.ascender,
    descender: baseFont.descender,
    glyphs,
  });
}

if (import.meta.main) {
  const font = buildFont();
  const out = Buffer.from(font.toArrayBuffer());
  writeFileSync("alphabet.otf", out);
  console.log("alphabet.otf written");
}
