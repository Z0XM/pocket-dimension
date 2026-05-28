<script lang="ts">
  import "../app.css";

  const { children } = $props();
</script>

<div class="relative min-h-screen">
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(119,31,176,0.18),transparent_55%)]"></div>
  <div class="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
    {@render children()}
  </div>
</div>
