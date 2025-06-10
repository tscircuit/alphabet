import * as fontkit from "fontkit";

// Path to a common system font
const fontPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const font = fontkit.openSync(fontPath);

// Characters exported by this module
const CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.*()-+=_[]<>\\'\\\"";

// Layout all characters at once as suggested in fontkit docs
const run = font.layout(CHARACTERS);

// Example of subsetting the font using the resulting glyphs
const subset = font.createSubset();
run.glyphs.forEach((g) => subset.includeGlyph(g));
subset.encode();

export const fontkitAlphabet: Record<string, string> = {};

for (let i = 0; i < CHARACTERS.length; i++) {
  const ch = CHARACTERS[i];
  const glyph = run.glyphs[i];
  const { minX, minY, maxX, maxY } = glyph.bbox;
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  const parts: string[] = [];
  for (const cmd of glyph.path.commands) {
    const args = cmd.args;
    switch (cmd.command) {
      case "moveTo":
        parts.push(`M${((args[0] - minX) / width).toFixed(3)} ${((args[1] - minY) / height).toFixed(3)}`);
        break;
      case "lineTo":
        parts.push(`L${((args[0] - minX) / width).toFixed(3)} ${((args[1] - minY) / height).toFixed(3)}`);
        break;
      case "curveTo":
        parts.push(`C${((args[0] - minX) / width).toFixed(3)} ${((args[1] - minY) / height).toFixed(3)} ${((args[2] - minX) / width).toFixed(3)} ${((args[3] - minY) / height).toFixed(3)} ${((args[4] - minX) / width).toFixed(3)} ${((args[5] - minY) / height).toFixed(3)}`);
        break;
      case "qcurveTo":
        if (args.length === 4) {
          parts.push(`Q${((args[0] - minX) / width).toFixed(3)} ${((args[1] - minY) / height).toFixed(3)} ${((args[2] - minX) / width).toFixed(3)} ${((args[3] - minY) / height).toFixed(3)}`);
        }
        break;
      case "closePath":
        parts.push("Z");
        break;
    }
  }
  fontkitAlphabet[ch] = parts.join("");
}
