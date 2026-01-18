<script lang="ts">
  import MoonIcon from "@lucide/svelte/icons/moon";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { toggleMode } from "mode-watcher";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";

  let { class: className } = $props();
</script>

<Button
  onclick={toggleMode}
  variant="outline"
  size="icon-lg"
  class={cn("cursor-pointer rounded-full [&_svg]:size-[20px]!", className)}
>
  <SunIcon
    font-weight="duotone"
    class="scale-100 rotate-0 transition-all! dark:scale-0 dark:-rotate-90"
  />
  <MoonIcon
    font-weight="duotone"
    class="absolute scale-0 rotate-90 transition-all! dark:scale-100 dark:rotate-0"
  />
</Button>
