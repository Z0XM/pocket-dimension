export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) {
    return false;
  }

  const element = target.closest("input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='textbox'], [data-search-input]");

  return element !== null;
}

export type SearchKeyboardHandlers = {
  open: () => void;
  toggle?: () => void;
  isOpen: () => boolean;
};

/** Single owner of ⌘K / Ctrl+K and `/`. Returns destroy(). */
export function bindSearchHotkeys(handlers: SearchKeyboardHandlers): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    const isModK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
    if (isModK) {
      event.preventDefault();
      if (handlers.isOpen() && handlers.toggle) {
        handlers.toggle();
      } else {
        handlers.open();
      }
      return;
    }

    if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (handlers.isOpen()) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      handlers.open();
    }
  };

  window.addEventListener("keydown", onKeyDown);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
  };
}
