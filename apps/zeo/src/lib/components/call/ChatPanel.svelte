<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import { onMount } from "svelte";

  export type ChatMessage = {
    id: string;
    senderIdentity: string;
    senderDisplayName: string;
    body: string;
    createdAt: string;
  };

  type Props = {
    slug: string;
    localIdentity: string;
    guestIdentity?: string | null;
    open: boolean;
    onClose: () => void;
  };

  const { slug, localIdentity, guestIdentity = null, open, onClose }: Props = $props();

  let messages = $state<ChatMessage[]>([]);
  let draft = $state("");
  let sending = $state(false);
  let errorMessage = $state<string | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const lastTimestamp = $derived(messages.at(-1)?.createdAt);

  async function fetchMessages(initial = false) {
    const url = new URL(`/api/rooms/${slug}/chat`, window.location.origin);
    if (!initial && lastTimestamp) {
      url.searchParams.set("since", lastTimestamp);
    }

    const res = await fetch(url);
    if (!res.ok) return;
    const payload = await res.json();
    const incoming = (payload.messages ?? []) as ChatMessage[];
    if (initial) {
      messages = incoming;
    } else if (incoming.length > 0) {
      const known = new Set(messages.map((message) => message.id));
      messages = [...messages, ...incoming.filter((message) => !known.has(message.id))];
    }
  }

  async function sendMessage() {
    const body = draft.trim();
    if (!body || sending) return;

    sending = true;
    errorMessage = null;

    try {
      const payload: Record<string, string> = { body };
      if (guestIdentity) payload.guestIdentity = guestIdentity;

      const res = await fetch(`/api/rooms/${slug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorMessage = data.message ?? "Could not send message";
        return;
      }
      draft = "";
      if (data.message) {
        messages = [...messages, data.message as ChatMessage];
      }
    } finally {
      sending = false;
    }
  }

  $effect(() => {
    if (listEl) {
      listEl.scrollTop = listEl.scrollHeight;
    }
  });

  onMount(() => {
    if (open) fetchMessages(true);
    pollTimer = setInterval(() => {
      if (open) fetchMessages(false);
    }, 2500);
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  });

  $effect(() => {
    if (open) fetchMessages(true);
  });
</script>

{#if open}
  <aside
    class="absolute right-4 bottom-6 z-30 flex w-[min(100%,20rem)] max-h-[min(24rem,calc(100vh-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur-sm"
  >
    <div class="flex items-center justify-between border-b border-border px-4 py-3">
      <h2 class="text-sm font-semibold text-foreground">Chat</h2>
      <button
        type="button"
        class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Close chat"
        onclick={onClose}
      >
        <XIcon class="size-4" aria-hidden="true" />
      </button>
    </div>

    <div bind:this={listEl} class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {#if messages.length === 0}
        <p class="text-sm text-muted-foreground">No messages yet. Say hello.</p>
      {:else}
        {#each messages as message (message.id)}
          <div class="text-sm {message.senderIdentity === localIdentity ? 'text-right' : ''}">
            <p class="text-[11px] text-muted-foreground">
              {message.senderDisplayName}{message.senderIdentity === localIdentity ? " (you)" : ""}
            </p>
            <p class="mt-0.5 rounded-lg bg-secondary px-3 py-2 text-foreground inline-block max-w-full text-left whitespace-pre-wrap break-words">
              {message.body}
            </p>
          </div>
        {/each}
      {/if}
    </div>

    <form
      class="border-t border-border p-3"
      onsubmit={(e) => {
        e.preventDefault();
        sendMessage();
      }}
    >
      {#if errorMessage}
        <p class="mb-2 text-xs text-destructive">{errorMessage}</p>
      {/if}
      <div class="flex gap-2">
        <input
          class="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Type a message"
          bind:value={draft}
          maxlength={2000}
        />
        <button
          type="submit"
          class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          disabled={sending || !draft.trim()}
        >
          Send
        </button>
      </div>
    </form>
  </aside>
{/if}
