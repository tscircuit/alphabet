import * as fontkit from "fontkit";

const fontPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const font = fontkit.openSync(fontPath);

const CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.*()-+=_[]<>\'\"";

export const fontkitAlphabet: Record<string, string> = {};

for (const ch of CHARACTERS) {
  const glyph = font.glyphForCodePoint(ch.charCodeAt(0));
  const { minX, minY, maxX, maxY } = glyph.bbox;
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  const commands = glyph.path.commands;
  const parts: string[] = [];

  for (const cmd of commands) {
    const args = cmd.args;
    switch (cmd.command) {
      case "moveTo":
        parts.push(
          `M${((args[0] - minX) / width).toFixed(3)} ${((args[1] - minY) / height).toFixed(3)}`
        );
        break;
      case "lineTo":
        parts.push(
          `L${((args[0] - minX) / width).toFixed(3)} ${((args[1] - minY) / height).toFixed(3)}`
        );
        break;
      case "curveTo":
        parts.push(
          `C${((args[0] - minX) / width).toFixed(3)} ${((args[1] - minY) / height).toFixed(3)} ${((args[2] - minX) / width).toFixed(3)} ${((args[3] - minY) / height).toFixed(3)} ${((args[4] - minX) / width).toFixed(3)} ${((args[5] - minY) / height).toFixed(3)}`
        );
        break;
      case "qcurveTo":
        if (args.length === 4) {
          parts.push(
            `Q${((args[0] - minX) / width).toFixed(3)} ${((args[1] - minY) / height).toFixed(3)} ${((args[2] - minX) / width).toFixed(3)} ${((args[3] - minY) / height).toFixed(3)}`
          );
        }
        break;
      case "closePath":
        parts.push("Z");
        break;
    }
  }

  fontkitAlphabet[ch] = parts.join("");
}
