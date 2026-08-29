export type AnsiStyle = {
  color?: string;
  background?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export type AnsiSegment = {
  text: string;
  style: AnsiStyle;
};

const FG: Record<number, string> = {
  30: "#6b7280",
  31: "#f87171",
  32: "#4ade80",
  33: "#fbbf24",
  34: "#60a5fa",
  35: "#c084fc",
  36: "#22d3ee",
  37: "#e5e7eb",
  90: "#9ca3af",
  91: "#fb7185",
  92: "#86efac",
  93: "#fde047",
  94: "#93c5fd",
  95: "#d8b4fe",
  96: "#67e8f9",
  97: "#f9fafb",
};

const BG: Record<number, string> = {
  40: "#111827",
  41: "#7f1d1d",
  42: "#14532d",
  43: "#78350f",
  44: "#1e3a8a",
  45: "#581c87",
  46: "#155e75",
  47: "#374151",
  100: "#1f2937",
  101: "#991b1b",
  102: "#166534",
  103: "#a16207",
  104: "#1d4ed8",
  105: "#7e22ce",
  106: "#0e7490",
  107: "#4b5563",
};

function applyCode(style: AnsiStyle, code: number): AnsiStyle {
  if (code === 0) return {};
  if (code === 1) return { ...style, bold: true, dim: false };
  if (code === 2) return { ...style, dim: true, bold: false };
  if (code === 3) return { ...style, italic: true };
  if (code === 4) return { ...style, underline: true };
  if (code === 22) return { ...style, bold: false, dim: false };
  if (code === 23) return { ...style, italic: false };
  if (code === 24) return { ...style, underline: false };
  if (code === 39) {
    const next = { ...style };
    delete next.color;
    return next;
  }
  if (code === 49) {
    const next = { ...style };
    delete next.background;
    return next;
  }
  if (FG[code]) return { ...style, color: FG[code] };
  if (BG[code]) return { ...style, background: BG[code] };
  return style;
}

/** Parse Vitest/chalk SGR sequences into styled text segments for the log panel. */
export function parseAnsiSegments(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  const re = /\u001B\[([0-9;]*)m/g;
  let last = 0;
  let style: AnsiStyle = {};
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ text: text.slice(last, match.index), style: { ...style } });
    }
    const codes = match[1] === "" ? [0] : match[1].split(";").map((c) => Number(c) || 0);
    for (const code of codes) style = applyCode(style, code);
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    segments.push({ text: text.slice(last), style: { ...style } });
  }

  return segments;
}

export function ansiStyleToCss(style: AnsiStyle): Record<string, string | number> | undefined {
  if (!style.color && !style.background && !style.bold && !style.dim && !style.italic && !style.underline) {
    return undefined;
  }
  return {
    ...(style.color ? { color: style.color } : {}),
    ...(style.background ? { backgroundColor: style.background } : {}),
    ...(style.bold ? { fontWeight: 700 } : {}),
    ...(style.dim ? { opacity: 0.65 } : {}),
    ...(style.italic ? { fontStyle: "italic" } : {}),
    ...(style.underline ? { textDecoration: "underline" } : {}),
  };
}
