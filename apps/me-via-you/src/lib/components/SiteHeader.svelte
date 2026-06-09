<script lang="ts">
  import { page } from "$app/state";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import { userHomePath } from "$lib/paths";
  import { ArrowLeft, LogIn } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  type Viewer = {
    username: string | null;
    emailVerified?: boolean | null;
  } | null;

  type Props = {
    title?: string;
    subtitle?: string;
    currentUsername?: string | null;
    viewer?: Viewer;
    leadingActions?: Snippet;
    trailingActions?: Snippet;
  };

  let { title = "Me Via You", subtitle, currentUsername = null, viewer = null, leadingActions, trailingActions }: Props = $props();

  const showLogin = $derived(!viewer);
  const showBackToProfile = $derived(Boolean(viewer?.username && viewer.emailVerified && currentUsername && viewer.username !== currentUsername));
  const profilePath = $derived(viewer?.username ? userHomePath(viewer.username) : "/login");
  const loginPath = $derived(`/login?redirect=${encodeURIComponent(page.url.pathname + page.url.search)}`);
</script>

<header class="flex items-center justify-between border-b border-border px-6 py-4">
  <div class="min-w-0">
    <h1 class="text-lg font-bold tracking-wide">{title}</h1>
    {#if subtitle}
      <p class="truncate text-sm text-accent">{subtitle}</p>
    {/if}
  </div>

  <div class="flex shrink-0 items-center gap-2">
    {#if showLogin}
      <a
        href={loginPath}
        class="inline-flex items-center gap-2 rounded border border-accent/40 p-2 text-sm text-accent hover:bg-accent/10 sm:px-3 sm:py-1.5"
        aria-label="Login"
      >
        <LogIn size={14} aria-hidden="true" />
        <span class="hidden sm:inline">Login</span>
      </a>
    {/if}

    {#if showBackToProfile}
      <a
        href={profilePath}
        class="inline-flex items-center gap-2 rounded border border-accent/40 p-2 text-sm text-accent hover:bg-accent/10 sm:px-3 sm:py-1.5"
        aria-label="Your profile"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        <span class="hidden sm:inline">Your profile</span>
      </a>
    {/if}

    {#if leadingActions}
      {@render leadingActions()}
    {/if}

    <ThemeToggle />

    {#if trailingActions}
      {@render trailingActions()}
    {/if}
  </div>
</header>
