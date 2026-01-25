import { join } from "node:path";

interface Rhyme {
  title: string;
  content: string;
  status: string;
  thought_on: string;
  language: string;
  rating: number;
  phase: string;
  tags: string[];
  order: number;
}

// Sanitize filename to remove invalid characters
function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*]/g, "") // Remove invalid filename characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// Convert HTML <br> tags to markdown newlines
function convertContentToMarkdown(content: string): string {
  return content.replace(/<br>/gi, "\n");
}

// Generate YAML frontmatter
function generateFrontmatter(rhyme: Rhyme): string {
  const frontmatter: string[] = [];

  if (rhyme.title?.trim()) {
    frontmatter.push(`title: '${rhyme.title.replace(/'/g, "''")}'`);
  }
  frontmatter.push(`thought_on: '${rhyme.thought_on}'`);
  frontmatter.push(`rating: ${rhyme.rating}`);
  frontmatter.push(`phase: '${rhyme.phase}'`);
  frontmatter.push(`status: '${rhyme.status}'`);
  frontmatter.push(`order: ${rhyme.order}`);
  // Format tags array
  if (rhyme.tags && rhyme.tags.length > 0) {
    const tagsFormatted = rhyme.tags.map((tag) => `'${tag.replace(/'/g, "''")}'`).join(", ");
    frontmatter.push(`tags: [${tagsFormatted}]`);
  } else {
    frontmatter.push(`tags: []`);
  }

  return `---\n${frontmatter.join("\n")}\n---\n`;
}

const jsonPath = join(process.cwd(), "data/rhymes/rhymes.json");
const outputDir = join(process.cwd(), "output/rhymes");

console.log("Reading rhymes.json...");
const rhymes: Rhyme[] = await Bun.file(jsonPath).json();
console.log(`Found ${rhymes.length} rhymes`);

const usedFilenames = new Set<string>();

let orderCounter = 1;
console.log("Generating markdown files...");

for (const rhyme of rhymes.sort((a, b) => {
  const dateA = a.thought_on || "";
  const dateB = b.thought_on || "";

  return dateA.localeCompare(dateB);
})) {
  let filename: string;

  if (rhyme.title?.trim()) {
    const sanitizedTitle = sanitizeFilename(rhyme.title);
    filename = `${sanitizedTitle}.md`;
  } else {
    filename = `Untitled${orderCounter}.md`;
  }

  rhyme.order = orderCounter;
  orderCounter++;

  // Ensure unique filenames
  let finalFilename = filename;
  let counter = 1;
  while (usedFilenames.has(finalFilename)) {
    const baseName = filename.replace(/\.md$/, "");
    finalFilename = `${baseName}_${counter}.md`;
    counter++;
  }
  usedFilenames.add(finalFilename);

  const filePath = join(outputDir, finalFilename);
  const content = convertContentToMarkdown(rhyme.content);
  const frontmatter = generateFrontmatter(rhyme);
  const markdownContent = frontmatter + content;

  await Bun.write(filePath, markdownContent);

  console.log(`Created: ${finalFilename}`);
}

console.log(`\nGenerated ${usedFilenames.size} markdown files`);
