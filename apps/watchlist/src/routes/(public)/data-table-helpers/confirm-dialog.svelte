<script lang="ts">
  import { TriangleAlert } from "@lucide/svelte";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";

  interface Props {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "destructive";
    onConfirm: () => void;
    onCancel: () => void;
  }

  let {
    open = $bindable(),
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "destructive",
    onConfirm,
    onCancel,
  }: Props = $props();
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Portal>
    <AlertDialog.Overlay />
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title class="flex items-center gap-2 text-amber-600">
          <TriangleAlert class="size-5" />
          {title}
        </AlertDialog.Title>
        <AlertDialog.Description>
          {description}
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel class="dark:hover:bg-white/70 dark:bg-gray-200 text-black hover:text-black" onclick={onCancel}>
          {cancelLabel}
        </AlertDialog.Cancel>
        <AlertDialog.Action onclick={onConfirm} class={variant === "destructive" ? "dark:bg-rose-500 dark:hover:bg-rose-800" : ""}>
          {confirmLabel}
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
