/**
 * Built-in `bmad-output` parser — BMAD Method `_bmad-output` epics shapes.
 * Story 1.1 wires the module; Stories 1.2–1.3 fill numbered + letter-prefixed parse.
 */

export interface BmadOutputStory {
  epicNumber: number;
  storyNumber: number;
  /** Display code when letter-prefixed (e.g. H.1.1). */
  code?: string;
  title: string;
  userStory?: string;
  acceptanceCriteria?: string;
}

export interface BmadOutputEpic {
  /** Source folder slug (parent of epics.md). */
  source: string;
  number: number;
  /** Letter-prefixed family code (e.g. H.1). */
  code?: string;
  title: string;
  goal: string;
  approvalTag?: string;
  isEnabler: boolean;
  isSuperseded: boolean;
  stories: BmadOutputStory[];
}

export interface BmadOutputParseResult {
  epics: BmadOutputEpic[];
  deliverySlices: { name: string; storyIds: string[] }[];
}

/** Parent directory basename of the configured epics path (AD-9 source slug). */
export function epicSourceSlug(epicsPath: string): string {
  const normalized = epicsPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2]!;
  return parts[0] ?? "source";
}

export function bmadEpicId(source: string, epic: Pick<BmadOutputEpic, "number" | "code">): string {
  if (epic.code) {
    const slug = epic.code.toLowerCase().replace(/\./g, "-");
    return `epic-${source}-${slug}`;
  }
  return `epic-${source}-${epic.number}`;
}

export function bmadStoryId(
  source: string,
  epic: Pick<BmadOutputEpic, "number" | "code">,
  story: Pick<BmadOutputStory, "storyNumber" | "code">
): string {
  if (story.code) {
    return `${source}-${story.code.toLowerCase().replace(/\./g, "-")}`;
  }
  if (epic.code) {
    const epicSlug = epic.code.toLowerCase().replace(/\./g, "-");
    return `${source}-${epicSlug}-${story.storyNumber}`;
  }
  return `${source}-${epic.number}-${story.storyNumber}`;
}

export function bmadFeatureId(source: string, epic: Pick<BmadOutputEpic, "number" | "code">): string {
  if (epic.code) {
    return `feat-${source}-${epic.code.toLowerCase().replace(/\./g, "-")}`;
  }
  return `feat-${source}-${epic.number}`;
}

/**
 * Parse BMAD Method / lean letter-prefixed epics.md content.
 * Only the configured file is read by the caller (AD-8).
 */
export function parseBmadOutputEpics(content: string, source: string): BmadOutputParseResult {
  const epics: BmadOutputEpic[] = [];
  const deliverySlices: { name: string; storyIds: string[] }[] = [];

  // Letter-prefixed lean epics: ## Epic H.1 — Title  / - H.1.1 bullet
  const letterBlocks = content.split(/^## Epic ([A-Za-z]+)\.(\d+)\s*[—–-]\s*/m).slice(1);
  for (let i = 0; i < letterBlocks.length; i += 3) {
    const letter = letterBlocks[i] ?? "";
    const major = Number(letterBlocks[i + 1]);
    const block = letterBlocks[i + 2] ?? "";
    const firstLine = block.split("\n")[0]?.trim() ?? "";
    const title = firstLine || `Epic ${letter}.${major}`;
    const code = `${letter.toUpperCase()}.${major}`;

    const goalMatch = block.match(/\*\*Goal:\*\*\s*([\s\S]+?)(?=\n\n|\n- [A-Za-z]+\.\d|$)/);
    const goal = goalMatch?.[1]?.trim().replace(/\n/g, " ") ?? "";

    const stories: BmadOutputStory[] = [];
    const bulletRe = new RegExp(`^-\\s+${letter}\\.${major}\\.(\\d+)\\s+(.+)$`, "gim");
    let m: RegExpExecArray | null;
    while ((m = bulletRe.exec(block)) !== null) {
      const storyNumber = Number(m[1]);
      const storyTitle = m[2]!.trim();
      stories.push({
        epicNumber: major,
        storyNumber,
        code: `${letter.toUpperCase()}.${major}.${storyNumber}`,
        title: storyTitle,
      });
    }

    if (title || stories.length > 0) {
      epics.push({
        source,
        number: major,
        code,
        title,
        goal,
        isEnabler: /enabler/i.test(block),
        isSuperseded: false,
        stories,
      });
    }
  }

  if (epics.length > 0) {
    return { epics, deliverySlices };
  }

  // Numbered BMAD Method: ## Epic N: Title  / ### Story N.M: Title
  const numberedBlocks = content.split(/^## Epic (\d+):\s*/m).slice(1);
  for (let i = 0; i < numberedBlocks.length; i += 2) {
    const number = Number(numberedBlocks[i]);
    const block = numberedBlocks[i + 1] ?? "";
    const firstLine = block.split("\n")[0]?.trim() ?? "";
    const title = firstLine || `Epic ${number}`;

    // Skip "Epic List" one-liners that have no Story headings and tiny bodies
    const storyParts = block.split(/^### Story (\d+)\.(\d+):\s*/m);
    if (storyParts.length < 3) continue;

    // Prefer explicit Goal; else use first paragraph after title
    let goal = "";
    const explicitGoal = block.match(/\*\*Goal:\*\*\s*([\s\S]+?)(?=\n\n|\n### )/);
    if (explicitGoal) {
      goal = explicitGoal[1]!.trim().replace(/\n/g, " ");
    } else {
      const para = block.split("\n\n")[1]?.trim();
      if (para && !para.startsWith("###")) goal = para.split("\n")[0] ?? "";
    }

    const stories: BmadOutputStory[] = [];
    for (let j = 1; j < storyParts.length; j += 3) {
      const epicNum = Number(storyParts[j]);
      const storyNum = Number(storyParts[j + 1]);
      const storyBlock = storyParts[j + 2] ?? "";
      const storyTitleLine = storyBlock.split("\n")[0]?.trim() ?? "";
      let title = storyTitleLine;
      let userStory = "";
      let acceptanceStart = false;
      const acceptanceLines: string[] = [];

      for (const line of storyBlock.split("\n").slice(1)) {
        if (line.startsWith("As an ") || line.startsWith("As a ")) {
          userStory = line.trim();
          continue;
        }
        if (line.trim() === "**Acceptance Criteria:**" || line.trim() === "**Acceptance Criteria**" || line.trim() === "**Acceptance**") {
          acceptanceStart = true;
          continue;
        }
        if (line.startsWith("### ") || line.startsWith("## ")) break;
        if (acceptanceStart) acceptanceLines.push(line);
      }

      if (!title && userStory) {
        title = userStory.slice(0, 80) + (userStory.length > 80 ? "…" : "");
      }

      stories.push({
        epicNumber: epicNum,
        storyNumber: storyNum,
        title: title || `Story ${epicNum}.${storyNum}`,
        userStory: userStory || undefined,
        acceptanceCriteria: acceptanceLines.join("\n").trim() || undefined,
      });
    }

    epics.push({
      source,
      number,
      title,
      goal,
      isEnabler: /enabler/i.test(block),
      isSuperseded: /\*\*SUPERSEDED/i.test(block),
      stories,
    });
  }

  return { epics, deliverySlices };
}
