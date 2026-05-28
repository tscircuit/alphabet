declare const svgAlphabet$1: Record<string, string>;

declare const glyphAdvanceRatio$1: Record<string, number>;

declare const strokeWidthRatio$1 = 0.08;
declare const glyphWidthRatio$1 = 0.5508791086074476;
declare const spaceWidthRatio$1 = 0.23789907312049433;
declare const lineHeightRatio$1 = 1.212152420185376;
declare const letterSpacingRatio$1 = 0;

/**
 * Ubuntu font module — provides the same shape as root index.ts so
 * `getFont("ubuntu")` returns a drop-in alphabet.
 *
 * Source: Ubuntu-R.ttf v0.83 by Canonical Ltd., licensed under the
 * Ubuntu Font Licence 1.0 (see LICENSES/UFL-1.0.txt). Bundled here
 * to enable PCB silkscreen rendering via tscircuit's font dispatch.
 *
 * Glyph paths regenerated via:
 *   `bun scripts/generate-ubuntu-data.ts`
 */

/**
 * lineAlphabet — derived from svgAlphabet at module load. Same parsing
 * logic as the root tscircuit2024 alphabet so downstream renderers
 * receive identical shape regardless of which font is selected.
 *
 * Each entry is an array of {x1, y1, x2, y2} line segments in
 * unit-square cartesian coords. M moves the pen; L draws a segment
 * from the current pen position to the L target.
 */
declare const lineAlphabet$1: Record<string, Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}>>;
declare const glyphLineAlphabet$1: Record<string, {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}[]>;
declare const kerningRatio$1: Record<string, Record<string, number>>;
declare const textMetrics$1: {
    glyphWidthRatio: number;
    spaceWidthRatio: number;
    lineHeightRatio: number;
    strokeWidthRatio: number;
    letterSpacingRatio: number;
};

declare namespace index {
  export { glyphAdvanceRatio$1 as glyphAdvanceRatio, glyphLineAlphabet$1 as glyphLineAlphabet, glyphWidthRatio$1 as glyphWidthRatio, kerningRatio$1 as kerningRatio, letterSpacingRatio$1 as letterSpacingRatio, lineAlphabet$1 as lineAlphabet, lineHeightRatio$1 as lineHeightRatio, spaceWidthRatio$1 as spaceWidthRatio, strokeWidthRatio$1 as strokeWidthRatio, svgAlphabet$1 as svgAlphabet, textMetrics$1 as textMetrics };
}

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

type FontName = "tscircuit2024" | "ubuntu";
interface FontModule {
    svgAlphabet: Record<string, string>;
    lineAlphabet: Record<string, Array<{
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    }>>;
    glyphLineAlphabet: Record<string, Array<{
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    }>>;
    glyphAdvanceRatio: Record<string, number>;
    strokeWidthRatio: number;
    glyphWidthRatio: number;
    spaceWidthRatio: number;
    lineHeightRatio: number;
    letterSpacingRatio: number;
    kerningRatio: Record<string, Record<string, number>>;
    textMetrics: {
        glyphWidthRatio: number;
        spaceWidthRatio: number;
        lineHeightRatio: number;
        strokeWidthRatio: number;
        letterSpacingRatio: number;
    };
}
/**
 * Look up a font module by name. Unknown names fall back to
 * "tscircuit2024" so unconfigured callers never crash; emits a console
 * warning in development to flag the silent fallback.
 */
declare const getFont: (name?: string) => FontModule;
declare const FONT_NAMES: readonly FontName[];

declare const svgAlphabet: {
    "0": string;
    "1": string;
    "2": string;
    "3": string;
    "4": string;
    "5": string;
    "6": string;
    "7": string;
    "8": string;
    "9": string;
    "!": string;
    '"': string;
    "#": string;
    $: string;
    "'": string;
    "(": string;
    ")": string;
    "*": string;
    "+": string;
    ",": string;
    "-": string;
    ".": string;
    "/": string;
    "<": string;
    "=": string;
    ">": string;
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
    F: string;
    G: string;
    H: string;
    I: string;
    J: string;
    K: string;
    L: string;
    M: string;
    N: string;
    O: string;
    P: string;
    Q: string;
    R: string;
    S: string;
    T: string;
    U: string;
    V: string;
    W: string;
    X: string;
    Y: string;
    Z: string;
    "[": string;
    "\\": string;
    "]": string;
    "^": string;
    _: string;
    a: string;
    b: string;
    c: string;
    d: string;
    e: string;
    f: string;
    g: string;
    h: string;
    i: string;
    j: string;
    k: string;
    l: string;
    m: string;
    n: string;
    o: string;
    p: string;
    q: string;
    r: string;
    s: string;
    t: string;
    u: string;
    v: string;
    w: string;
    x: string;
    y: string;
    z: string;
};
declare const lineAlphabet: Record<string, Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}>>;
declare const strokeWidthRatio = 0.09;
declare const glyphWidthRatio = 0.692052;
declare const spaceWidthRatio = 0.692052;
declare const lineHeightRatio = 1.152;
declare const letterSpacingRatio = 0;
declare const glyphLineAlphabet: Record<string, {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}[]>;
declare const glyphAdvanceRatio: Record<string, number>;
declare const kerningRatio: Record<string, Record<string, number>>;
declare const textMetrics: {
    glyphWidthRatio: number;
    spaceWidthRatio: number;
    lineHeightRatio: number;
    strokeWidthRatio: number;
    letterSpacingRatio: number;
};

export { FONT_NAMES, type FontModule, type FontName, getFont, glyphAdvanceRatio, glyphLineAlphabet, glyphWidthRatio, kerningRatio, letterSpacingRatio, lineAlphabet, lineHeightRatio, spaceWidthRatio, strokeWidthRatio, svgAlphabet, textMetrics, index as ubuntu };
