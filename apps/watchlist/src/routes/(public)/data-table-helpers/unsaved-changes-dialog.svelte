<script lang="ts">
  import { AlertTriangleIcon } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";

  interface Props {
    open: boolean;
    onSaveAndContinue: () => void;
    onDiscardAndContinue: () => void;
    onCancel: () => void;
  }

  let { open = $bindable(), onSaveAndContinue, onDiscardAndContinue, onCancel }: Props = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2 text-amber-600">
        <AlertTriangleIcon class="size-5" />
        Unsaved Changes
      </Dialog.Title>
      <Dialog.Description>You have unsaved changes. What would you like to do?</Dialog.Description>
    </Dialog.Header>

    <div class="py-4">
      <p class="text-sm text-muted-foreground">You can save your changes and continue, discard them and continue, or stay here to keep editing.</p>
    </div>

    <Dialog.Footer class="flex flex-col sm:flex-row gap-2">
      <Button variant="outline" onclick={onCancel} class="sm:order-1">Stay Here</Button>
      <Button variant="destructive" onclick={onDiscardAndContinue} class="sm:order-2">Discard & Continue</Button>
      <Button variant="default" onclick={onSaveAndContinue} class="sm:order-3">Save & Continue</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
