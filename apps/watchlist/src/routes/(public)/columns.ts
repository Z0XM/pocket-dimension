import type { schema } from "@pocket-dimension/db";
import type { ColumnDef } from "@tanstack/table-core";
import { createRawSnippet } from "svelte";
import { renderSnippet } from "$lib/components/ui/data-table/index.js";

export type Watchlist = {
  id: string;
  order: number;
  title: string;
  releaseStatus: string;
  seasons: number | null;
  type: string;
  language: string;
  tags: string;
  avg_rating: string;
  infinity_counts: string;
  shitty_counts: string;
  my_rating: string | null;
  my_infinity: boolean | null;
  my_shitty: boolean | null;
  my_progress_status: (typeof schema.watchProgressStatus.enumValues)[number] | null;
};

export const columns: ColumnDef<Watchlist>[] = [
  {
    accessorKey: "order",
    header: "Order",
    enableSorting: true,
  },
  {
    accessorKey: "title",
    header: "Title",
    enableSorting: true,
  },
  {
    accessorKey: "tags",
    header: "Tags",
    enableSorting: false,
    cell: ({ row }) => {
      const tagsCellSnippet = createRawSnippet<[{ tags: string }]>((getTags) => {
        const { tags } = getTags();
        return {
          render: () => `<div class="capitalize">${tags}</div>`,
        };
      });
      return renderSnippet(tagsCellSnippet, { tags: row.original.tags });
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    enableSorting: true,
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
    enableSorting: true,
  },
  {
    accessorKey: "my_progress_status",
    header: "Progress",
    enableSorting: true,
    cell: ({ row }) => {
      const progressStatusCellSnippet = createRawSnippet<[{ my_progress_status: string | null }]>((getProgressStatus) => {
        const { my_progress_status } = getProgressStatus();
        return {
          render: () => `<div class="capitalize">${my_progress_status ?? ""}</div>`,
        };
      });
      return renderSnippet(progressStatusCellSnippet, { my_progress_status: row.original.my_progress_status });
    },
  },
  {
    id: "my_rating",
    accessorKey: "my_rating",
    header: () => {
      const myRatingHeaderSnippet = createRawSnippet(() => ({
        render: () => `<div class="text-end">My Rating</div>`,
      }));
      return renderSnippet(myRatingHeaderSnippet);
    },
    meta: {
      displayName: "My Rating",
    },
    enableSorting: true,
    enableHiding: true,
    cell: ({ row }) => {
      const myRatingCellSnippet = createRawSnippet<[{ my_rating: string | null; my_infinity: boolean | null; my_shitty: boolean | null }]>(
        (getMyRating) => {
          const { my_rating, my_infinity, my_shitty } = getMyRating();

          if (my_infinity) {
            return {
              render: () => `<div class="text-end font-medium">♾️</div>`,
            };
          }
          if (my_shitty) {
            return {
              render: () => `<div class="text-end font-medium">💩</div>`,
            };
          }

          const formatted = my_rating ? parseFloat(my_rating).toFixed(1) : "";
          return {
            render: () => `<div class="text-end font-medium">${formatted}</div>`,
          };
        }
      );

      return renderSnippet(myRatingCellSnippet, {
        my_rating: row.original.my_rating,
        my_infinity: row.original.my_infinity,
        my_shitty: row.original.my_shitty,
      });
    },
  },
  {
    id: "avg_rating",
    accessorKey: "avg_rating",
    header: () => {
      const avgRatingHeaderSnippet = createRawSnippet(() => ({
        render: () => `<div class="text-end">Avg Rating</div>`,
      }));
      return renderSnippet(avgRatingHeaderSnippet);
    },
    meta: {
      displayName: "Avg Rating",
    },
    enableSorting: true,
    enableHiding: true,
    cell: ({ row }) => {
      const avgRatingCellSnippet = createRawSnippet<[{ avg_rating: string; infinity_counts: string; shitty_counts: string }]>((getAvgRating) => {
        const { avg_rating, infinity_counts, shitty_counts } = getAvgRating();
        const formatted = avg_rating ? parseFloat(avg_rating).toFixed(2) : "";
        if (Number(infinity_counts) > 0) {
          return {
            render: () => `<div class="text-end font-medium">♾️<sup>${infinity_counts}</sup></div>`,
          };
        }
        if (Number(shitty_counts) > 0) {
          return {
            render: () => `<div class="text-end font-medium">💩<sup>${shitty_counts}</sup></div>`,
          };
        }
        return {
          render: () => `<div class="text-end font-medium">${formatted}</div>`,
        };
      });

      return renderSnippet(avgRatingCellSnippet, {
        avg_rating: row.original.avg_rating,
        infinity_counts: row.original.infinity_counts,
        shitty_counts: row.original.shitty_counts,
      });
    },
  },
];
