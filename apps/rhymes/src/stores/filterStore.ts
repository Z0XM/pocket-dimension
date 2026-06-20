import { writable } from "svelte/store";
import type { Rhyme } from "../lib/rhymes";

export type { Rhyme } from "../lib/rhymes";

export const filteredRhymes = writable<Rhyme[]>([]);
