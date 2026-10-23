/** Max stored length for a listening session display name. */
export const SESSION_NAME_MAX_LEN = 80;

/**
 * Host label for default session names: display name → username → email local-part → null.
 */
export function hostLabelForSession(user: {
  name?: string | null;
  username?: string | null;
  email?: string | null;
}): string | null {
  const name = user.name?.trim();
  if (name) return name;
  const username = user.username?.trim();
  if (username) return username;
  const email = user.email?.trim();
  if (email) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }
  return null;
}

/** Default label when the host does not supply a name. */
export function defaultSessionName(joinCode: string, hostLabel?: string | null): string {
  const label = hostLabel?.trim();
  if (label) return `${label}'s session`;
  return `Session ${joinCode}`;
}

/**
 * Normalize a create/rename name. Empty / whitespace → null (caller uses default).
 * Throws with a user-facing message when over the max length.
 */
export function normalizeSessionName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  if (trimmed.length > SESSION_NAME_MAX_LEN) {
    throw new Error(`Name must be ${SESSION_NAME_MAX_LEN} characters or fewer`);
  }
  return trimmed;
}
