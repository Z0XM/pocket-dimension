<script lang="ts">
  import icon from "$lib/assets/icon.svg";

  const { children } = $props();
</script>

<div class="flex min-h-svh flex-col items-center justify-center bg-background p-6 md:p-10">
  <div class="w-full max-w-sm md:max-w-4xl">
    <div class="overflow-hidden border-2 border-foreground bg-card shadow-[4px_4px_0_var(--accent)]">
      <div class="grid p-0 md:grid-cols-2">
        {@render children()}
        <div class="relative hidden bg-secondary/60 md:block">
          <img src={icon} alt="" class="absolute inset-0 h-full w-full object-cover opacity-90" />
        </div>
      </div>
    </div>
  </div>
</div>
