import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export function toDayInt(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function fromDayInt(dayInt: number): Date {
  const year = Math.floor(dayInt / 10000);
  const month = Math.floor((dayInt % 10000) / 100);
  const day = dayInt % 100;
  return new Date(year, month - 1, day);
}

/**
 * Get the effective date by subtracting 12 hours.
 * The app considers "today" as the previous calendar day until noon.
 * E.g., Feb 2 at 10 AM → effective date is Feb 1
 *        Feb 2 at 1 PM  → effective date is Feb 2
 */
export function getEffectiveDate(date?: Date): Date {
  const d = date ?? new Date();
  return new Date(d.getTime() - 12 * 60 * 60 * 1000);
}

/** Get effective dayInt (with -12hr offset) from a Date. */
export function getEffectiveDayInt(date?: Date): number {
  return toDayInt(getEffectiveDate(date));
}

/**
 * Compute the effective dayInt using the client's timezone offset.
 * Used on the server to align with the client's local time.
 * @param serverNow - current Date on the server
 * @param clientTzOffsetMinutes - client's Date.getTimezoneOffset() value
 *   (positive = west of UTC, negative = east of UTC)
 */
export function getEffectiveDayIntForTz(serverNow: Date, clientTzOffsetMinutes: number): number {
  // Convert server local time to UTC
  const utcMs = serverNow.getTime() + serverNow.getTimezoneOffset() * 60_000;
  // Convert UTC to client's local time
  const clientMs = utcMs - clientTzOffsetMinutes * 60_000;
  // Apply -12hr offset
  const effectiveMs = clientMs - 12 * 60 * 60 * 1000;
  return toDayInt(new Date(effectiveMs));
}
