<script lang="ts">
  type Props = {
    value: number;
    disabled?: boolean;
    label: string;
    onChange: (value: number) => void;
    class?: string;
  };

  const { value, disabled = false, label, onChange, class: className = "" }: Props = $props();
</script>

<input
  type="range"
  min="0"
  max="100"
  step="1"
  {value}
  {disabled}
  aria-label={label}
  class="tile-volume-slider h-1.5 w-16 shrink-0 cursor-pointer appearance-none rounded-full bg-white/25 accent-participant-orange disabled:cursor-not-allowed disabled:opacity-50 sm:w-20 {className}"
  onpointerdown={(event) => event.stopPropagation()}
  oninput={(event) => onChange(Number((event.currentTarget as HTMLInputElement).value))}
/>
