import { writable } from "svelte/store";

export interface Rhyme {
  frontmatter: {
    title?: string;
    thought_on?: string;
    order?: number;
    rating?: number;
    tags?: string[];
    status?: string;
    [key: string]: any;
  };
  content: string;
}

export const filteredRhymes = writable<Rhyme[]>([]);
