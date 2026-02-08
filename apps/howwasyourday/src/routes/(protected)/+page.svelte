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
  import { cn } from "$lib/utils";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const tz = getLocalTimeZone();
  const todayCal = getToday(tz);
  const year = todayCal.year;
  const minValue = new CalendarDate(year, 1, 1);
  const maxValue = new CalendarDate(year, 12, 31);

  const filledDayInts = new Set(data.filledDays);
  const dayEmojiMap: Record<number, string | null> = data.dayEmojiMap ?? {};
  const dayColorMap: Record<number, string | null> = data.dayColorMap ?? {};
  const dayRatingMap: Record<number, number | null> = data.dayRatingMap ?? {};

  type CalendarMode = "emojis" | "colors" | "graph";
  let calendarMode: CalendarMode = $state("emojis");

  type TimeRange = "month" | "year";
  let timeRange: TimeRange = $state("month");

  // Graph state
  let graphMonth = $state(todayCal.month); // 1-12
  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  function daysInMonth(month: number, yr: number): number {
    return new Date(yr, month, 0).getDate();
  }

  function getMonthRatings(month: number): { day: number; rating: number }[] {
    const totalDays = daysInMonth(month, year);
    const points: { day: number; rating: number }[] = [];
    for (let d = 1; d <= totalDays; d++) {
      const dayInt = year * 10000 + month * 100 + d;
      const r = dayRatingMap[dayInt];
      if (r != null) {
        points.push({ day: d, rating: r });
      }
    }
    return points;
  }

  // SVG chart dimensions
  const chartW = 340;
  const chartH = 200;
  const padL = 32;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const ratingMin = -1;
  const ratingMax = 11;

  function xPos(day: number, totalDays: number): number {
    return padL + ((day - 1) / (totalDays - 1)) * plotW;
  }

  function yPos(rating: number): number {
    return (
      padT + plotH - ((rating - ratingMin) / (ratingMax - ratingMin)) * plotH
    );
  }

  // Build line segments (non-continuous: only connect consecutive days)
  function buildSegments(
    points: { day: number; rating: number }[],
    totalDays: number,
  ): string[] {
    const segments: string[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      if (points[i + 1].day === points[i].day + 1) {
        // Consecutive days — connect them
        const x1 = xPos(points[i].day, totalDays);
        const y1 = yPos(points[i].rating);
        const x2 = xPos(points[i + 1].day, totalDays);
        const y2 = yPos(points[i + 1].rating);
        // If the previous point wasn't connected, start a new segment
        if (
          segments.length === 0 ||
          i === 0 ||
          points[i].day !== points[i - 1].day + 1
        ) {
          segments.push(`M${x1},${y1} L${x2},${y2}`);
        } else {
          // Extend the last segment
          segments[segments.length - 1] += ` L${x2},${y2}`;
        }
      }
    }
    return segments;
  }

  // Short month labels for year mosaic
  const MONTH_SHORT = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Build year mosaic data: array of { month, days: { day, dayInt, isFuture }[] }
  function getYearMosaicData(): {
    month: number;
    label: string;
    days: { day: number; dayInt: number; isFuture: boolean }[];
  }[] {
    const todayInt = year * 10000 + todayCal.month * 100 + todayCal.day;
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const total = daysInMonth(m, year);
      return {
        month: m,
        label: MONTH_SHORT[i],
        days: Array.from({ length: total }, (_, d) => {
          const dayInt = year * 10000 + m * 100 + (d + 1);
          return { day: d + 1, dayInt, isFuture: dayInt > todayInt };
        }),
      };
    });
  }

  // Year graph: get all ratings across the entire year as sequential points
  function getYearRatings(): {
    dayOfYear: number;
    rating: number;
    dayInt: number;
  }[] {
    const points: { dayOfYear: number; rating: number; dayInt: number }[] = [];
    let seq = 0;
    for (let m = 1; m <= 12; m++) {
      const total = daysInMonth(m, year);
      for (let d = 1; d <= total; d++) {
        seq++;
        const dayInt = year * 10000 + m * 100 + d;
        const r = dayRatingMap[dayInt];
        if (r != null) {
          points.push({ dayOfYear: seq, rating: r, dayInt });
        }
      }
    }
    return points;
  }

  // Build year graph segments (non-continuous for gaps)
  function buildYearSegments(
    points: { dayOfYear: number; rating: number }[],
    totalDays: number,
  ): string[] {
    const segments: string[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      if (points[i + 1].dayOfYear === points[i].dayOfYear + 1) {
        const x1 = xPos(points[i].dayOfYear, totalDays);
        const y1 = yPos(points[i].rating);
        const x2 = xPos(points[i + 1].dayOfYear, totalDays);
        const y2 = yPos(points[i + 1].rating);
        if (
          segments.length === 0 ||
          i === 0 ||
          points[i].dayOfYear !== points[i - 1].dayOfYear + 1
        ) {
          segments.push(`M${x1},${y1} L${x2},${y2}`);
        } else {
          segments[segments.length - 1] += ` L${x2},${y2}`;
        }
      }
    }
    return segments;
  }

  // Month boundary positions for year graph x-axis labels
  function getMonthBoundaries(): { label: string; dayOfYear: number }[] {
    const boundaries: { label: string; dayOfYear: number }[] = [];
    let seq = 0;
    for (let m = 1; m <= 12; m++) {
      boundaries.push({ label: MONTH_SHORT[m - 1], dayOfYear: seq + 1 });
      seq += daysInMonth(m, year);
    }
    return boundaries;
  }

  function isDateDisabled(date: DateValue): boolean {
    // Disable future dates
    return date.compare(todayCal) > 0;
  }

  function isDayFilled(date: DateValue): boolean {
    const dayInt = date.year * 10000 + date.month * 100 + date.day;
    return filledDayInts.has(dayInt);
  }

  function getDayEmoji(date: DateValue): string | null {
    const dayInt = date.year * 10000 + date.month * 100 + date.day;
    return dayEmojiMap[dayInt] ?? null;
  }

  function getDayColor(date: DateValue): string | null {
    const dayInt = date.year * 10000 + date.month * 100 + date.day;
    return dayColorMap[dayInt] ?? null;
  }

  function handleDayClick(date: DateValue) {
    if (date.compare(todayCal) > 0) return;
    const dayInt = date.year * 10000 + date.month * 100 + date.day;
    goto(`/day/${dayInt}`);
  }
</script>

<Card.Root>
  <Card.Content class="flex flex-col items-center gap-2 p-2">
    <div class="flex items-center gap-2">
      <div class="flex items-center rounded-lg bg-muted p-0.5">
        <button
          type="button"
          class={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-all",
            calendarMode === "emojis"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onclick={() => (calendarMode = "emojis")}
        >
          Emojis
        </button>
        <button
          type="button"
          class={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-all",
            calendarMode === "colors"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onclick={() => (calendarMode = "colors")}
        >
          Colors
        </button>
        <button
          type="button"
          class={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-all",
            calendarMode === "graph"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onclick={() => (calendarMode = "graph")}
        >
          Graph
        </button>
      </div>
      <!-- Month / Year toggle -->
      <div class="flex items-center rounded-lg bg-muted p-0.5">
        <button
          type="button"
          class={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-all",
            timeRange === "month"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onclick={() => (timeRange = "month")}
        >
          Month
        </button>
        <button
          type="button"
          class={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-all",
            timeRange === "year"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onclick={() => (timeRange = "year")}
        >
          Year
        </button>
      </div>
    </div>

    <!-- ==================== YEAR VIEW ==================== -->
    {#if timeRange === "year"}
      {#if calendarMode === "graph"}
        <!-- Year Graph -->
        {@const yearTotalDays = Array.from({ length: 12 }, (_, i) =>
          daysInMonth(i + 1, year),
        ).reduce((a, b) => a + b, 0)}
        {@const yearPoints = getYearRatings()}
        {@const yearSegments = buildYearSegments(yearPoints, yearTotalDays)}
        {@const yTicks = [0, 2, 4, 6, 8, 10]}
        {@const monthBounds = getMonthBoundaries()}
        {@const yearChartW = 600}
        {@const yearPlotW = yearChartW - padL - padR}
        <div class="flex w-full flex-col items-center gap-1 overflow-x-auto">
          <span class="text-sm font-medium">{year}</span>
          <svg
            viewBox="0 0 {yearChartW} {chartH}"
            class="w-full min-w-[500px]"
            preserveAspectRatio="xMidYMid meet"
          >
            {#each yTicks as tick}
              <line
                x1={padL}
                y1={yPos(tick)}
                x2={yearChartW - padR}
                y2={yPos(tick)}
                stroke="currentColor"
                stroke-opacity="0.1"
                stroke-width="0.5"
              />
              <text
                x={padL - 6}
                y={yPos(tick) + 3.5}
                text-anchor="end"
                fill="currentColor"
                fill-opacity="0.4"
                font-size="9">{tick}</text
              >
            {/each}

            <!-- Month labels on x-axis -->
            {#each monthBounds as mb}
              {@const mx =
                padL + ((mb.dayOfYear - 1) / (yearTotalDays - 1)) * yearPlotW}
              <text
                x={mx}
                y={chartH - 6}
                text-anchor="start"
                fill="currentColor"
                fill-opacity="0.4"
                font-size="8">{mb.label}</text
              >
              <line
                x1={mx}
                y1={padT}
                x2={mx}
                y2={chartH - padB}
                stroke="currentColor"
                stroke-opacity="0.06"
                stroke-width="0.5"
              />
            {/each}

            {#each yearSegments as seg}
              <path
                d={seg}
                fill="none"
                stroke="#22c55e"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            {/each}

            {#each yearPoints as pt}
              <circle
                cx={padL +
                  ((pt.dayOfYear - 1) / (yearTotalDays - 1)) * yearPlotW}
                cy={yPos(pt.rating)}
                r="2"
                fill="#22c55e"
              />
            {/each}

            <line
              x1={padL}
              y1={yPos(0)}
              x2={yearChartW - padR}
              y2={yPos(0)}
              stroke="currentColor"
              stroke-opacity="0.2"
              stroke-width="0.5"
              stroke-dasharray="4 2"
            />

            {#if yearPoints.length === 0}
              <text
                x={yearChartW / 2}
                y={chartH / 2}
                text-anchor="middle"
                fill="currentColor"
                fill-opacity="0.3"
                font-size="12">No ratings this year</text
              >
            {/if}
          </svg>
        </div>
      {:else}
        <!-- Year Mosaic (Emojis or Colors) -->
        {@const mosaicData = getYearMosaicData()}
        <div class="flex w-full flex-col gap-1 overflow-x-auto">
          {#each mosaicData as { label, days }}
            <div class="flex items-center gap-1">
              <span
                class="w-8 shrink-0 text-right text-[11px] text-muted-foreground"
                >{label}</span
              >
              <div class="flex gap-0.5">
                {#each days as { dayInt, isFuture }}
                  {@const filled = filledDayInts.has(dayInt)}
                  {@const color = dayColorMap[dayInt] ?? null}
                  {@const emoji = dayEmojiMap[dayInt] ?? null}
                  {#if calendarMode === "colors"}
                    <button
                      type="button"
                      class={cn(
                        "size-6 rounded-[3px] transition-colors",
                        isFuture && "opacity-20",
                        filled && color && !isFuture
                          ? ""
                          : "bg-muted-foreground/10",
                      )}
                      style={filled && color && !isFuture
                        ? `background-color: ${color};`
                        : ""}
                      disabled={isFuture}
                      onclick={() => {
                        if (!isFuture) goto(`/day/${dayInt}`);
                      }}
                    ></button>
                  {:else}
                    <!-- Emojis mode -->
                    <button
                      type="button"
                      class={cn(
                        "flex size-6 items-center justify-center rounded-[3px] transition-colors",
                        isFuture && "opacity-20",
                        filled && emoji ? "" : "bg-muted-foreground/10",
                      )}
                      disabled={isFuture}
                      onclick={() => {
                        if (!isFuture) goto(`/day/${dayInt}`);
                      }}
                    >
                      {#if emoji && !isFuture}
                        <span class="text-lg leading-none">{emoji}</span>
                      {/if}
                    </button>
                  {/if}
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- ==================== MONTH VIEW ==================== -->
    {:else if calendarMode === "graph"}
      {@const totalDays = daysInMonth(graphMonth, year)}
      {@const points = getMonthRatings(graphMonth)}
      {@const segments = buildSegments(points, totalDays)}
      {@const yTicks = [0, 2, 4, 6, 8, 10]}
      <div class="flex w-full flex-col items-center gap-1">
        <!-- Month navigation -->
        <div class="flex items-center gap-4">
          <button
            type="button"
            class="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
            disabled={graphMonth <= 1}
            onclick={() => (graphMonth = Math.max(1, graphMonth - 1))}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg
            >
          </button>
          <span class="min-w-[130px] text-center text-sm font-medium">
            {MONTH_NAMES[graphMonth - 1]}
            {year}
          </span>
          <button
            type="button"
            class="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
            disabled={graphMonth >= 12}
            onclick={() => (graphMonth = Math.min(12, graphMonth + 1))}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg
            >
          </button>
        </div>

        <!-- SVG Chart -->
        <svg
          viewBox="0 0 {chartW} {chartH}"
          class="w-full max-w-[400px]"
          preserveAspectRatio="xMidYMid meet"
        >
          {#each yTicks as tick}
            <line
              x1={padL}
              y1={yPos(tick)}
              x2={chartW - padR}
              y2={yPos(tick)}
              stroke="currentColor"
              stroke-opacity="0.1"
              stroke-width="0.5"
            />
            <text
              x={padL - 6}
              y={yPos(tick) + 3.5}
              text-anchor="end"
              fill="currentColor"
              fill-opacity="0.4"
              font-size="9">{tick}</text
            >
          {/each}

          {#each Array.from({ length: totalDays }, (_, i) => i + 1) as d}
            {#if d === 1 || d % 5 === 0 || d === totalDays}
              <text
                x={xPos(d, totalDays)}
                y={chartH - 6}
                text-anchor="middle"
                fill="currentColor"
                fill-opacity="0.4"
                font-size="9">{d}</text
              >
            {/if}
          {/each}

          {#each segments as seg}
            <path
              d={seg}
              fill="none"
              stroke="#22c55e"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          {/each}

          {#each points as pt}
            <circle
              cx={xPos(pt.day, totalDays)}
              cy={yPos(pt.rating)}
              r="3"
              fill="#22c55e"
            />
            <title>{MONTH_NAMES[graphMonth - 1]} {pt.day}: {pt.rating}</title>
          {/each}

          <line
            x1={padL}
            y1={yPos(0)}
            x2={chartW - padR}
            y2={yPos(0)}
            stroke="currentColor"
            stroke-opacity="0.2"
            stroke-width="0.5"
            stroke-dasharray="4 2"
          />

          {#if points.length === 0}
            <text
              x={chartW / 2}
              y={chartH / 2}
              text-anchor="middle"
              fill="currentColor"
              fill-opacity="0.3"
              font-size="12">No ratings this month</text
            >
          {/if}
        </svg>
      </div>
    {:else}
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
          {@const emoji = getDayEmoji(date)}
          {@const color = getDayColor(date)}
          {@const filled = isDayFilled(date)}
          {@const isToday = date.compare(todayCal) === 0}
          {@const isFuture = date.compare(todayCal) > 0}
          {#if calendarMode === "colors"}
            <button
              type="button"
              class={cn(
                buttonVariants({ variant: "ghost" }),
                "flex size-(--cell-size) flex-col items-center justify-center gap-0 p-0 leading-none font-normal whitespace-nowrap select-none relative rounded-md",
                isToday && !filled && "bg-accent text-accent-foreground",
                isToday &&
                  filled &&
                  "ring-2 ring-white/60 ring-offset-1 ring-offset-background",
                outsideMonth && "text-muted-foreground opacity-50",
                isFuture &&
                  "text-muted-foreground pointer-events-none opacity-50",
                filled && !color && "bg-muted",
              )}
              style={filled && color && !isFuture && !outsideMonth
                ? `background-color: ${color};`
                : ""}
              disabled={isFuture || outsideMonth}
              onclick={() => handleDayClick(date)}
            >
              {#if !filled || isFuture}
                <span>{date.day}</span>
              {/if}
            </button>
          {:else}
            <button
              type="button"
              class={cn(
                buttonVariants({ variant: "ghost" }),
                "flex size-(--cell-size) flex-col items-center justify-center gap-0 p-0 leading-none font-normal whitespace-nowrap select-none relative",
                isToday && !filled && "bg-accent text-accent-foreground",
                isToday &&
                  filled &&
                  "ring-2 ring-primary ring-offset-1 ring-offset-background rounded-md",
                filled && !emoji && "text-green-400 font-semibold",
                outsideMonth && "text-muted-foreground opacity-50",
                isFuture &&
                  "text-muted-foreground pointer-events-none opacity-50",
              )}
              disabled={isFuture || outsideMonth}
              onclick={() => handleDayClick(date)}
            >
              {#if emoji}
                <span class="text-lg leading-none">{emoji}</span>
              {:else}
                <span>{date.day}</span>
              {/if}
            </button>
          {/if}
        {/snippet}
      </Calendar>
    {/if}
  </Card.Content>
</Card.Root>

{#if data.publicNotes && data.publicNotes.length > 0}
  <div class="flex flex-wrap w-full gap-2">
    {#each data.publicNotes as { author, note }}
      <div class="flex flex-col gap-1 rounded-md bg-accent/50 px-3 py-2">
        <span class="text-xs text-muted-foreground">{author}</span>
        <span class="text-sm text-foreground">{note}</span>
      </div>
    {/each}
  </div>
{/if}

{#if data.todayDrawings && data.todayDrawings.length > 0}
  <div
    class="flex w-full max-w-[90%] flex-wrap items-center justify-center gap-2"
  >
    {#each data.todayDrawings as { drawing }}
      <div
        class="flex max-w-[150px] items-center justify-center sm:max-w-[300px]"
      >
        <img src={drawing} alt="" width="300" height="180" class="rounded-md" />
      </div>
    {/each}
  </div>
{/if}
