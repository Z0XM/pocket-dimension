<script lang="ts">
  import "../styles/global.css";
  import { onMount } from "svelte";

  let installButton: HTMLButtonElement | null = null;

  onMount(() => {
    if (!installButton) return;

    let deferredPrompt: BeforeInstallPromptEvent | null = null;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari standalone flag.
      window.navigator.standalone === true;
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

    if (!isStandalone && isIos) {
      installButton.style.display = "inline-flex";
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      installButton?.style.setProperty("display", "inline-flex");
    }

    function handleAppInstalled() {
      deferredPrompt = null;
      installButton?.style.setProperty("display", "none");
    }

    async function handleInstallClick() {
      if (deferredPrompt) {
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        installButton?.style.setProperty("display", "none");
        return;
      }

      if (isIos) {
        window.alert("To install this app on iOS, tap Share and then 'Add to Home Screen'.");
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    installButton.addEventListener("click", handleInstallClick);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore registration failures to avoid breaking page load.
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      installButton?.removeEventListener("click", handleInstallClick);
    };
  });

  type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  };
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href="/rhyme_icon.svg" />
  <link rel="apple-touch-icon" href="/rhyme_icon.svg" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#11110f" />
</svelte:head>

<slot />

<button bind:this={installButton} id="pwa-install-button" type="button" aria-label="Install app">Install</button>

<style>
  #pwa-install-button {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 50;
    display: none;
    border: 1px solid var(--color-theme-peach-2);
    border-radius: 9999px;
    background: rgba(17, 17, 15, 0.92);
    color: var(--color-theme-peach-1);
    padding: 0.45rem 0.85rem;
    font-size: 0.75rem;
    line-height: 1;
    font-family: var(--font-content);
    cursor: pointer;
  }

  #pwa-install-button:hover {
    background: rgba(36, 36, 32, 0.95);
  }
</style>
