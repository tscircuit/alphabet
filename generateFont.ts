import opentype from "opentype.js";
import { writeFileSync } from "fs";
import { sourceSansProRegularBase64 } from "./fontData";

export const unitsPerEm = 1000;

export function buildFont(): opentype.Font {
  const buf = Buffer.from(sourceSansProRegularBase64, "base64");
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return opentype.parse(arrayBuffer);
}

if (import.meta.main) {
  const font = buildFont();
  const out = Buffer.from(font.toArrayBuffer());
  writeFileSync("alphabet.otf", out);
  console.log("alphabet.otf written");
}
