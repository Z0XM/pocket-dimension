import type { Action } from "svelte/action";

type InfiniteScrollParams = {
  onLoad: () => void;
  disabled?: boolean;
};

export const infiniteScroll: Action<HTMLElement, InfiniteScrollParams> = (node, params) => {
  let current = params;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !current.disabled) {
          current.onLoad();
        }
      }
    },
    { rootMargin: "200px" }
  );

  observer.observe(node);

  return {
    update(next: InfiniteScrollParams) {
      current = next;
    },
    destroy() {
      observer.disconnect();
    },
  };
};
