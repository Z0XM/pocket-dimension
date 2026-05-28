<script lang="ts">
  import CopyIcon from "@lucide/svelte/icons/copy";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import FileUpIcon from "@lucide/svelte/icons/file-up";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import { Button } from "$components/ui/button/index.js";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let selectedFile = $state<File | null>(null);
  let markdown = $state("");
  let outputFilename = $state("converted.md");
  let error = $state("");
  let isConverting = $state(false);
  let isDragging = $state(false);
  let copyLabel = $state("Copy");

  function setFile(file: File | null) {
    selectedFile = file;
    error = "";
    markdown = "";
  }

  function handleFileInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    setFile(input.files?.[0] ?? null);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
    setFile(event.dataTransfer?.files?.[0] ?? null);
  }

  async function convertFile() {
    if (!selectedFile || isConverting) return;

    isConverting = true;
    error = "";
    markdown = "";

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        markdown?: string;
        filename?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Conversion failed.");
      }

      markdown = payload.markdown ?? "";
      outputFilename = payload.filename ?? "converted.md";
    } catch (conversionError) {
      error = conversionError instanceof Error ? conversionError.message : "Conversion failed.";
    } finally {
      isConverting = false;
    }
  }

  async function copyMarkdown() {
    if (!markdown) return;

    await navigator.clipboard.writeText(markdown);
    copyLabel = "Copied";
    setTimeout(() => {
      copyLabel = "Copy";
    }, 1500);
  }

  function downloadMarkdown() {
    if (!markdown) return;

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = outputFilename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <title>MarkItDown Converter</title>
  <meta name="description" content="Convert PDFs, Office documents, images, audio, and more to Markdown using Microsoft's MarkItDown." />
</svelte:head>

<header class="mb-8 space-y-3">
  <p class="text-xs uppercase tracking-[0.3em] text-accent">Pocket Dimension</p>
  <h1 class="text-3xl font-sans font-semibold tracking-tight sm:text-4xl">MarkItDown</h1>
  <p class="max-w-2xl text-sm text-muted-foreground">
    Upload a file and convert it to Markdown using
    <a class="text-accent underline-offset-4 hover:underline" href="https://github.com/microsoft/markitdown" rel="noreferrer" target="_blank">
      Microsoft's MarkItDown
    </a>
    . Supports PDF, Office docs, images, audio, HTML, CSV, EPUB, ZIP, and more.
  </p>
</header>

<main class="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
  <section class="space-y-4">
    <div
      class={`rounded-xl border border-dashed p-8 transition-colors ${isDragging ? "border-accent bg-accent/10" : "border-border bg-card/40"}`}
      ondragenter={() => {
        isDragging = true;
      }}
      ondragleave={() => {
        isDragging = false;
      }}
      ondragover={(event) => {
        event.preventDefault();
        isDragging = true;
      }}
      ondrop={handleDrop}
      role="presentation"
    >
      <div class="flex flex-col items-center gap-4 text-center">
        <div class="rounded-full bg-secondary p-3 text-accent">
          <FileUpIcon class="size-6" />
        </div>
        <div class="space-y-1">
          <p class="text-sm font-medium">Drop a file here</p>
          <p class="text-xs text-muted-foreground">or choose one from your computer (max 50 MB)</p>
        </div>
        <label class="cursor-pointer">
          <input class="sr-only" accept={data.supportedFormats.join(",")} onchange={handleFileInput} type="file" />
          <span class="inline-flex h-8 items-center rounded-md border border-accent/50 bg-input/30 px-3 text-xs hover:bg-input/50">
            Choose file
          </span>
        </label>
      </div>
    </div>

    {#if selectedFile}
      <div class="rounded-lg border border-border bg-card/60 p-4">
        <p class="text-xs uppercase tracking-wide text-muted-foreground">Selected file</p>
        <p class="mt-1 truncate text-sm">{selectedFile.name}</p>
        <p class="mt-1 text-xs text-muted-foreground">
          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
    {/if}

    <Button class="w-full" disabled={!selectedFile || isConverting} onclick={convertFile} type="button">
      {#if isConverting}
        <LoaderCircleIcon class="size-4 animate-spin" />
        Converting...
      {:else}
        Convert to Markdown
      {/if}
    </Button>

    {#if error}
      <div class="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    {/if}

    <div class="rounded-lg border border-border bg-card/40 p-4">
      <p class="text-xs uppercase tracking-wide text-muted-foreground">Supported formats</p>
      <p class="mt-2 text-xs leading-6 text-muted-foreground">
        {data.supportedFormats.join(", ")}
      </p>
    </div>
  </section>

  <section class="flex min-h-[28rem] flex-col rounded-xl border border-border bg-card/40">
    <div class="flex items-center justify-between border-b border-border px-4 py-3">
      <div>
        <p class="text-sm font-medium">Markdown output</p>
        <p class="text-xs text-muted-foreground">Preview and export the converted result</p>
      </div>
      <div class="flex gap-2">
        <Button disabled={!markdown} onclick={copyMarkdown} size="sm" type="button" variant="outline">
          <CopyIcon class="size-3.5" />
          {copyLabel}
        </Button>
        <Button disabled={!markdown} onclick={downloadMarkdown} size="sm" type="button" variant="secondary">
          <DownloadIcon class="size-3.5" />
          Download
        </Button>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-4">
      {#if markdown}
        <article class="prose prose-invert prose-sm max-w-none whitespace-pre-wrap break-words font-mono text-sm">
          {markdown}
        </article>
      {:else}
        <div class="flex h-full min-h-[20rem] items-center justify-center text-sm text-muted-foreground">Converted Markdown will appear here.</div>
      {/if}
    </div>
  </section>
</main>
