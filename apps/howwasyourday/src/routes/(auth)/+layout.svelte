<script>
  import * as Card from "$components/ui/card/index.js";
  import icon from "$lib/assets/icon.svg";

  const { children } = $props();
</script>

<div class="flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
  <div class="w-full max-w-sm md:max-w-4xl">
    <div class="mb-6 text-center md:text-left">
      <p class="mb-2 text-[0.8rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">How Was Your Day</p>
    </div>
    <div class="flex flex-col gap-6">
      <Card.Root class="overflow-hidden p-0">
        <Card.Content class="grid p-0 md:grid-cols-2">
          {@render children()}
          <div class="relative hidden bg-black md:block">
            <img src={icon} alt="placeholder" class="absolute inset-0 h-full w-full object-cover opacity-90" />
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>
