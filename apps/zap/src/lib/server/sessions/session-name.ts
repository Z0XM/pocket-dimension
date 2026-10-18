/** Max stored length for a listening session display name. */
export const SESSION_NAME_MAX_LEN = 80;

/** Default label when the host does not supply a name. */
export function defaultSessionName(joinCode: string): string {
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
