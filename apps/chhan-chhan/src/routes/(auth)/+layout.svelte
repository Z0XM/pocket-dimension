<script lang="ts">
  import icon from "$lib/assets/icon.svg";

  const { children } = $props();
</script>

<div class="flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
  <div class="w-full max-w-sm md:max-w-4xl">
    <div class="overflow-hidden rounded-md border border-border bg-card shadow-[0_0_0_1px_color-mix(in_srgb,var(--border)_60%,transparent)]">
      <div class="grid p-0 md:grid-cols-2">
        {@render children()}
        <div class="bg-secondary/40 relative hidden md:block">
          <img src={icon} alt="" class="absolute inset-0 h-full w-full object-cover opacity-90" />
        </div>
      </div>
    </div>
  </div>
</div>
