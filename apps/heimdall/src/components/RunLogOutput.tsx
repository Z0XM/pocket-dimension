import { useMemo, useState, type MouseEvent, type RefObject } from "react";
import { ChevronDown, ChevronRight, Copy, Download, Loader2 } from "lucide-react";
import { AnsiLog } from "@/components/AnsiLog";
import { Button } from "@/components/ui/button";
import { parseAnsiSegments } from "@/lib/ansi";

function logPlainText(text: string): string {
  if (!text.trim()) return "";
  return parseAnsiSegments(text)
    .map((segment) => segment.text)
    .join("");
}

function lastLogLine(text: string): string {
  const plain = logPlainText(text).trim();
  if (!plain) return "";
  return plain.split("\n").filter(Boolean).at(-1) ?? "";
}

export function RunLogOutput({
  title,
  text,
  emptyLabel,
  collapsible = true,
  open,
  onToggleOpen,
  busy,
  scrollRef,
  downloadBasename,
}: {
  title: string;
  text: string;
  emptyLabel: string;
  collapsible?: boolean;
  open?: boolean;
  onToggleOpen?: () => void;
  busy?: boolean;
  scrollRef?: RefObject<HTMLPreElement | null>;
  downloadBasename: string;
}) {
  const isOpen = collapsible ? (open ?? false) : true;
  const plain = useMemo(() => logPlainText(text), [text]);
  const preview = useMemo(() => lastLogLine(text), [text]);
  const [copied, setCopied] = useState(false);
  const hasContent = plain.length > 0;

  async function onCopy(event: MouseEvent) {
    event.stopPropagation();
    if (!hasContent) return;
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  function onDownload(event: MouseEvent) {
    event.stopPropagation();
    if (!hasContent) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const blob = new Blob([plain], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${downloadBasename}-${stamp}.log`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-background/80">
      <div className="flex items-center gap-1 border-b border-border/40 px-1 py-1 sm:gap-2">
        {collapsible ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
            onClick={onToggleOpen}
            aria-expanded={isOpen}
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            <span className="shrink-0">{title}</span>
            {busy && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
            {!isOpen && preview && <span className="truncate font-mono font-normal opacity-70">{preview}</span>}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="shrink-0">{title}</span>
            {busy && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1 px-2 text-xs"
          disabled={!hasContent}
          title="Copy plain-text log to clipboard"
          onClick={(event) => void onCopy(event)}
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1 px-2 text-xs"
          disabled={!hasContent}
          title="Download plain-text log file"
          onClick={onDownload}
        >
          <Download className="h-3 w-3" />
          Download
        </Button>
      </div>
      {isOpen && (
        <pre
          ref={scrollRef}
          className="max-h-64 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[0.7rem] leading-relaxed text-foreground/90"
        >
          <AnsiLog text={text} emptyLabel={emptyLabel} />
        </pre>
      )}
    </div>
  );
}
