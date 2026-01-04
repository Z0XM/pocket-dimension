<script lang="ts">

import type { PageProps } from './$types';

let { data }: PageProps = $props();

$effect(() => {
  console.log("Page data", data);
})
</script>

<div class="">

</div>
