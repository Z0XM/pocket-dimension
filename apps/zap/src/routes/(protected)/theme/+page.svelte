<script lang="ts">
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ThemePrefsPanel from "$lib/components/ThemePrefsPanel.svelte";
</script>

<section class="zap-page">
  <PageHeader title="Theme" />
  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
    <ThemePrefsPanel />
  </div>
</section>
