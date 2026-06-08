<script lang="ts">
  import { CalendarDate, type DateValue } from "@internationalized/date";
  import { Calendar } from "$lib/components/ui/calendar";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Popover from "$lib/components/ui/popover";
  import { cn } from "$lib/utils.js";
  import { CalendarIcon, Clock } from "@lucide/svelte";

  type Props = {
    id?: string;
    name?: string;
    value?: string;
    placeholder?: string;
    class?: string;
    disabled?: boolean;
  };

  let { id, name, value = $bindable(""), placeholder = "Pick date and time", class: className, disabled = false }: Props = $props();

  let open = $state(false);
  let calendarValue = $state<DateValue | undefined>(undefined);
  let timeValue = $state("12:00");

  function pad(n: number) {
    return String(n).padStart(2, "0");
  }

  function toDateTimeLocal(date: DateValue, time: string) {
    const [hours = "12", minutes = "00"] = time.split(":");
    return `${date.year}-${pad(date.month)}-${pad(date.day)}T${pad(Number(hours))}:${pad(Number(minutes))}`;
  }

  function fromDateTimeLocal(raw: string) {
    if (!raw) return;
    const [datePart, timePart = "12:00"] = raw.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    if (!year || !month || !day) return;
    calendarValue = new CalendarDate(year, month, day);
    timeValue = timePart.slice(0, 5);
  }

  function syncValue() {
    if (!calendarValue) {
      value = "";
      return;
    }
    value = toDateTimeLocal(calendarValue, timeValue);
  }

  $effect(() => {
    fromDateTimeLocal(value);
  });

  const displayValue = $derived.by(() => {
    if (!value) return placeholder;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return placeholder;
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  });

  function onTimeInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    timeValue = target.value || "12:00";
    syncValue();
  }

  let lastCalendarKey = $state("");

  $effect(() => {
    if (!calendarValue) return;
    const key = `${calendarValue.year}-${calendarValue.month}-${calendarValue.day}`;
    if (key === lastCalendarKey) return;
    lastCalendarKey = key;
    syncValue();
    open = false;
  });
</script>

<div class={cn("grid gap-2", className)}>
  <Popover.Root bind:open>
    <Popover.Trigger>
      <Button
        {id}
        type="button"
        variant="outline"
        {disabled}
        class={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
      >
        <CalendarIcon class="size-4" aria-hidden="true" />
        {displayValue}
      </Button>
    </Popover.Trigger>
    <Popover.Content class="w-auto p-0" align="start">
      <Calendar bind:value={calendarValue} type="single" />
      <div class="flex items-center gap-2 border-t border-border p-3">
        <Clock class="size-4 text-muted-foreground" aria-hidden="true" />
        <Label for="{id}-time" class="sr-only">Time</Label>
        <Input id="{id}-time" type="time" value={timeValue} oninput={onTimeInput} class="w-full" />
      </div>
    </Popover.Content>
  </Popover.Root>

  {#if name}
    <input type="hidden" {name} {value} />
  {/if}
</div>
