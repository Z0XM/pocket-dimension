import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { browsePath, epicRoute, extGapBrowsePath, resolveSourceToken, resolvedToHref, storyRoute, type ResolvedSource } from "@/lib/sourcePaths";
import { featuresLocation, scopedHref } from "@/lib/featuresLocation";
import { cn } from "@/lib/utils";

type EntityLinkProps = {
  className?: string;
  children?: ReactNode;
};

export function StoryLink({
  storyId,
  label,
  className,
  children,
  ...rest
}: EntityLinkProps & { storyId: string; label?: string } & Omit<ComponentPropsWithoutRef<typeof Link>, "to">) {
  return (
    <Link to={storyRoute(storyId)} className={cn("font-mono text-heading hover:underline", className)} {...rest}>
      {children ?? label ?? storyId.replace("-", ".")}
    </Link>
  );
}

export function EpicLink({
  epicId,
  epicNumber,
  label,
  className,
  children,
  ...rest
}: EntityLinkProps & {
  epicId?: string;
  epicNumber?: number;
  label?: string;
} & Omit<ComponentPropsWithoutRef<typeof Link>, "to">) {
  const to = epicId ? epicRoute(epicId) : epicRoute(epicNumber ?? 0);
  return (
    <Link to={to} className={cn("font-mono text-heading hover:underline", className)} {...rest}>
      {children ?? label ?? (epicNumber != null ? `Epic ${epicNumber}` : epicId)}
    </Link>
  );
}

export function FeatureLink({
  featureId,
  className,
  children,
  ...rest
}: EntityLinkProps & { featureId: string } & Omit<ComponentPropsWithoutRef<typeof Link>, "to">) {
  const location = useLocation();
  return (
    <Link to={featuresLocation(featureId, location.search)} className={cn("font-mono text-heading hover:underline", className)} {...rest}>
      {children ?? featureId}
    </Link>
  );
}

export function ExtGapLink({ extId, className, children }: EntityLinkProps & { extId: string }) {
  return (
    <Link to={extGapBrowsePath(extId)} className={cn("font-mono hover:underline", className)}>
      {children ?? extId}
    </Link>
  );
}

export function DocPathLink({ path, hash, className, children }: EntityLinkProps & { path: string; hash?: string }) {
  return (
    <Link to={browsePath(path, hash)} className={cn("hover:underline", className)}>
      {children ?? path}
    </Link>
  );
}

export function ResolvedSourceLink({ source, className }: { source: ResolvedSource; className?: string }) {
  const location = useLocation();
  const href = scopedHref(resolvedToHref(source), location.search);
  if (!href) {
    return <span className={className}>{source.label}</span>;
  }
  return (
    <Link to={href} className={cn("hover:underline", className)}>
      {source.label}
    </Link>
  );
}

/** Render a deferred/question source field as linked tokens. */
export function SourceFieldLinks({ source, className }: { source: string; className?: string }) {
  const tokens = source
    .split(/[;|/]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(resolveSourceToken);

  if (tokens.length === 0) {
    return <span className={className}>{source || "—"}</span>;
  }

  return (
    <span className={cn("inline-flex flex-wrap gap-x-1 gap-y-0.5", className)}>
      {tokens.map((t, i) => (
        <span key={`${t.label}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground/50">·</span>}
          <ResolvedSourceLink source={t} />
        </span>
      ))}
    </span>
  );
}

const ENTITY_RE = /\b(EXT-\d+|Story\s+\d+\.\d+|Epic\s+\d+|F-\d+)\b/gi;

/** Turn free text containing EXT / Story / Epic / Feature refs into linked fragments. */
export function LinkedEntityText({ text, className }: { text: string; className?: string }) {
  const location = useLocation();
  const parts: ReactNode[] = [];
  let last = 0;
  const re = new RegExp(ENTITY_RE.source, "gi");
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) != null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const token = match[0];
    const resolved = resolveSourceToken(token);
    const href = scopedHref(resolvedToHref(resolved), location.search);
    if (href) {
      parts.push(
        <Link key={key++} to={href} className="font-mono text-heading hover:underline">
          {resolved.label}
        </Link>
      );
    } else {
      parts.push(token);
    }
    last = match.index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  if (parts.length === 0) return <span className={className}>{text}</span>;

  return <span className={className}>{parts}</span>;
}
