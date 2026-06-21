<script lang="ts">
  const { children } = $props();
</script>

<div class="flex min-h-screen items-center justify-center bg-theme-pink-5 p-6">
  <div class="w-full max-w-md border border-theme-peach-2/40 bg-theme-pink-4 p-6">
    {@render children()}
  </div>
</div>
