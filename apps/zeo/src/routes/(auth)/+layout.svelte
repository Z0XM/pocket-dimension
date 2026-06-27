<script lang="ts">
  const { children } = $props();
</script>

<div class="flex min-h-svh flex-col bg-background">
  <div class="flex flex-1 flex-col items-center justify-center p-6 md:p-10">
    <div class="w-full max-w-sm md:max-w-4xl">
      <div class="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        <div class="grid p-0 md:grid-cols-2">
          {@render children()}
          <div
            class="relative hidden flex-col justify-end bg-secondary p-8 md:flex"
            aria-hidden="true"
          >
            <p class="font-mono text-xs uppercase tracking-[0.35em] text-primary">zeo</p>
            <p class="mt-2 text-lg font-semibold text-foreground">Group video calls</p>
            <p class="mt-1 text-sm text-muted-foreground">Self-hosted on Pocket Dimension</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
