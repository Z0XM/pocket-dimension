/** Shared color tokens for status / kind chips across the Dev War Room. */

const chipTone = (channel: string) => `border-[hsl(var(${channel})/0.4)] bg-[hsl(var(${channel})/0.1)] text-[hsl(var(${channel}))]`;

export const STATUS_CHIP_CLASS = {
  all: "border-border bg-muted/40 text-muted-foreground",
  done: chipTone("--chip-emerald"),
  complete: chipTone("--chip-emerald"),
  "in-progress": chipTone("--chip-sky"),
  review: chipTone("--chip-violet"),
  blocked: chipTone("--chip-rose"),
  backlog: "border-border bg-muted text-muted-foreground",
  "ready-for-dev": chipTone("--chip-teal"),
  confirmed: chipTone("--chip-teal"),
  pending: chipTone("--chip-amber"),
  deferred: "border-border bg-muted text-muted-foreground",
  open: chipTone("--chip-rose"),
  partial: chipTone("--chip-violet"),
  closed: chipTone("--chip-emerald"),
  active: chipTone("--chip-sky"),
  remaining: chipTone("--chip-amber"),
  kanban: chipTone("--chip-sky"),
  table: chipTone("--chip-violet"),
  timeline: chipTone("--chip-teal"),
  /** Selected filter chip — matches War Room heading accent (not status blue). */
  selected: "border-heading/40 bg-heading/10 text-heading ring-1 ring-inset ring-heading/20",
} as const;

export type StatusChipKey = keyof typeof STATUS_CHIP_CLASS;

export const KIND_CHIP_CLASS = {
  product: chipTone("--chip-amber"),
  integration: chipTone("--chip-violet"),
  engineering: chipTone("--chip-sky"),
  tooling: "border-border bg-muted text-muted-foreground",
} as const;

export type KindChipKey = keyof typeof KIND_CHIP_CLASS;

export function statusChipClass(key: string): string {
  return STATUS_CHIP_CLASS[key as StatusChipKey] ?? STATUS_CHIP_CLASS.all;
}

export function kindChipClass(key: string): string {
  return KIND_CHIP_CLASS[key as KindChipKey] ?? STATUS_CHIP_CLASS.all;
}

/** Progress dial / count chip tones (Delivery epic progress). */
export const PROGRESS_CHIP = {
  complete: chipTone("--chip-emerald"),
  partial: chipTone("--chip-sky"),
  idle: "border-border bg-muted text-muted-foreground",
} as const;

export const PROGRESS_DIAL = {
  complete: "text-[hsl(var(--chip-emerald))]",
  partial: "text-[hsl(var(--chip-sky))]",
  idle: "text-muted-foreground/40",
} as const;

/** Theme-aware text accents (AA on light cards and dark surfaces). */
const chipText = (channel: string) => `text-[hsl(var(${channel}))]`;

export const CHIP_TEXT = {
  emerald: chipText("--chip-emerald"),
  sky: chipText("--chip-sky"),
  violet: chipText("--chip-violet"),
  rose: chipText("--chip-rose"),
  teal: chipText("--chip-teal"),
  amber: chipText("--chip-amber"),
} as const;

/** Kanban column headers and overview stat accents by story status. */
export const STORY_STATUS_TEXT: Partial<Record<StatusChipKey, string>> = {
  done: CHIP_TEXT.emerald,
  blocked: CHIP_TEXT.rose,
  "in-progress": CHIP_TEXT.sky,
  review: CHIP_TEXT.sky,
  "ready-for-dev": CHIP_TEXT.teal,
  backlog: "text-muted-foreground",
  pending: CHIP_TEXT.amber,
  remaining: CHIP_TEXT.amber,
  active: CHIP_TEXT.sky,
};

/** Epic kanban column header accents. */
export const EPIC_STATUS_TEXT: Partial<Record<string, string>> = {
  done: CHIP_TEXT.emerald,
  "in-progress": CHIP_TEXT.sky,
  backlog: "text-muted-foreground",
};

export function storyStatusTextClass(status: string): string {
  return STORY_STATUS_TEXT[status as StatusChipKey] ?? "text-muted-foreground";
}

export function epicStatusTextClass(status: string): string {
  return EPIC_STATUS_TEXT[status] ?? "text-muted-foreground";
}

/** Timeline / delivery slice story-id pills — chip tones at compact size. */
export function statusPillClass(status: string): string {
  const base = "rounded-full border px-2 py-0.5 font-mono text-[0.65rem] transition-colors hover:opacity-80";
  const chip = STATUS_CHIP_CLASS[status as StatusChipKey];
  if (chip && status !== "all" && status !== "selected") {
    return `${base} ${chip}`;
  }
  return `${base} border-border text-muted-foreground`;
}
