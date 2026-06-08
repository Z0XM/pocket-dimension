import { Filter } from "bad-words";

const filter = new Filter({ placeHolder: "*" });

export function censorText(text: string | null | undefined): string {
  if (!text) return "";
  return filter.clean(text);
}
