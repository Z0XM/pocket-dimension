<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { PUBLIC_VAPID_KEY } from "$env/static/public";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as Popover from "$lib/components/ui/popover";
  import * as Select from "$lib/components/ui/select";

  type NotifState = "loading" | "unsupported" | "prompt" | "subscribing" | "subscribed" | "denied";

  let notifState: NotifState = $state("loading");
  let swRegistration: ServiceWorkerRegistration | null = $state(null);
  let reminderTime: string = $state("21:00");
  let saving: boolean = $state(false);
  let selectedHour: string = $state("09");
  let selectedMinute: string = $state("00");
  let selectedPeriod: "AM" | "PM" = $state("PM");

  const hourOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  function syncPickerFromTimeString(time: string) {
    if (!/^\d{2}:\d{2}$/.test(time)) return;
    const [hStr, mStr] = time.split(":");
    const hour24 = Number(hStr);
    const minute = Number(mStr);
    selectedPeriod = hour24 >= 12 ? "PM" : "AM";
    selectedHour = String(hour24 % 12 || 12).padStart(2, "0");
    selectedMinute = String(minute).padStart(2, "0");
  }

  function pickerToTimeString(hour: string, minute: string, period: "AM" | "PM"): string {
    let hour24 = Number(hour) % 12;
    if (period === "PM") hour24 += 12;
    return `${String(hour24).padStart(2, "0")}:${minute}`;
  }

  function formatTimeForDisplay(time: string): string {
    if (!/^\d{2}:\d{2}$/.test(time)) return time;
    const [hStr, mStr] = time.split(":");
    const hour24 = Number(hStr);
    const minute = Number(mStr);
    const hour12 = hour24 % 12 || 12;
    const period = hour24 < 12 ? "AM" : "PM";
    return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
  }

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
          syncPickerFromTimeString(data.reminderTime);
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

  $effect(() => {
    reminderTime = pickerToTimeString(selectedHour, selectedMinute, selectedPeriod);
  });

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
          {saving ? "Saving..." : `You will be notified at ${formatTimeForDisplay(reminderTime)}.`}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <Popover.Root>
          <Popover.Trigger>
            <button
              type="button"
              class="flex h-8 min-w-30 items-center justify-center rounded-md border border-input bg-background px-2 text-xs text-foreground hover:bg-muted/50"
              aria-label="Change reminder time"
            >
              {formatTimeForDisplay(reminderTime)}
            </button>
          </Popover.Trigger>
          <Popover.Content class="w-auto p-3" align="end">
            <div class="flex items-end gap-2">
              <div class="flex flex-col gap-1">
                <span class="text-[10px] uppercase tracking-wide text-muted-foreground">Hour</span>
                <Select.Root type="single" bind:value={selectedHour}>
                  <Select.Trigger size="sm" class="w-18 justify-between">{selectedHour}</Select.Trigger>
                  <Select.Content class="max-h-48">
                    {#each hourOptions as hour}
                      <Select.Item value={hour}>{hour}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[10px] uppercase tracking-wide text-muted-foreground">Minute</span>
                <Select.Root type="single" bind:value={selectedMinute}>
                  <Select.Trigger size="sm" class="w-18 justify-between">{selectedMinute}</Select.Trigger>
                  <Select.Content class="max-h-48">
                    {#each minuteOptions as minute}
                      <Select.Item value={minute}>{minute}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[10px] uppercase tracking-wide text-muted-foreground">AM/PM</span>
                <Select.Root type="single" bind:value={selectedPeriod}>
                  <Select.Trigger size="sm" class="w-20 justify-between">{selectedPeriod}</Select.Trigger>
                  <Select.Content>
                    <Select.Item value="AM">AM</Select.Item>
                    <Select.Item value="PM">PM</Select.Item>
                  </Select.Content>
                </Select.Root>
              </div>
            </div>
            <div class="mt-3 flex justify-end">
              <Popover.Close>
                <Button size="sm">Done</Button>
              </Popover.Close>
            </div>
          </Popover.Content>
        </Popover.Root>
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
