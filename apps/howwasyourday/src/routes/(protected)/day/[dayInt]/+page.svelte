<script lang="ts">
  import { enhance } from "$app/forms";
  import ColorPicker from "$lib/components/ColorPicker.svelte";
  import DrawingCanvas from "$lib/components/DrawingCanvas.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Slider } from "$lib/components/ui/slider";
  import { Textarea } from "$lib/components/ui/textarea";
  import { listOfEmojis } from "$lib/emojis";
  import { fromDayInt } from "$lib/utils";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const meta = data.metadata as Record<string, unknown> | null;

  // Initial values from loaded data (or defaults)
  const initialValues = {
    dayRating: (meta?.dayRating as number) ?? undefined,
    dayEmoji: (meta?.dayEmoji as string) || undefined,
    dayWord: (meta?.dayWord as string) || undefined,
    dayColor: (meta?.dayColor as string) || undefined,
    dayPerson: (meta?.dayPerson as string) || undefined,
    dayNote: (meta?.dayNote as string) || undefined,
    dayPublicNote: (meta?.dayPublicNote as string) || undefined,
    dayDrawing: (meta?.dayDrawing as string) || undefined,
  };

  let emojiPickerOpen = $state(false);

  let dayRatingSet = $state(initialValues.dayRating != null);
  let dayRating = $state(initialValues.dayRating ?? 5);
  let dayEmoji = $state(initialValues.dayEmoji);
  let dayWord = $state(initialValues.dayWord);
  let dayColor = $state(initialValues.dayColor);
  let dayPerson = $state(initialValues.dayPerson);
  let dayNote = $state(initialValues.dayNote);
  let dayPublicNote = $state(initialValues.dayPublicNote);
  let dayDrawing = $state(initialValues.dayDrawing);

  function resetForm() {
    dayRatingSet = initialValues.dayRating != null;
    dayRating = initialValues.dayRating ?? 5;
    dayEmoji = initialValues.dayEmoji;
    dayWord = initialValues.dayWord;
    dayColor = initialValues.dayColor;
    dayPerson = initialValues.dayPerson;
    dayNote = initialValues.dayNote;
    dayPublicNote = initialValues.dayPublicNote;
    dayDrawing = initialValues.dayDrawing;
  }

  // Pre-build the static HTML string once since the list never changes
  const emojiGridHTML = listOfEmojis
    .map(
      (e) =>
        `<span role="button" tabindex="0" data-emoji="${e}" class="cursor-pointer rounded-md p-1 text-3xl hover:bg-accent active:scale-95 inline-block">${e}</span>`,
    )
    .join("");

  function handleEmojiClick(event: MouseEvent) {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-emoji]",
    );
    if (target?.dataset.emoji) {
      dayEmoji = target.dataset.emoji;
      emojiPickerOpen = false;
    }
  }

  const editDate = fromDayInt(data.dayInt);
  const dateLabel = editDate.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const isEditing = meta !== null;
</script>

<Card.Root class="">
  <Card.Content class="px-6">
    <div class="text-lg text-muted-foreground">
      {isEditing ? "Editing" : "Fill in"}{" "}
      <span class="font-semibold text-white">{dateLabel}</span>
    </div>
  </Card.Content>
</Card.Root>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  method="POST"
  use:enhance
  onkeydown={(e) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  }}
>
  <input type="hidden" name="dayRating" value={dayRatingSet ? dayRating : ""} />
  <input type="hidden" name="dayEmoji" value={dayEmoji ?? ""} />
  <input type="hidden" name="dayWord" value={dayWord ?? ""} />
  <input type="hidden" name="dayColor" value={dayColor ?? ""} />
  <input type="hidden" name="dayPerson" value={dayPerson ?? ""} />
  <input type="hidden" name="dayNote" value={dayNote ?? ""} />
  <input type="hidden" name="dayPublicNote" value={dayPublicNote ?? ""} />
  <input type="hidden" name="dayDrawing" value={dayDrawing ?? ""} />

  <div class="grid w-full grid-cols-8 flex-col gap-x-4 gap-y-4">
    <Card.Root class="col-span-6">
      <Card.Header class="pb-0">
        <Card.Title>
          <div class="text-md">Rate your day out of 10.</div>
        </Card.Title>
      </Card.Header>
      <Card.Content class="">
        <div class="flex w-full flex-col gap-2">
          <div class="flex w-full gap-2">
            <Slider
              type="single"
              class="text-md cursor-pointer"
              max={11}
              min={-1}
              step={0.5}
              bind:value={dayRating}
              onValueChange={() => (dayRatingSet = true)}
            />
            <div class="min-w-8 text-end">{dayRating}</div>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
    <Card.Root class="col-span-2 flex items-center justify-center">
      <Card.Content class="p-0">
        <Dialog.Root bind:open={emojiPickerOpen}>
          <Dialog.Trigger type="button">
            <div
              class="flex animate-bounce cursor-pointer items-center justify-center text-3xl"
            >
              {dayEmoji || "❓"}
            </div>
          </Dialog.Trigger>
          <Dialog.Content class="flex flex-col items-center justify-center">
            <Dialog.Header>
              <Dialog.Title class="pb-2 text-2xl"
                >Emote your day! {dayEmoji || "❓"}</Dialog.Title
              >
              <Dialog.Description>
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                <div
                  class="flex flex-wrap gap-1"
                  role="toolbar"
                  tabindex="-1"
                  aria-label="Emoji picker"
                  onclick={handleEmojiClick}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      handleEmojiClick(e as unknown as MouseEvent);
                  }}
                >
                  {@html emojiGridHTML}
                </div>
              </Dialog.Description>
            </Dialog.Header>
            <Dialog.Footer class="sm:justify-start">
              <Dialog.Close type="button">
                <Button type="button" variant="secondary">Done!</Button>
              </Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      </Card.Content>
    </Card.Root>
    <Card.Root class="col-span-8">
      <Card.Content class="">
        <div class="flex w-full flex-col gap-2">
          <Input
            class="text-md"
            bind:value={dayWord}
            type="text"
            maxlength={64}
            placeholder="Describe today in short."
          />
        </div>
      </Card.Content>
    </Card.Root>
    <Card.Root class="col-span-2 flex items-center justify-center">
      <Card.Content class="p-0">
        <Dialog.Root>
          <Dialog.Trigger
            type="button"
            class="flex items-center justify-center cursor-pointer"
          >
            <div
              style={`background-color: ${dayColor ?? "#d3d3d3"}`}
              class="h-[35px] w-[35px] rounded-full"
            ></div>
          </Dialog.Trigger>
          <Dialog.Content class="flex flex-col items-center justify-center">
            <Dialog.Header>
              <Dialog.Title class="pb-2 text-2xl">Color your day!</Dialog.Title>
            </Dialog.Header>
            <ColorPicker bind:color={dayColor} />
            <Dialog.Footer class="sm:justify-start">
              <Dialog.Close type="button">
                <Button type="button" variant="secondary">Done!</Button>
              </Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      </Card.Content>
    </Card.Root>
    <Card.Root class="col-span-6">
      <Card.Content class="">
        <div class="flex w-full flex-col gap-2">
          <Input
            class="text-md"
            bind:value={dayPerson}
            type="text"
            maxlength={64}
            placeholder="A person to remember."
          />
        </div>
      </Card.Content>
    </Card.Root>
    <div class="col-span-8 flex w-full flex-col gap-2">
      <Textarea
        class="text-md px-2 py-1"
        bind:value={dayNote}
        placeholder="Write a note about today."
      />
    </div>
    <div class="col-span-8 flex w-full flex-col gap-2">
      <Input
        class="text-md px-2 py-1"
        bind:value={dayPublicNote}
        placeholder="Write a public note."
        type="text"
        maxlength={120}
      />
    </div>
    <DrawingCanvas
      bind:currentDrawing={dayDrawing}
      initialDrawing={initialValues.dayDrawing}
    />
    <div class="col-span-8 flex w-full gap-2">
      <Button
        type="button"
        variant="secondary"
        class="text-md flex-1  rounded p-2"
        onclick={resetForm}
      >
        Cancel
      </Button>
      <Button type="submit" class="text-md flex-1  rounded p-2">Submit</Button>
    </div>
  </div>
</form>
