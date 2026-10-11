<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { authClient } from "$lib/auth-client";
  import CircleHelp from "@lucide/svelte/icons/circle-help";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Settings from "@lucide/svelte/icons/settings";
  import ThemeToggle from "$lib/components/theme-toggle.svelte";
  import { computeFloatingPanelPlacement, floatingPanelStyle } from "$lib/floating-panel";

  const onControl = $derived(page.url.pathname.startsWith("/app/control"));
  const onGuide = $derived(page.url.pathname.startsWith("/app/guide"));

  let confirmOpen = $state(false);
  let signingOut = $state(false);
  let menuOpen = $state(false);
  let menuRoot: HTMLDivElement | undefined = $state();
  let menuEl: HTMLDivElement | undefined = $state();
  let menuStyle = $state("");

  function openConfirm() {
    menuOpen = false;
    menuStyle = "";
    confirmOpen = true;
  }

  function closeConfirm() {
    if (signingOut) return;
    confirmOpen = false;
  }

  function closeMenu() {
    menuOpen = false;
    menuStyle = "";
  }

  function toggleMenu() {
    menuOpen = !menuOpen;
    if (!menuOpen) menuStyle = "";
  }

  function syncMenuPosition() {
    if (!menuRoot || !menuEl) return;
    const trigger = menuRoot.querySelector(".kebab-trigger");
    if (!(trigger instanceof HTMLElement)) return;
    const anchor = trigger.getBoundingClientRect();
    const preferred = Math.max(10.5 * 16, menuEl.scrollWidth);
    const placement = computeFloatingPanelPlacement({
      anchor,
      panelWidth: preferred,
      panelHeight: menuEl.scrollHeight,
      alignEnd: true,
      padding: 8,
      gap: 6,
    });
    menuStyle = floatingPanelStyle(placement);
  }

  async function confirmSignOut() {
    if (signingOut) return;
    signingOut = true;
    try {
      await authClient.signOut();
      await goto("/login");
    } finally {
      signingOut = false;
      confirmOpen = false;
    }
  }

  $effect(() => {
    if (!confirmOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeConfirm();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  $effect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (menuRoot && target && !menuRoot.contains(target)) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    function handleLayoutChange() {
      syncMenuPosition();
    }

    const timeout = window.setTimeout(() => {
      syncMenuPosition();
      window.addEventListener("pointerdown", handlePointerDown);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("resize", handleLayoutChange);
      window.addEventListener("scroll", handleLayoutChange, true);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  });
</script>

<div class="settings">
  <div class="settings-row" aria-label="Account actions">
    <ThemeToggle />
    {#if onGuide}
      <span class="settings-icon is-current" aria-current="page" title="User guide">
        <CircleHelp size={17} strokeWidth={2.1} aria-hidden="true" />
        <span class="sr-only">User guide</span>
      </span>
    {:else}
      <a class="settings-icon" href="/app/guide" title="User guide" aria-label="User guide">
        <CircleHelp size={17} strokeWidth={2.1} aria-hidden="true" />
      </a>
    {/if}
    {#if onControl}
      <span class="settings-icon is-current" aria-current="page" title="Control Center">
        <Settings size={17} strokeWidth={2.1} aria-hidden="true" />
        <span class="sr-only">Control Center</span>
      </span>
    {:else}
      <a class="settings-icon" href="/app/control" title="Control Center" aria-label="Control Center">
        <Settings size={17} strokeWidth={2.1} aria-hidden="true" />
      </a>
    {/if}
    <button type="button" class="settings-icon" title="Log out" aria-label="Log out" onclick={openConfirm}>
      <LogOut size={17} strokeWidth={2.1} aria-hidden="true" />
    </button>
  </div>

  <div class="settings-kebab" bind:this={menuRoot}>
    <button
      type="button"
      class="settings-icon kebab-trigger"
      title="More actions"
      aria-label="More actions"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onclick={toggleMenu}
    >
      <EllipsisVertical size={17} strokeWidth={2.1} aria-hidden="true" />
    </button>

    {#if menuOpen}
      <div class="settings-menu" role="menu" aria-label="Account actions" bind:this={menuEl} style={menuStyle}>
        <div class="settings-menu-item theme-slot" role="none">
          <ThemeToggle mode="menu" />
        </div>
        {#if onGuide}
          <span class="settings-menu-item is-current" role="menuitem" aria-current="page">
            <CircleHelp size={16} strokeWidth={2.1} aria-hidden="true" />
            <span>How to</span>
          </span>
        {:else}
          <a class="settings-menu-item" role="menuitem" href="/app/guide" onclick={closeMenu}>
            <CircleHelp size={16} strokeWidth={2.1} aria-hidden="true" />
            <span>How to</span>
          </a>
        {/if}
        {#if onControl}
          <span class="settings-menu-item is-current" role="menuitem" aria-current="page">
            <Settings size={16} strokeWidth={2.1} aria-hidden="true" />
            <span>Settings</span>
          </span>
        {:else}
          <a class="settings-menu-item" role="menuitem" href="/app/control" onclick={closeMenu}>
            <Settings size={16} strokeWidth={2.1} aria-hidden="true" />
            <span>Settings</span>
          </a>
        {/if}
        <button type="button" class="settings-menu-item danger" role="menuitem" onclick={openConfirm}>
          <LogOut size={16} strokeWidth={2.1} aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    {/if}
  </div>
</div>

{#if confirmOpen}
  <div class="logout-backdrop" role="presentation" onclick={closeConfirm}>
    <div
      class="logout-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
      tabindex="-1"
      onclick={(event) => event.stopPropagation()}
    >
      <h2 id="logout-title">Log out?</h2>
      <p>You’ll need to sign in again to manage this account.</p>
      <div class="logout-actions">
        <button type="button" class="ghost" onclick={closeConfirm} disabled={signingOut}>Cancel</button>
        <button type="button" class="danger" onclick={confirmSignOut} disabled={signingOut}>
          {signingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-row {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .settings-kebab {
    display: none;
    position: relative;
  }

  .settings-menu {
    position: fixed;
    z-index: 80;
    min-width: 10.5rem;
    padding: 0.35rem;
    background: var(--surface-raised);
    border: 1.5px solid var(--chrome-line, rgba(27, 27, 31, 0.22));
    border-radius: 4px 14px 6px 12px / 12px 4px 14px 6px;
    box-shadow: 3px 4px 0 rgba(27, 27, 31, 0.08);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    box-sizing: border-box;
    overflow: auto;
  }

  .settings-menu-item {
    appearance: none;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    margin: 0;
    padding: 0.55rem 0.65rem;
    border: none;
    border-radius: 2px 8px 3px 7px / 7px 3px 8px 2px;
    background: transparent;
    color: var(--ink, #1b1b1f);
    font-family: var(--hand);
    font-size: 1.05rem;
    line-height: 1.1;
    text-decoration: none;
    text-align: left;
    cursor: pointer;
  }

  .settings-menu-item:hover {
    background: color-mix(in srgb, var(--yellow) 55%, transparent);
    color: var(--brand);
  }

  .settings-menu-item.is-current {
    background: color-mix(in srgb, var(--purple) 45%, transparent);
    color: var(--brand);
    cursor: default;
  }

  .settings-menu-item.danger:hover {
    background: color-mix(in srgb, var(--pink) 45%, transparent);
    color: var(--neg, #c45b6a);
  }

  .settings-menu-item.theme-slot {
    padding: 0;
  }

  .logout-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: 1.25rem;
    background: color-mix(in srgb, var(--ink) 28%, transparent);
  }

  .logout-dialog {
    width: min(100%, 22rem);
    padding: 1.25rem 1.35rem 1.15rem;
    background: var(--surface-raised);
    border: 1.5px solid var(--chrome-line, rgba(27, 27, 31, 0.22));
    border-radius: 4px 14px 6px 12px / 12px 4px 14px 6px;
    box-shadow: 3px 4px 0 rgba(27, 27, 31, 0.08);
    color: var(--ink, #1b1b1f);
  }

  .logout-dialog h2 {
    margin: 0;
    font-family: var(--hand);
    font-size: 1.55rem;
    font-weight: 400;
    line-height: 1.1;
  }

  .logout-dialog p {
    margin: 0.55rem 0 1.15rem;
    font-family: var(--ui);
    font-size: 0.92rem;
    color: var(--ink-muted, #5b5b5b);
  }

  .logout-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.55rem;
  }

  .logout-actions button {
    appearance: none;
    font-family: var(--hand);
    font-size: 1rem;
    padding: 0.4rem 0.85rem;
    border-radius: 255px 12px 225px 10px / 12px 225px 10px 255px;
    cursor: pointer;
  }

  .logout-actions button:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .logout-actions .ghost {
    background: transparent;
    border: 1.5px solid var(--chrome-line, rgba(27, 27, 31, 0.22));
    color: var(--ink, #1b1b1f);
  }

  .logout-actions .ghost:hover:not(:disabled) {
    border-color: var(--brand);
    color: var(--brand);
  }

  .logout-actions .danger {
    background: color-mix(in srgb, var(--pink) 45%, var(--mix-wash));
    border: 1.5px solid color-mix(in srgb, var(--neg, #c45b6a) 70%, transparent);
    color: var(--neg, #c45b6a);
  }

  .logout-actions .danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--pink) 65%, var(--mix-wash));
  }

  @media (max-width: 640px) {
    .settings-row {
      display: none;
    }

    .settings-kebab {
      display: inline-flex;
    }
  }
</style>
