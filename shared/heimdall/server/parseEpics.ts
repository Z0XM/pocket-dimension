export interface ParsedEpicStory {
  epicNumber: number;
  storyNumber: number;
  title: string;
  userStory?: string;
  acceptanceCriteria?: string;
}

export interface ParsedEpic {
  number: number;
  title: string;
  goal: string;
  approvalTag?: string;
  isEnabler: boolean;
  /** Historical epic superseded by another family (e.g. Epic 24 → Sample Mode C1). */
  isSuperseded: boolean;
  stories: ParsedEpicStory[];
}

export interface ParsedEpicsResult {
  epics: ParsedEpic[];
  deliverySlices: { name: string; storyIds: string[] }[];
}

export function parseEpics(content: string): ParsedEpicsResult {
  const epics: ParsedEpic[] = [];
  const deliverySlices: { name: string; storyIds: string[] }[] = [];

  const sliceSection = content.match(/## Recommended Delivery Slices([\s\S]*?)(?=\n---|\n## Epics)/);
  if (sliceSection) {
    const sliceLines = sliceSection[1].match(/^\d+\.\s+\*\*(.+?)\*\*\s*—\s*(.+)$/gm);
    if (sliceLines) {
      for (const line of sliceLines) {
        const m = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*—\s*(.+)$/);
        if (!m) continue;
        const storyIds =
          m[2].match(/Story\s+(\d+\.\d+)/g)?.map((s) => s.replace("Story ", "").replace(".", "-")) ??
          m[2].match(/\d+\.\d+/g)?.map((s) => s.replace(".", "-")) ??
          [];
        deliverySlices.push({ name: m[1].trim(), storyIds });
      }
    }
  }

  const epicBlocks = content.split(/^### Epic (\d+) — /m).slice(1);

  for (let i = 0; i < epicBlocks.length; i += 2) {
    const number = Number(epicBlocks[i]);
    const block = epicBlocks[i + 1] ?? "";
    const firstLine = block.split("\n")[0]?.trim() ?? "";

    // Parse title + optional (`approval tag`) from the first line only.
    // Avoid non-greedy [^(`]+? with optional tag — that captures a single letter.
    const tagged = firstLine.match(/^(.+?)\s+\(`([^`]+)`\)$/);
    const title = tagged?.[1]?.trim() ?? (firstLine || `Epic ${number}`);
    const approvalTag = tagged?.[2]?.trim();

    const goalMatch = block.match(/\*\*Goal:\*\*\s*([\s\S]+?)(?=\n\n|\*\*Stories\*\*)/);
    const goal = goalMatch?.[1]?.trim().replace(/\n/g, " ") ?? "";

    const isEnabler = block.includes("Enabler epic") || block.includes("architecture prerequisite");

    const isSuperseded = /^superseded\b/i.test(approvalTag ?? "") || /^\s*>\s*\*\*SUPERSEDED/m.test(block) || block.includes("**SUPERSEDED");

    const stories: ParsedEpicStory[] = [];
    const storyParts = block.split(/\*\*Story (\d+\.\d+)\*\*/);

    for (let j = 1; j < storyParts.length; j += 2) {
      const storyId = storyParts[j];
      const storyBlock = storyParts[j + 1] ?? "";
      const [epicNum, storyNum] = storyId.split(".").map(Number);

      const lines = storyBlock.trim().split("\n");
      let title = "";
      let userStory = "";
      let acceptanceStart = false;
      const acceptanceLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("_Covers:") || line.startsWith("_Prerequisites:")) continue;
        if (line.startsWith("As an ") || line.startsWith("As a ")) {
          userStory = line.trim();
          continue;
        }
        if (line.trim() === "**Acceptance**" || line.trim() === "**Acceptance Criteria**") {
          acceptanceStart = true;
          continue;
        }
        if (line.startsWith("**Story ") || line.startsWith("### ")) break;
        if (acceptanceStart) {
          acceptanceLines.push(line);
        } else if (!title && line.trim() && !line.startsWith("**")) {
          title = line.trim();
        }
      }

      if (!title && userStory) {
        title = userStory.slice(0, 80) + (userStory.length > 80 ? "…" : "");
      }

      stories.push({
        epicNumber: epicNum,
        storyNumber: storyNum,
        title: title || `Story ${storyId}`,
        userStory: userStory || undefined,
        acceptanceCriteria: acceptanceLines.join("\n").trim() || undefined,
      });
    }

    epics.push({ number, title, goal, approvalTag, isEnabler, isSuperseded, stories });
  }

  return { epics, deliverySlices };
}

export function storyDisplayId(epicNumber: number, storyNumber: number): string {
  return `${epicNumber}.${storyNumber}`;
}

export function storyRouteId(epicNumber: number, storyNumber: number): string {
  return `${epicNumber}-${storyNumber}`;
}
