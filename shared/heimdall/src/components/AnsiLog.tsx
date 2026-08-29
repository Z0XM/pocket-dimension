import { useMemo } from "react";
import { ansiStyleToCss, parseAnsiSegments } from "@/lib/ansi";

/** Turn Vitest/chalk ANSI output into colored React nodes for the log panel. */
export function AnsiLog({ text, emptyLabel }: { text: string; emptyLabel?: string }) {
  const segments = useMemo(() => parseAnsiSegments(text || emptyLabel || ""), [text, emptyLabel]);

  return (
    <>
      {segments.map((segment, i) => {
        const css = ansiStyleToCss(segment.style);
        return css ? (
          <span key={i} style={css}>
            {segment.text}
          </span>
        ) : (
          <span key={i}>{segment.text}</span>
        );
      })}
    </>
  );
}
