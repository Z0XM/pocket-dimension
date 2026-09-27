/** Server-side email mask: keep enough to recognize, hide the middle. */
export function censorEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";

  const maskLocal = (s: string): string => {
    if (s.length <= 2) return `${s[0] ?? "*"}*`;
    if (s.length <= 4) return `${s.slice(0, 2)}**`;
    // e.g. mukulz2020 → mu****20
    const head = s.slice(0, 2);
    const tail = s.slice(-2);
    return `${head}${"*".repeat(Math.min(s.length - 4, 4))}${tail}`;
  };

  const parts = domain.split(".");
  const tld = parts.length > 1 ? parts.pop()! : "";
  const name = parts.join(".") || domain;

  const maskDomain = (s: string): string => {
    if (s.length <= 2) return `${s[0] ?? "*"}*`;
    if (s.length <= 4) return `${s.slice(0, 2)}**`;
    // e.g. gmail → gm**l
    return `${s.slice(0, 2)}${"*".repeat(Math.min(s.length - 3, 3))}${s.slice(-1)}`;
  };

  const domainMask = maskDomain(name);
  return tld ? `${maskLocal(local)}@${domainMask}.${tld}` : `${maskLocal(local)}@${domainMask}`;
}
