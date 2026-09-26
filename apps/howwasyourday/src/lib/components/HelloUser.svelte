<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as Popover from "$lib/components/ui/popover";
  import { getEffectiveDate, toDayInt } from "$lib/utils";
  import ColorPicker from "./ColorPicker.svelte";
  import { Progress } from "./ui/progress";

  // Use effective date: "today" = yesterday until noon
  const today = getEffectiveDate();
  const todayDayInt = toDayInt(today);
  const noOfDaysInYear = today.getFullYear() % 4 === 0 ? 366 : 365;
  const todayCountOfDay = Math.ceil((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24));

  const session = authClient.useSession();
  const user = $derived($session.data?.user);

  let logoutPopoverOpen = $state(false);
  let themePickerOpen = $state(false);

  async function handleLogout() {
    await authClient.signOut();
    goto("/login");
  }

  // --- Theme accent (paper/ink stay fixed; brand tints the page) ---
  const STORAGE_KEY = "hwyd-theme-color";

  let themeColor = $state<string | undefined>(undefined);

  function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 187, s: 34, l: 20 };
    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return {
      h: Math.round(h * 10) / 10,
      s: Math.round(s * 1000) / 10,
      l: Math.round(l * 1000) / 10,
    };
  }

  function applyTheme(hex: string) {
    const { h, s, l } = hexToHsl(hex);
    // Keep primary dark enough for contrast on light paper
    const primaryL = Math.min(Math.max(l, 18), 42);
    const root = document.documentElement;
    // Wash uses the vivid mid hex (year-recap profile --accent), not the clamped primary
    const washHex = hex.startsWith("#") ? hex : `#${hex}`;
    root.style.setProperty("--brand", washHex);
    root.style.setProperty("--primary", `${h} ${s}% ${primaryL}%`);
    root.style.setProperty("--primary-foreground", "140 20% 97%");
    root.style.setProperty("--ring", `${h} ${s}% ${Math.min(primaryL + 8, 48)}%`);
    root.style.setProperty("--accent", `${h} 16% 92%`);
    root.style.setProperty("--accent-foreground", "189 28% 11%");
    root.style.setProperty("--sidebar-primary", `${h} ${s}% ${primaryL}%`);
    root.style.setProperty("--sidebar-ring", `${h} ${s}% ${Math.min(primaryL + 8, 48)}%`);
  }

  function clearTheme() {
    const root = document.documentElement;
    for (const v of [
      "--brand",
      "--primary",
      "--primary-foreground",
      "--ring",
      "--accent",
      "--accent-foreground",
      "--sidebar-primary",
      "--sidebar-ring",
    ]) {
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
    <p class="mb-2 text-[0.8rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">Today</p>
    <Card.Title>
      <a
        href="/day/{todayDayInt}"
        class="font-display block text-3xl leading-none tracking-tight text-foreground transition-colors hover:text-primary hover:underline md:text-4xl"
      >
        {today.toLocaleDateString("en-IN", { weekday: "long" })}
        <span class="text-primary">,</span>{" "}
        {today
          .toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
          .replace(/ /g, " ")}
      </a>
    </Card.Title>
    <Card.Description>
      <span class="font-display text-2xl text-primary">{todayCountOfDay}</span>
      <span class="text-sm tracking-wide text-muted-foreground">{` / ${noOfDaysInYear}`}</span>
    </Card.Description>

    <!-- Header actions: theme (left) + profile (right) -->
    <div class="absolute top-4 right-4 flex items-center gap-0.5">
      <Popover.Root bind:open={themePickerOpen}>
        <Popover.Trigger>
          <button
            type="button"
            class="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
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
              <Button type="button" variant="secondary" size="sm" class="flex-1" onclick={clearTheme}>Reset</Button>
              <Popover.Close>
                <Button type="button" size="sm" class="flex-1">Done</Button>
              </Popover.Close>
            </div>
          </div>
        </Popover.Content>
      </Popover.Root>
      <a
        href="/profile"
        class="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        aria-label="Your profile"
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
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </a>
    </div>
  </Card.Header>
  <Progress value={(todayCountOfDay / noOfDaysInYear) * 100} class="w-full" />
  <Card.Content class="px-6">
    <div class="font-display text-2xl leading-tight tracking-tight md:text-3xl">
      <a href="/" class="text-foreground! cursor-pointer hover:text-foreground/80! hover:underline"> How Was Your Day</a>
      <Popover.Root bind:open={logoutPopoverOpen}>
        <Popover.Trigger>
          <span class="cursor-pointer text-primary hover:underline">{user?.username}</span>
        </Popover.Trigger>
        <Popover.Content class="w-auto">
          <div class="flex flex-col gap-3">
            <p class="text-sm font-medium">Are you sure you want to logout?</p>
            <div class="flex justify-end gap-2">
              <Popover.Close>
                <Button variant="secondary" size="sm">Cancel</Button>
              </Popover.Close>
              <Button variant="destructive" size="sm" onclick={handleLogout}>Logout</Button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Root>
      ?
    </div>
  </Card.Content>
</Card.Root>
