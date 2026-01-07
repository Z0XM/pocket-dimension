import type { ColumnDef } from "@tanstack/table-core";
import { createRawSnippet } from "svelte";
import { renderComponent, renderSnippet } from "$lib/components/ui/data-table/index.js";

export type Watchlist = {
  id: string;
  title: string;
  releaseStatus: string;
  seasons: number | null;
  type: string;
  language: string;
  tags: string[];
  avgRating: string;
  infinityCounts: string;
  shittyCounts: string;
  myRating: string | null;
  myInfinity: boolean | null;
  myShitty: boolean | null;
  myWatchProgress: string | null;
  myDroppedAtSeason: number | null;
  myDroppedAtEpisode: number | null;
  // myReview: string | null;
  // myRecommendation: string | null;
};

export const columns: ColumnDef<Watchlist>[] = [
  {
    id: "index",
    header: "Index",
    cell: ({ row }) => {
      const index = row.index + 1;

      const indexCellSnippet = createRawSnippet<[{ index: number }]>((getIndex) => {
        const { index } = getIndex();
        return {
          render: () => `<div>${index}</div>`,
        };
      });

      return renderSnippet(indexCellSnippet, { index });
    },
  },
  {
    accessorKey: "title",
    header: "Title",
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const tagsCellSnippet = createRawSnippet<[{ tags: string[] }]>((getTags) => {
        const { tags } = getTags();
        return {
          render: () => `<div class="capitalize">${tags.join(", ")}</div>`,
        };
      });
      return renderSnippet(tagsCellSnippet, { tags: row.original.tags });
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const typeCellSnippet = createRawSnippet<[{ type: string }]>((getType) => {
        const { type } = getType();
        return {
          render: () => `<div class="capitalize">${type}</div>`,
        };
      });
      return renderSnippet(typeCellSnippet, { type: row.original.type });
    },
  },
  {
    accessorKey: "language",
    header: "Language",
  },
  {
    accessorKey: "myRating",
    header: () => {
      const myRatingHeaderSnippet = createRawSnippet(() => ({
        render: () => `<div class="text-end">My Rating</div>`,
      }));
      return renderSnippet(myRatingHeaderSnippet);
    },
    cell: ({ row }) => {
      const myRatingCellSnippet = createRawSnippet<
        [{ myRating: string | null; myInfinity: boolean | null; myShitty: boolean | null }]
      >((getMyRating) => {
        const { myRating, myInfinity, myShitty } = getMyRating();

        if (myInfinity) {
          return {
            render: () => `<div class="text-end font-medium">♾️</div>`,
          };
        }
        if (myShitty) {
          return {
            render: () => `<div class="text-end font-medium">💩</div>`,
          };
        }

        const formatted = myRating ? parseFloat(myRating).toFixed(1) : "";
        return {
          render: () => `<div class="text-end font-medium">${formatted}</div>`,
        };
      });

      return renderSnippet(myRatingCellSnippet, {
        myRating: row.original.myRating,
        myInfinity: row.original.myInfinity,
        myShitty: row.original.myShitty,
      });
    },
  },
  {
    accessorKey: "avgRating",
    header: () => {
      const avgRatingHeaderSnippet = createRawSnippet(() => ({
        render: () => `<div class="text-end">Avg Rating</div>`,
      }));
      return renderSnippet(avgRatingHeaderSnippet);
    },
    cell: ({ row }) => {
      const avgRatingCellSnippet = createRawSnippet<
        [{ avgRating: string; infinityCounts: string; shittyCounts: string }]
      >((getAvgRating) => {
        const { avgRating, infinityCounts, shittyCounts } = getAvgRating();
        const formatted = avgRating ? parseFloat(avgRating).toFixed(2) : "";
        if (Number(infinityCounts) > 0) {
          return {
            render: () => `<div class="text-end font-medium">♾️<sup>${infinityCounts}</sup></div>`,
          };
        }
        if (Number(shittyCounts) > 0) {
          return {
            render: () => `<div class="text-end font-medium">💩<sup>${shittyCounts}</sup></div>`,
          };
        }
        return {
          render: () => `<div class="text-end font-medium">${formatted}</div>`,
        };
      });

      return renderSnippet(avgRatingCellSnippet, {
        avgRating: row.original.avgRating,
        infinityCounts: row.original.infinityCounts,
        shittyCounts: row.original.shittyCounts,
      });
    },
  },
];
