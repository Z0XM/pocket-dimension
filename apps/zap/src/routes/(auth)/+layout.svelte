<script lang="ts">
  import icon from "$lib/assets/icon.svg";

  const { children } = $props();
</script>

<div class="zap-wave-field flex min-h-svh flex-col">
  <div class="flex flex-1 flex-col items-center justify-center p-6 md:p-10">
    <div class="w-full max-w-sm md:max-w-4xl">
      <div class="overflow-hidden rounded-xl border border-border bg-card/90 shadow-[0_0_40px_color-mix(in_srgb,var(--signal)_12%,transparent)]">
        <div class="grid p-0 md:grid-cols-2">
          {@render children()}
          <div class="relative hidden bg-secondary md:block">
            <img src={icon} alt="" class="absolute inset-0 h-full w-full object-cover opacity-90" />
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
