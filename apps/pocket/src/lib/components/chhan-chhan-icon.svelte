<script lang="ts">
  import icon from "$lib/assets/chhan-chhan-icon.png";

  const { class: className = "" }: { class?: string } = $props();
</script>

<img src={icon} alt="" class={className} />
