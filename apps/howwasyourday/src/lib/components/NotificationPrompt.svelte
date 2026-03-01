<script lang="ts">
  import { Time } from "@internationalized/date";
  import { TimeField } from "bits-ui";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { PUBLIC_VAPID_KEY } from "$env/static/public";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";

  type NotifState = "loading" | "unsupported" | "prompt" | "subscribing" | "subscribed" | "denied";

  let notifState: NotifState = $state("loading");
  let swRegistration: ServiceWorkerRegistration | null = $state(null);
  let reminderTime: string = $state("21:00");
  let saving: boolean = $state(false);

  function parseTime(str: string): Time {
    const [h, m] = str.split(":").map(Number);
    return new Time(h, m);
  }

  function timeToString(t: Time): string {
    return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
  }

  let timeValue: Time = $state(parseTime(reminderTime));

  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function checkSubscriptionStatus(reg: ServiceWorkerRegistration) {
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      const res = await fetch("/api/push/status");
      const data = await res.json();
      if (data.subscribed) {
        notifState = "subscribed";
        if (data.reminderTime) {
          reminderTime = data.reminderTime;
          prevTime = data.reminderTime;
          timeValue = parseTime(data.reminderTime);
        }
      } else {
        notifState = "prompt";
      }
    } else {
      notifState = "prompt";
    }
  }

  onMount(async () => {
    if (!browser || !("serviceWorker" in navigator) || !("PushManager" in window) || !PUBLIC_VAPID_KEY) {
      notifState = "unsupported";
      return;
    }

    if (Notification.permission === "denied") {
      notifState = "denied";
      return;
    }

    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      swRegistration = reg;
      await navigator.serviceWorker.ready;
      await checkSubscriptionStatus(reg);
    } catch {
      notifState = "unsupported";
    }
  });

  async function subscribe() {
    if (!swRegistration) return;
    notifState = "subscribing";

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        notifState = "denied";
        return;
      }

      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY).buffer as ArrayBuffer,
      });

      const json = subscription.toJSON();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          timezone,
          reminderTime,
        }),
      });

      if (res.ok) {
        notifState = "subscribed";
      } else {
        notifState = "prompt";
      }
    } catch {
      notifState = "prompt";
    }
  }

  async function unsubscribe() {
    if (!swRegistration) return;

    try {
      const subscription = await swRegistration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      notifState = "prompt";
    } catch {
      notifState = "prompt";
    }
  }

  let prevTime: string = $state("21:00");

  function onTimeChange(val: Time | undefined) {
    if (!val) return;
    timeValue = val;
    reminderTime = timeToString(val);
  }

  $effect(() => {
    if (reminderTime === prevTime) return;
    if (!/^\d{2}:\d{2}$/.test(reminderTime)) return;
    prevTime = reminderTime;
    saving = true;
    fetch("/api/push/time", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderTime }),
    }).finally(() => {
      saving = false;
    });
  });
</script>

{#if notifState === "prompt"}
  <Card.Root class="border-primary/20 bg-primary/5">
    <Card.Content class="flex items-center justify-between gap-3 px-4 py-3">
      <div class="flex flex-col gap-0.5">
        <span class="text-sm font-medium text-foreground">Daily Reminders</span>
        <span class="text-xs text-muted-foreground">Get a nudge to fill your day</span>
      </div>
      <Button size="sm" onclick={subscribe}>Enable</Button>
    </Card.Content>
  </Card.Root>
{:else if notifState === "subscribing"}
  <Card.Root class="border-primary/20 bg-primary/5">
    <Card.Content class="flex items-center justify-between gap-3 px-4 py-3">
      <span class="text-sm text-muted-foreground">Enabling reminders...</span>
    </Card.Content>
  </Card.Root>
{:else if notifState === "subscribed"}
  <Card.Root class="border-primary/20 bg-primary/5">
    <Card.Content class="flex items-center justify-between gap-3 px-4 py-3">
      <div class="flex flex-col gap-0.5">
        <span class="text-sm font-medium text-foreground">Daily Reminders</span>
        <span class="text-xs text-muted-foreground">
          {saving
            ? "Saving..."
            : `You will be notified at ${String(timeValue.hour % 12 || 12).padStart(2, "0")}:${String(timeValue.minute).padStart(2, "0")} ${timeValue.hour < 12 ? "AM" : "PM"}.`}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <TimeField.Root value={timeValue} onValueChange={onTimeChange} hourCycle={12}>
          <TimeField.Input class="flex h-8 items-center rounded-md border border-input bg-background px-2 text-xs text-foreground">
            {#snippet children({ segments })}
              {#each segments as { part, value }, i (part + i)}
                {#if part === "literal"}
                  <TimeField.Segment {part} class="px-0.5 text-muted-foreground">
                    {value}
                  </TimeField.Segment>
                {:else}
                  <TimeField.Segment
                    {part}
                    class="rounded px-0.5 py-0.5 tabular-nums hover:bg-muted focus:bg-primary/15 focus:text-foreground aria-[valuetext=Empty]:text-muted-foreground focus-visible:ring-0 focus-visible:outline-none"
                  >
                    {value}
                  </TimeField.Segment>
                {/if}
              {/each}
            {/snippet}
          </TimeField.Input>
        </TimeField.Root>
        <Button size="sm" variant="secondary" onclick={unsubscribe}>Disable</Button>
      </div>
    </Card.Content>
  </Card.Root>
{:else if notifState === "denied"}
  <Card.Root class="border-destructive/20 bg-destructive/5">
    <Card.Content class="flex items-center gap-3 px-4 py-3">
      <span class="text-xs text-muted-foreground">Notifications blocked. Enable them in browser settings for daily reminders.</span>
    </Card.Content>
  </Card.Root>
{/if}
