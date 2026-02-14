<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as Popover from "$lib/components/ui/popover";
  import { getEffectiveDate } from "$lib/utils";
  import ColorPicker from "./ColorPicker.svelte";
  import { Progress } from "./ui/progress";

  // Use effective date: "today" = yesterday until noon
  const today = getEffectiveDate();
  const noOfDaysInYear = today.getFullYear() % 4 === 0 ? 366 : 365;
  const todayCountOfDay = Math.ceil(
    (today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const session = authClient.useSession();
  const user = $derived($session.data?.user);

  let logoutPopoverOpen = $state(false);
  let themePickerOpen = $state(false);

  async function handleLogout() {
    await authClient.signOut();
    goto("/login");
  }

  // --- Theme color logic ---
  const STORAGE_KEY = "hwyd-theme-color";
  const DEFAULT_PRIMARY = "#22c55e"; // default green

  let themeColor = $state<string | undefined>(undefined);

  function hexToHue(hex: string): number {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 142;
    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return Math.round(h * 10) / 10;
  }

  function applyTheme(hex: string) {
    const h = hexToHue(hex);
    const root = document.documentElement;
    const vars: Record<string, string> = {
      "--background": `${h} 15% 4.5%`,
      "--foreground": `${h} 15% 93%`,
      "--card": `${h} 12% 9%`,
      "--card-foreground": `${h} 15% 93%`,
      "--popover": `${h} 12% 8%`,
      "--popover-foreground": `${h} 15% 93%`,
      "--primary": `${h} 70.6% 45.3%`,
      "--primary-foreground": `${h} 80.4% 10%`,
      "--secondary": `${h} 18% 14%`,
      "--secondary-foreground": `${h} 10% 96%`,
      "--muted": `${h} 12% 13%`,
      "--muted-foreground": `${h} 10% 55%`,
      "--accent": `${h} 25% 15%`,
      "--accent-foreground": `${h} 10% 96%`,
      "--border": `${h} 18% 16%`,
      "--input": `${h} 15% 14%`,
      "--ring": `${h} 71.8% 29.2%`,
      "--sidebar-background": `${h} 12% 8%`,
      "--sidebar-foreground": `${h} 10% 95%`,
      "--sidebar-primary": `${h} 70.6% 45.3%`,
      "--sidebar-accent": `${h} 20% 14%`,
      "--sidebar-accent-foreground": `${h} 10% 95%`,
      "--sidebar-border": `${h} 18% 16%`,
      "--sidebar-ring": `${h} 71.8% 29.2%`,
    };
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }

  function clearTheme() {
    const root = document.documentElement;
    const vars = [
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--popover",
      "--popover-foreground",
      "--primary",
      "--primary-foreground",
      "--secondary",
      "--secondary-foreground",
      "--muted",
      "--muted-foreground",
      "--accent",
      "--accent-foreground",
      "--border",
      "--input",
      "--ring",
      "--sidebar-background",
      "--sidebar-foreground",
      "--sidebar-primary",
      "--sidebar-accent",
      "--sidebar-accent-foreground",
      "--sidebar-border",
      "--sidebar-ring",
    ];
    for (const v of vars) {
      root.style.removeProperty(v);
    }
    themeColor = undefined;
    localStorage.removeItem(STORAGE_KEY);
    themePickerOpen = false;
  }

  onMount(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      themeColor = saved;
    }
  });

  $effect(() => {
    if (themeColor) {
      applyTheme(themeColor);
      localStorage.setItem(STORAGE_KEY, themeColor);
    }
  });
</script>

<Card.Root class="relative">
  <Card.Header>
    <Card.Title>
      <div class="text-2xl text-foreground">
        {today.toLocaleDateString("en-IN", { weekday: "long" })}
        <span class="text-primary">,</span>{" "}
        {today
          .toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
          .replace(/ /g, " ")}
      </div>
    </Card.Title>
    <Card.Description>
      <span class="text-xl text-primary">{todayCountOfDay}</span>
      <span class="text-md text-muted-foreground">{` / ${noOfDaysInYear}`}</span
      >
    </Card.Description>

    <!-- Theme color picker icon -->
    <Popover.Root bind:open={themePickerOpen}>
      <Popover.Trigger>
        <button
          type="button"
          class="absolute top-4 right-4 rounded-full p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          aria-label="Change theme color"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
            <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
            <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
            <path
              d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
            />
          </svg>
        </button>
      </Popover.Trigger>
      <Popover.Content class="w-auto p-4" align="end">
        <div class="flex flex-col items-center gap-3">
          <p class="text-sm font-medium text-foreground">Theme Color</p>
          <ColorPicker bind:color={themeColor} hueOnly />
          <div class="flex w-full gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              class="flex-1"
              onclick={clearTheme}
            >
              Reset
            </Button>
            <Popover.Close>
              <Button type="button" size="sm" class="flex-1">Done</Button>
            </Popover.Close>
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>
  </Card.Header>
  <Progress value={(todayCountOfDay / noOfDaysInYear) * 100} class="w-full" />
  <Card.Content class="px-6">
    <div class="text-2xl">
      <a
        href="/"
        class="text-foreground! cursor-pointer hover:underline hover:text-foreground/80!"
      >
        How Was Your Day</a
      >
      <Popover.Root bind:open={logoutPopoverOpen}>
        <Popover.Trigger>
          <span
            class="text-3xl font-bold text-primary cursor-pointer hover:underline"
            >{user?.username}</span
          >
        </Popover.Trigger>
        <Popover.Content class="w-auto">
          <div class="flex flex-col gap-3">
            <p class="text-sm font-medium">Are you sure you want to logout?</p>
            <div class="flex gap-2 justify-end">
              <Popover.Close>
                <Button variant="secondary" size="sm">Cancel</Button>
              </Popover.Close>
              <Button variant="destructive" size="sm" onclick={handleLogout}
                >Logout</Button
              >
            </div>
          </div>
        </Popover.Content>
      </Popover.Root>
      ?
    </div>
  </Card.Content>
</Card.Root>
