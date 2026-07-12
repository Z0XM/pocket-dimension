<script lang="ts">
  import DownloadIcon from "@lucide/svelte/icons/download";
  import MicIcon from "@lucide/svelte/icons/mic";
  import MicOffIcon from "@lucide/svelte/icons/mic-off";
  import UserMinusIcon from "@lucide/svelte/icons/user-minus";
  import VideoIcon from "@lucide/svelte/icons/video";
  import VideoOffIcon from "@lucide/svelte/icons/video-off";
  import XIcon from "@lucide/svelte/icons/x";
  import { onMount } from "svelte";
  import type { CallParticipantInfo } from "$lib/call/stage-tiles";
  import { Button } from "$lib/components/ui/button";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";

  export type ChatMessage = {
    id: string;
    senderIdentity: string;
    senderDisplayName: string;
    kind?: "text" | "snapshot";
    body: string;
    createdAt: string;
  };

  type Props = {
    slug: string;
    localIdentity: string;
    open: boolean;
    syncToken?: number;
    isHost?: boolean;
    participants?: CallParticipantInfo[];
    bottomOffset?: number;
    onClose: () => void;
    onMuteParticipant?: (identity: string, track: "microphone" | "camera") => void | Promise<void>;
    onRemoveParticipant?: (identity: string) => void | Promise<void>;
  };

  const {
    slug,
    localIdentity,
    open,
    syncToken = 0,
    isHost = false,
    participants = [],
    bottomOffset = 0,
    onClose,
    onMuteParticipant,
    onRemoveParticipant,
  }: Props = $props();

  let messages = $state<ChatMessage[]>([]);
  let draft = $state("");
  let sending = $state(false);
  let errorMessage = $state<string | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let activeTab = $state("chat");
  let lastSyncToken = 0;

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
      const payload: Record<string, string> = { body, kind: "text" };

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

  function downloadSnapshot(message: ChatMessage) {
    const anchor = document.createElement("a");
    anchor.href = message.body;
    anchor.download = `zeo-${slug}-snapshot.png`;
    anchor.click();
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

  $effect(() => {
    if (syncToken > 0 && syncToken !== lastSyncToken) {
      lastSyncToken = syncToken;
      if (open) fetchMessages(false);
    }
  });

  const panelBottomPx = $derived(Math.max(8, bottomOffset + 8));
  const panelMaxHeight = $derived(`min(50dvh, calc(100dvh - ${panelBottomPx + 16}px))`);
</script>

{#if open}
  <aside
    class="fixed inset-x-0 z-30 flex flex-col overflow-hidden rounded-t-xl border border-border bg-card/95 shadow-lg backdrop-blur-sm safe-x sm:absolute sm:inset-x-auto sm:right-4 sm:rounded-xl sm:shadow-lg sm:w-[min(100%,20rem)]"
    style:bottom="{panelBottomPx}px"
    style:max-height={panelMaxHeight}
  >
    <Tabs bind:value={activeTab} class="flex min-h-0 flex-1 flex-col">
      <div class="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <TabsList class="h-auto gap-0.5 bg-transparent p-0">
          <TabsTrigger value="chat" class="h-8 flex-none px-3">Chat</TabsTrigger>
          <TabsTrigger value="people" class="h-8 flex-none px-3">People ({participants.length})</TabsTrigger>
        </TabsList>
        <button type="button" class="action-btn-ghost-destructive size-11 sm:size-7 shrink-0" aria-label="Close chat" onclick={onClose}>
          <XIcon class="size-4" aria-hidden="true" />
        </button>
      </div>

      <TabsContent value="chat" class="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
        <div bind:this={listEl} class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {#if messages.length === 0}
            <p class="text-sm text-muted-foreground">No messages yet. Say hello.</p>
          {:else}
            {#each messages as message (message.id)}
              <div class="text-sm {message.senderIdentity === localIdentity ? 'text-right' : ''}">
                <p class="text-[11px] text-muted-foreground">
                  {message.senderDisplayName}{message.senderIdentity === localIdentity ? " (you)" : ""}
                </p>
                {#if message.kind === "snapshot"}
                  <div class="mt-0.5 inline-block max-w-full overflow-hidden rounded-lg border border-border bg-secondary text-left">
                    <img src={message.body} alt="Call snapshot from {message.senderDisplayName}" class="max-h-40 w-full object-contain" />
                    <button
                      type="button"
                      class="flex w-full items-center justify-center gap-1.5 border-t border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary/80"
                      onclick={() => downloadSnapshot(message)}
                    >
                      <DownloadIcon class="size-3.5" aria-hidden="true" />
                      Download
                    </button>
                  </div>
                {:else}
                  <p
                    class="mt-0.5 inline-block max-w-full whitespace-pre-wrap break-words rounded-lg bg-secondary px-3 py-2 text-left text-foreground"
                  >
                    {message.body}
                  </p>
                {/if}
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
            <Button type="submit" disabled={sending || !draft.trim()}>Send</Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="people" class="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-3 data-[state=inactive]:hidden">
        {#if participants.length === 0}
          <p class="text-sm text-muted-foreground">No participants yet.</p>
        {:else}
          <ul class="space-y-2">
            {#each participants as participant (participant.identity)}
              <li class="rounded-lg border border-border bg-secondary/30 px-3 py-2">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-foreground">
                      {participant.displayName}
                      {#if participant.isLocal}
                        <span class="text-muted-foreground">(you)</span>
                      {/if}
                      {#if participant.isHost}
                        <span class="text-xs text-primary"> · host</span>
                      {/if}
                    </p>
                    <div class="mt-1 flex items-center gap-2 text-muted-foreground">
                      {#if participant.micEnabled}
                        <MicIcon class="size-3.5" aria-label="Mic on" />
                      {:else}
                        <MicOffIcon class="size-3.5" aria-label="Mic off" />
                      {/if}
                      {#if participant.camEnabled}
                        <VideoIcon class="size-3.5" aria-label="Camera on" />
                      {:else}
                        <VideoOffIcon class="size-3.5" aria-label="Camera off" />
                      {/if}
                    </div>
                  </div>

                  {#if isHost && !participant.isLocal && !participant.isHost}
                    <div class="flex shrink-0 flex-col gap-1">
                      {#if onMuteParticipant}
                        <button
                          type="button"
                          class="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onclick={() => onMuteParticipant(participant.identity, "microphone")}
                        >
                          Mute mic
                        </button>
                        <button
                          type="button"
                          class="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onclick={() => onMuteParticipant(participant.identity, "camera")}
                        >
                          Stop cam
                        </button>
                      {/if}
                      {#if onRemoveParticipant}
                        <button
                          type="button"
                          class="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"
                          onclick={() => onRemoveParticipant(participant.identity)}
                        >
                          <UserMinusIcon class="size-3" aria-hidden="true" />
                          Remove
                        </button>
                      {/if}
                    </div>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </TabsContent>
    </Tabs>
  </aside>
{/if}
