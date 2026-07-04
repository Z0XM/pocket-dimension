<script lang="ts">
  import { Label } from "$lib/components/ui/label";
  import { PARTICIPANT_COLOR_LABELS, PARTICIPANT_COLORS, type ParticipantColor } from "$lib/participant-colors";
  import { cn } from "$lib/utils.js";

  type Props = {
    value: ParticipantColor;
    onChange: (color: ParticipantColor) => void;
    class?: string;
    compact?: boolean;
  };

  let { value, onChange, class: className, compact = false }: Props = $props();
</script>

<div class={cn("space-y-2", className)}>
  {#if !compact}
    <Label>Tile color</Label>
  {/if}
  <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Tile color">
    {#each PARTICIPANT_COLORS as color (color)}
      <button
        type="button"
        role="radio"
        aria-checked={value === color}
        aria-label={PARTICIPANT_COLOR_LABELS[color]}
        class="rounded-full border-2 transition-all hover:scale-105 active:scale-95 {compact ? 'size-7' : 'size-8'} {value === color
          ? 'border-primary ring-2 ring-primary/35'
          : 'border-border/60 hover:border-border'}"
        style="background-color: {color}"
        onclick={() => onChange(color)}
      ></button>
    {/each}
  </div>
</div>
