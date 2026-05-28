import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { env } from "$lib/server/env";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".doc",
  ".pptx",
  ".ppt",
  ".xlsx",
  ".xls",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".txt",
  ".md",
  ".epub",
  ".zip",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tiff",
  ".wav",
  ".mp3",
  ".m4a",
]);

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "upload.bin";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex === -1 ? "" : filename.slice(dotIndex).toLowerCase();
}

function getAppRoot(): string {
  return process.cwd();
}

function getPythonPath(): string {
  const configured = env.PYTHON_PATH;
  return configured.startsWith("/") ? configured : resolve(getAppRoot(), configured);
}

function getPythonPackagesDir(): string | undefined {
  const configured = env.PYTHON_PACKAGES_DIR;
  if (!configured) return undefined;
  return configured.startsWith("/") ? configured : resolve(getAppRoot(), configured);
}

function getConvertScriptPath(): string {
  return join(getAppRoot(), "python", "convert.py");
}

export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionError";
  }
}

export async function convertUploadedFile(file: File): Promise<string> {
  if (file.size === 0) {
    throw new ConversionError("The uploaded file is empty.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new ConversionError("File exceeds the 50 MB limit.");
  }

  const extension = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new ConversionError(`Unsupported file type: ${extension || "unknown"}`);
  }

  const tempDir = await mkdtemp(join(tmpdir(), "markitdown-"));
  const safeName = sanitizeFilename(file.name);
  const filePath = join(tempDir, safeName);

  try {
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

    const scriptPath = getConvertScriptPath();
    const pythonPath = getPythonPath();
    const pythonPackagesDir = getPythonPackagesDir();
    const proc = Bun.spawn([pythonPath, scriptPath, filePath], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: getAppRoot(),
      env: {
        ...process.env,
        ...(pythonPackagesDir ? { PYTHONPATH: pythonPackagesDir } : {}),
        EXIFTOOL_PATH: process.env.EXIFTOOL_PATH ?? "/usr/bin/exiftool",
        FFMPEG_PATH: process.env.FFMPEG_PATH ?? "/usr/bin/ffmpeg",
      },
    });

    const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);

    if (exitCode !== 0) {
      if (stderr.includes("No module named 'markitdown'")) {
        throw new ConversionError("MarkItDown is not installed. Run `bun run setup:python` locally or redeploy with Python dependencies.");
      }

      throw new ConversionError(stderr.trim() || "Conversion failed.");
    }

    return stdout;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function getSupportedFormats(): string[] {
  return [...ALLOWED_EXTENSIONS].sort();
}
