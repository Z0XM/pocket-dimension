<script lang="ts">
  import "../app.css";

  const { children } = $props();
</script>

<div class="relative min-h-screen overflow-hidden">
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(147,51,234,0.15),transparent_60%)]"></div>
  <div class="pointer-events-none absolute -right-32 top-1/3 size-96 rounded-full bg-primary/5 blur-3xl"></div>
  <div class="pointer-events-none absolute -left-32 bottom-1/4 size-80 rounded-full bg-accent/5 blur-3xl"></div>

  <div class="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
    {@render children()}
  </div>
</div>
