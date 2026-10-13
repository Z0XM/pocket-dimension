/**
 * Nested tag filter DSL for Zap catalogue.
 *
 * Examples:
 *   love and (soft not upbeat)
 *   (chill or soft) and not sad
 *   love AND soft NOT upbeat
 *
 * Grammar (case-insensitive keywords):
 *   expr     := orExpr
 *   orExpr   := andExpr ( OR andExpr )*
 *   andExpr  := notChain ( AND notChain )*
 *   notChain := unary ( NOT unary )*   // "a not b" ⇒ a AND NOT b
 *   unary    := NOT unary | primary
 *   primary  := '(' expr ')' | TAG
 *
 * TAG matches a slug/name token: letters, digits, underscore, hyphen.
 */

export type TagQueryNode =
  | { type: "tag"; name: string }
  | { type: "and"; children: TagQueryNode[] }
  | { type: "or"; children: TagQueryNode[] }
  | { type: "not"; child: TagQueryNode };

export type TagQueryParseResult = { ok: true; ast: TagQueryNode } | { ok: false; error: string };

type Tok =
  { kind: "and" } | { kind: "or" } | { kind: "not" } | { kind: "lparen" } | { kind: "rparen" } | { kind: "tag"; value: string } | { kind: "eof" };

function tokenize(input: string): Tok[] | { error: string } {
  const tokens: Tok[] = [];
  let i = 0;
  const s = input.trim();
  while (i < s.length) {
    const ch = s[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i += 1;
      continue;
    }
    // word
    let j = i;
    while (j < s.length && /[A-Za-z0-9_\-]/.test(s[j]!)) j += 1;
    if (j === i) return { error: `Unexpected character "${ch}"` };
    const raw = s.slice(i, j);
    const lower = raw.toLowerCase();
    if (lower === "and") tokens.push({ kind: "and" });
    else if (lower === "or") tokens.push({ kind: "or" });
    else if (lower === "not") tokens.push({ kind: "not" });
    else tokens.push({ kind: "tag", value: raw });
    i = j;
  }
  tokens.push({ kind: "eof" });
  return tokens;
}

class Parser {
  private i = 0;
  constructor(private tokens: Tok[]) {}

  private peek(): Tok {
    return this.tokens[this.i] ?? { kind: "eof" };
  }

  private take(): Tok {
    const t = this.peek();
    this.i += 1;
    return t;
  }

  parse(): TagQueryNode {
    const node = this.parseOr();
    if (this.peek().kind !== "eof") {
      throw new Error("Unexpected token after expression");
    }
    return node;
  }

  private parseOr(): TagQueryNode {
    const parts = [this.parseAnd()];
    while (this.peek().kind === "or") {
      this.take();
      parts.push(this.parseAnd());
    }
    return parts.length === 1 ? parts[0]! : { type: "or", children: parts };
  }

  private parseAnd(): TagQueryNode {
    const parts = [this.parseNotChain()];
    while (true) {
      const k = this.peek().kind;
      if (k === "and") {
        this.take();
        parts.push(this.parseNotChain());
        continue;
      }
      // Implicit AND before a primary: tag, '(', or unary NOT
      if (k === "tag" || k === "lparen" || k === "not") {
        parts.push(this.parseNotChain());
        continue;
      }
      break;
    }
    return parts.length === 1 ? parts[0]! : { type: "and", children: parts };
  }

  /** Handles "a not b" ⇒ a AND NOT b (repeatable). */
  private parseNotChain(): TagQueryNode {
    let left = this.parseUnary();
    while (this.peek().kind === "not") {
      this.take();
      const right = this.parseUnary();
      left = { type: "and", children: [left, { type: "not", child: right }] };
    }
    return left;
  }

  private parseUnary(): TagQueryNode {
    if (this.peek().kind === "not") {
      this.take();
      return { type: "not", child: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): TagQueryNode {
    const t = this.peek();
    if (t.kind === "lparen") {
      this.take();
      const inner = this.parseOr();
      if (this.peek().kind !== "rparen") throw new Error("Missing closing ')'");
      this.take();
      return inner;
    }
    if (t.kind === "tag") {
      this.take();
      return { type: "tag", name: t.value };
    }
    throw new Error("Expected a tag or '('");
  }
}

export function parseTagQuery(input: string): TagQueryParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty query" };
  const tokens = tokenize(trimmed);
  if ("error" in tokens) return { ok: false, error: tokens.error };
  try {
    const ast = new Parser(tokens).parse();
    return { ok: true, ast };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid query" };
  }
}

export function formatTagQuery(ast: TagQueryNode): string {
  switch (ast.type) {
    case "tag":
      return ast.name;
    case "not":
      return `not ${needsParens(ast.child) ? `(${formatTagQuery(ast.child)})` : formatTagQuery(ast.child)}`;
    case "and":
      return ast.children.map((c) => (c.type === "or" ? `(${formatTagQuery(c)})` : formatTagQuery(c))).join(" and ");
    case "or":
      return ast.children.map((c) => formatTagQuery(c)).join(" or ");
  }
}

function needsParens(n: TagQueryNode) {
  return n.type === "and" || n.type === "or";
}

/** Collect leaf tag names (lowercased for matching). */
export function collectTagNames(ast: TagQueryNode, out = new Set<string>()): Set<string> {
  if (ast.type === "tag") {
    out.add(ast.name.toLowerCase());
  } else if (ast.type === "not") {
    collectTagNames(ast.child, out);
  } else {
    for (const c of ast.children) collectTagNames(c, out);
  }
  return out;
}

/**
 * Evaluate AST against per-asset tag-id sets.
 * `universe` is the candidate asset id set (required for NOT).
 * `tagNameToId` maps lowercase name/slug → tag uuid.
 */
export function evaluateTagQuery(
  ast: TagQueryNode,
  opts: {
    universe: Set<string>;
    /** mediaAssetId → set of tag ids the user has on that asset */
    tagsByAsset: Map<string, Set<string>>;
    /** lowercase name/slug → tag id */
    tagNameToId: Map<string, string>;
  }
): { ok: true; assetIds: Set<string> } | { ok: false; error: string } {
  const resolve = (name: string): string | null => opts.tagNameToId.get(name.toLowerCase()) ?? null;

  const missing: string[] = [];
  for (const name of collectTagNames(ast)) {
    if (!resolve(name)) missing.push(name);
  }
  if (missing.length) {
    return { ok: false, error: `Unknown tag${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}` };
  }

  function assetsWithTag(tagId: string): Set<string> {
    const out = new Set<string>();
    for (const [assetId, tags] of opts.tagsByAsset) {
      if (!opts.universe.has(assetId)) continue;
      if (tags.has(tagId)) out.add(assetId);
    }
    return out;
  }

  function evalNode(node: TagQueryNode): Set<string> {
    switch (node.type) {
      case "tag": {
        const id = resolve(node.name)!;
        return assetsWithTag(id);
      }
      case "and": {
        if (node.children.length === 0) return new Set(opts.universe);
        let acc = evalNode(node.children[0]!);
        for (let i = 1; i < node.children.length; i++) {
          const next = evalNode(node.children[i]!);
          acc = new Set([...acc].filter((id) => next.has(id)));
        }
        return acc;
      }
      case "or": {
        const out = new Set<string>();
        for (const c of node.children) {
          for (const id of evalNode(c)) out.add(id);
        }
        return out;
      }
      case "not": {
        const inner = evalNode(node.child);
        const out = new Set<string>();
        for (const id of opts.universe) {
          if (!inner.has(id)) out.add(id);
        }
        return out;
      }
    }
  }

  return { ok: true, assetIds: evalNode(ast) };
}
