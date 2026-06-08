export function userHomePath(username: string): string {
  return `/u/${username}`;
}

export function userFormPath(username: string, formId: string): string {
  return `/u/${username}/forms/${formId}`;
}

export function userHomePathOrLogin(username: string | null | undefined): string {
  return username ? userHomePath(username) : "/login";
}
