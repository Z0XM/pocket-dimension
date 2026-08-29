import type { OpenQuestion } from "./types.js";

export function parseOpenQuestions(content: string): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const section = content.match(/### Open questions([\s\S]*?)(?=\n### |\n## |$)/);
  if (!section) return questions;

  const lines = section[1].split("\n");
  for (const line of lines) {
    const match = line.match(/^\|\s*(Q-\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*(Yes|No)\s*\|/i);
    if (!match || match[4].toLowerCase() !== "no") continue;
    questions.push({
      id: match[1].trim(),
      question: match[2].trim(),
      source: match[3].trim(),
    });
  }

  return questions;
}
