import type { ColumnDef } from "@tanstack/table-core";
import { createRawSnippet } from "svelte";
import { renderComponent, renderSnippet } from "$lib/components/ui/data-table/index.js";
import EditableRatingCell from "./data-table-helpers/editable-rating-cell.svelte";
import EditableSelectCell from "./data-table-helpers/editable-select-cell.svelte";
import EditableTagsCell from "./data-table-helpers/editable-tags-cell.svelte";
import EditableTextCell from "./data-table-helpers/editable-text-cell.svelte";
import RowActionsCell from "./data-table-helpers/row-actions-cell.svelte";
import SelectRowCell from "./data-table-helpers/select-row-cell.svelte";

export type WatchProgressStatus = "watch_later" | "watching" | "watched" | "dropped";

export type Watchlist = {
  id: string;
  order: number;
  title: string;
  releaseStatus: string;
  seasons: number | null;
  type: string;
  language_id: string;
  language: string;
  tags: string;
  avg_rating: string;
  infinity_counts: string;
  shitty_counts: string;
  my_rating: string | null;
  my_infinity: boolean | null;
  my_shitty: boolean | null;
  my_progress_status: WatchProgressStatus | null;
  // Dynamic user rating fields - indexed by username
  [key: `user_${string}_rating`]: string | null | undefined;
  [key: `user_${string}_infinity`]: boolean | null | undefined;
  [key: `user_${string}_shitty`]: boolean | null | undefined;
};

// Column definitions with editable cells
export const columns: ColumnDef<Watchlist>[] = [
  // Selection column (first, only visible in edit mode)
  {
    id: "select",
    header: ({ table }) => {
      const allRowIds = table.getRowModel().rows.map((row) => row.original.id);
      return renderComponent(SelectRowCell, {
        rowId: "",
        rowIndex: -1,
        allRowIds,
        isHeader: true,
      });
    },
    cell: ({ row, table }) => {
      const allRowIds = table.getRowModel().rows.map((r) => r.original.id);
      const rowIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id);
      return renderComponent(SelectRowCell, {
        rowId: row.original.id,
        rowIndex,
        allRowIds,
        isHeader: false,
      });
    },
    enableSorting: false,
    enableHiding: false,
    size: 40,
  },
  {
    accessorKey: "order",
    header: "Order",
    enableSorting: true,
    cell: ({ row }) => {
      // Don't show order for new rows (temp IDs)
      if (row.original.id.startsWith("temp-")) {
        return renderSnippet(createRawSnippet(() => ({ render: () => `<span class="text-muted-foreground">-</span>` })));
      }
      return row.original.order;
    },
  },
  {
    accessorKey: "title",
    header: "Title",
    enableSorting: true,
    cell: ({ row }) => {
      return renderComponent(EditableTextCell, {
        rowId: row.original.id,
        field: "title",
        value: row.original.title,
        placeholder: "Enter title...",
        required: true,
        class: "max-w-[180px] md:max-w-[400px] truncate",
      });
    },
  },
  {
    accessorKey: "tags",
    header: "Tags",
    enableSorting: false,
    cell: ({ row }) => {
      return renderComponent(EditableTagsCell, {
        rowId: row.original.id,
        tags: row.original.tags,
      });
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    enableSorting: true,
    cell: ({ row }) => {
      return renderComponent(EditableSelectCell, {
        rowId: row.original.id,
        field: "type",
        value: row.original.type,
        displayValue: row.original.type,
        options: [], // Will be populated from context
        placeholder: "Select...",
        required: true,
        filterType: "type",
        class: "flex justify-start items-center",
      });
    },
  },
  {
    accessorKey: "language",
    header: "Language",
    enableSorting: true,
    cell: ({ row }) => {
      // Note: Options are injected via context from data-table.svelte
      return renderComponent(EditableSelectCell, {
        rowId: row.original.id,
        field: "languageId",
        value: row.original.language,
        displayValue: row.original.language,
        options: [], // Will be populated from context
        placeholder: "Select...",
        required: true,
        filterType: "language",
        class: "flex justify-start items-center",
      });
    },
  },
  {
    accessorKey: "my_progress_status",
    header: "Progress",
    enableSorting: true,
    cell: ({ row }) => {
      return renderComponent(EditableSelectCell, {
        rowId: row.original.id,
        field: "my_progress_status",
        value: row.original.my_progress_status,
        displayValue: row.original.my_progress_status,
        options: [
          { value: "watch_later", label: "Watch Later" },
          { value: "watching", label: "Watching" },
          { value: "watched", label: "Watched" },
          { value: "dropped", label: "Dropped" },
        ],
        placeholder: "Select...",
        required: false,
        filterType: "progress",
        class: "flex justify-start items-center",
      });
    },
  },
  {
    id: "my_rating",
    accessorKey: "my_rating",
    header: () => {
      const myRatingHeaderSnippet = createRawSnippet(() => ({
        render: () => `<div>My Rating</div>`,
      }));
      return renderSnippet(myRatingHeaderSnippet);
    },
    meta: {
      displayName: "My Rating",
    },
    enableSorting: true,
    enableHiding: true,
    cell: ({ row }) => {
      return renderComponent(EditableRatingCell, {
        rowId: row.original.id,
        rating: row.original.my_rating,
        infinity: row.original.my_infinity,
        shitty: row.original.my_shitty,
        progressStatus: row.original.my_progress_status,
      });
    },
  },
  {
    id: "avg_rating",
    accessorKey: "avg_rating",
    header: () => {
      const avgRatingHeaderSnippet = createRawSnippet(() => ({
        render: () => `<div>Avg Rating</div>`,
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

        // Helper function to get color style based on rating
        const getRatingColor = (rating: string): string => {
          if (!rating) return "";
          const num = parseFloat(rating);
          if (Number.isNaN(num)) return "";

          // Map rating ranges to hex colors
          if (num >= 10) return "color: #61ED51;";
          if (num >= 9) return "color: #80EC51;";
          if (num >= 8) return "color: #9EEA4E;";
          if (num >= 7) return "color: #BAE84C;";
          if (num >= 6) return "color: #DAE54A;";
          if (num >= 5) return "color: #E2CC45;";
          if (num >= 4) return "color: #DCA93D;";
          if (num >= 3) return "color: #D58235;";
          if (num >= 2) return "color: #CE5A2C;";
          if (num >= 1) return "color: #C73024;";
          return "color: #880A00;";
        };

        const colorStyle = getRatingColor(avg_rating);

        if (Number(infinity_counts) > 0) {
          return {
            render: () => `<div class="text-end text-lg font-medium">♾️<sup class="text-[0.620rem]">${infinity_counts}</sup></div>`,
          };
        }
        if (Number(shitty_counts) > 0) {
          return {
            render: () => `<div class="text-end text-lg font-medium">💩<sup class="text-[0.620rem]">${shitty_counts}</sup></div>`,
          };
        }
        return {
          render: () => `<div class="text-end font-medium" style="${colorStyle}">${formatted}</div>`,
        };
      });

      return renderSnippet(avgRatingCellSnippet, {
        avg_rating: row.original.avg_rating,
        infinity_counts: row.original.infinity_counts,
        shitty_counts: row.original.shitty_counts,
      });
    },
  },
  // Row actions column (last, only visible in edit mode)
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      return renderComponent(RowActionsCell, {
        rowId: row.original.id,
        isNewRow: row.original.id.startsWith("temp-"),
      });
    },
    enableSorting: false,
    enableHiding: false,
    size: 50,
  },
];

// Function to create dynamic user rating columns
export function createUserRatingColumns(usernames: string[]): ColumnDef<Watchlist>[] {
  return usernames.map((username) => {
    const safeUsername = username.replace(/[^a-zA-Z0-9_]/g, "_");
    const columnId = `user_${safeUsername}_rating`;

    return {
      id: columnId,
      accessorKey: columnId as keyof Watchlist,
      header: () => {
        const headerSnippet = createRawSnippet(() => ({
          render: () => `<div>${username}</div>`,
        }));
        return renderSnippet(headerSnippet);
      },
      meta: {
        displayName: username,
      },
      enableSorting: true,
      enableHiding: true,
      cell: ({ row }) => {
        const ratingKey = `user_${safeUsername}_rating` as keyof Watchlist;
        const infinityKey = `user_${safeUsername}_infinity` as keyof Watchlist;
        const shittyKey = `user_${safeUsername}_shitty` as keyof Watchlist;

        const rating = row.original[ratingKey] as string | null | undefined;
        const infinity = row.original[infinityKey] as boolean | null | undefined;
        const shitty = row.original[shittyKey] as boolean | null | undefined;

        const cellSnippet = createRawSnippet<
          [{ rating: string | null | undefined; infinity: boolean | null | undefined; shitty: boolean | null | undefined }]
        >((getData) => {
          const { rating, infinity, shitty } = getData();
          const formatted = rating ? parseFloat(rating).toFixed(2) : "";

          // Helper function to get color style based on rating
          const getRatingColor = (rating: string): string => {
            if (!rating) return "";
            const num = parseFloat(rating);
            if (Number.isNaN(num)) return "";

            // Map rating ranges to hex colors
            if (num >= 10) return "color: #61ED51;";
            if (num >= 9) return "color: #80EC51;";
            if (num >= 8) return "color: #9EEA4E;";
            if (num >= 7) return "color: #BAE84C;";
            if (num >= 6) return "color: #DAE54A;";
            if (num >= 5) return "color: #E2CC45;";
            if (num >= 4) return "color: #DCA93D;";
            if (num >= 3) return "color: #D58235;";
            if (num >= 2) return "color: #CE5A2C;";
            if (num >= 1) return "color: #C73024;";
            return "color: #880A00;";
          };

          const colorStyle = getRatingColor(rating ?? "");

          if (infinity) {
            return {
              render: () => `<div class="text-end text-lg font-medium">♾️</div>`,
            };
          }
          if (shitty) {
            return {
              render: () => `<div class="text-end text-lg font-medium">💩</div>`,
            };
          }
          return {
            render: () => `<div class="text-end font-medium" style="${colorStyle}">${formatted}</div>`,
          };
        });

        return renderSnippet(cellSnippet, {
          rating,
          infinity,
          shitty,
        });
      },
    };
  });
}
