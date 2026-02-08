<script lang="ts">
  import {
    CalendarDate,
    type DateValue,
    getLocalTimeZone,
    today as getToday,
  } from "@internationalized/date";
  import { goto } from "$app/navigation";
  import { buttonVariants } from "$lib/components/ui/button";
  import { Calendar } from "$lib/components/ui/calendar";
  import * as Card from "$lib/components/ui/card";
  import { cn, fromDayInt, toDayInt } from "$lib/utils";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const tz = getLocalTimeZone();
  const todayCal = getToday(tz);
  const year = todayCal.year;
  const minValue = new CalendarDate(year, 1, 1);
  const maxValue = new CalendarDate(year, 12, 31);

  const filledDayInts = new Set(data.filledDays);

  function isDateDisabled(date: DateValue): boolean {
    // Disable future dates
    return date.compare(todayCal) > 0;
  }

  function isDayFilled(date: DateValue): boolean {
    const dayInt = date.year * 10000 + date.month * 100 + date.day;
    return filledDayInts.has(dayInt);
  }

  function handleDayClick(date: DateValue) {
    if (date.compare(todayCal) > 0) return;
    const dayInt = date.year * 10000 + date.month * 100 + date.day;
    goto(`/day/${dayInt}`);
  }

  function formatDayInt(dayInt: number): string {
    const date = fromDayInt(dayInt);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  }
</script>

<Card.Root>
  <Card.Content class="flex justify-center p-2">
    <Calendar
      type="single"
      {minValue}
      {maxValue}
      {isDateDisabled}
      onValueChange={(v) => {
        if (v) handleDayClick(v);
      }}
      weekdayFormat="short"
    >
      {#snippet day({ day: date, outsideMonth })}
        <button
          type="button"
          class={cn(
            buttonVariants({ variant: "ghost" }),
            "flex size-(--cell-size) flex-col items-center justify-center gap-0 p-0 leading-none font-normal whitespace-nowrap select-none relative",
            date.compare(todayCal) === 0 &&
              !isDayFilled(date) &&
              "bg-accent text-accent-foreground",
            isDayFilled(date) && "bg-primary/20 text-primary font-semibold",
            date.compare(todayCal) === 0 &&
              isDayFilled(date) &&
              "bg-primary text-primary-foreground",
            outsideMonth && "text-muted-foreground opacity-50",
            date.compare(todayCal) > 0 &&
              "text-muted-foreground pointer-events-none opacity-50",
          )}
          disabled={date.compare(todayCal) > 0 || outsideMonth}
          onclick={() => handleDayClick(date)}
        >
          <span>{date.day}</span>
          {#if isDayFilled(date)}
            <span
              class="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary"
              class:bg-primary-foreground={date.compare(todayCal) === 0}
            ></span>
          {/if}
        </button>
      {/snippet}
    </Calendar>
  </Card.Content>
</Card.Root>

{#if data.publicNotes && data.publicNotes.length > 0}
  <Card.Root>
    <Card.Header>
      <Card.Title>
        <div class="text-lg text-white">Public Notes</div>
      </Card.Title>
    </Card.Header>
    <Card.Content class="flex flex-col gap-3">
      {#each data.publicNotes as { dayInt, note }}
        <div class="flex flex-col gap-1 rounded-md bg-accent/50 px-3 py-2">
          <span class="text-xs text-muted-foreground"
            >{formatDayInt(dayInt)}</span
          >
          <span class="text-sm text-foreground">{note}</span>
        </div>
      {/each}
    </Card.Content>
  </Card.Root>
{/if}
