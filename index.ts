import hershey from 'hershey'

const CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.*()-+=_[]<>'\"";


export const svgAlphabet: Record<string, string> = {};
export const lineAlphabet: Record<string, Array<{x1:number;y1:number;x2:number;y2:number}>> = {};

for (const ch of CHARACTERS) {
  const { bounds, paths } = hershey.stringToPaths(ch);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const normalize = (x:number, y:number) => [
    (x - bounds.minX) / width,
    1 - (y - bounds.minY) / height,
  ];
  const normalized = paths.map(seg => seg.map(([x, y]) => normalize(x, y)));
  const pathStr = normalized
    .map(seg => 'M' + seg.map(p => p.join(' ')).join('L'))
    .join('');
  svgAlphabet[ch] = pathStr;
  lineAlphabet[ch] = [];
  for (const seg of normalized) {
    for (let i = 0; i < seg.length - 1; i++) {
      lineAlphabet[ch].push({
        x1: seg[i][0],
        y1: seg[i][1],
        x2: seg[i + 1][0],
        y2: seg[i + 1][1],
      });
    }
  }
}
