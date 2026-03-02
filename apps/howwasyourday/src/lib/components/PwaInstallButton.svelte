<script lang="ts">
  import { onMount } from "svelte";

  type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  };

  let deferredPrompt: BeforeInstallPromptEvent | null = $state(null);
  let canInstall = $state(false);
  let showIosHint = $state(false);

  function isStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  }

  function isIosDevice() {
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  }

  onMount(() => {
    if (isStandaloneMode()) return;

    showIosHint = isIosDevice();

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      canInstall = true;
    };

    const onAppInstalled = () => {
      deferredPrompt = null;
      canInstall = false;
      showIosHint = false;
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  });

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      canInstall = false;
      return;
    }

    if (showIosHint) {
      window.alert("To install this app on iOS, tap Share and then 'Add to Home Screen'.");
    }
  }
</script>

{#if canInstall || showIosHint}
  <button
    type="button"
    class="fixed right-4 bottom-4 z-50 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-card-foreground shadow-md transition-colors hover:bg-accent"
    onclick={handleInstall}
    aria-label="Install app"
  >
    Install
  </button>
{/if}
