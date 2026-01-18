import type { VisibilityState } from "@tanstack/table-core";

const STORAGE_KEY_OLD = "data-table-column-visibility";
const STORAGE_KEY = "data-table-column-settings";

export type ColumnSettings = {
  [columnId: string]: {
    order: number;
    visible: boolean;
  };
};

/**
 * Generates the default column order based on the user's requirements:
 * Order, Title, Tags, Type, Language, Progress, MyRating, AvgRating, UserXRating..
 */
export function getDefaultColumnOrder(availableColumns: string[]): string[] {
  // Define the preferred order (excluding order which is always first)
  const preferredOrder = [
    "title",
    "tags",
    "type",
    "language",
    "my_progress_status", // Progress
    "my_rating", // MyRating
    "avg_rating", // AvgRating
    // User rating columns will be inserted here (after avg_rating)
  ];

  // Separate columns into categories
  const orderCol = availableColumns.filter((id) => id === "order");
  const preferredCols: string[] = [];
  const userRatingCols: string[] = [];
  const otherCols: string[] = [];

  // Categorize columns
  availableColumns.forEach((id) => {
    if (id === "order") {
      // Already handled
    } else if (preferredOrder.includes(id)) {
      preferredCols.push(id);
    } else if (id.startsWith("user_") && id.endsWith("_rating")) {
      userRatingCols.push(id);
    } else {
      // Other columns like select, actions, etc.
      otherCols.push(id);
    }
  });

  // Sort preferred columns according to preferredOrder
  preferredCols.sort((a, b) => {
    const indexA = preferredOrder.indexOf(a);
    const indexB = preferredOrder.indexOf(b);
    return indexA - indexB;
  });

  // Sort user rating columns alphabetically
  userRatingCols.sort();

  // Find where to insert user rating columns (after avg_rating)
  const avgRatingIndex = preferredCols.indexOf("avg_rating");

  // Insert user rating columns after avg_rating
  if (avgRatingIndex !== -1) {
    // Insert after avg_rating
    preferredCols.splice(avgRatingIndex + 1, 0, ...userRatingCols);
  } else {
    // If avg_rating doesn't exist, append user ratings at the end of preferred columns
    preferredCols.push(...userRatingCols);
  }

  // Combine: order first, then preferred columns, then other columns
  // Filter out select and actions from other columns as they're handled separately
  const selectCol = otherCols.filter((id) => id === "select");
  const actionsCol = otherCols.filter((id) => id === "actions");
  const remainingOtherCols = otherCols.filter((id) => id !== "select" && id !== "actions");

  return [...orderCol, ...selectCol, ...preferredCols, ...remainingOtherCols, ...actionsCol];
}

function migrateOldVisibilityFormat(oldVisibility: VisibilityState, orderedDefaultOrder: string[]): ColumnSettings {
  const settings: ColumnSettings = {};
  let orderCounter = 0;

  // Handle select separately (order -1, comes before everything)
  if (orderedDefaultOrder.includes("select")) {
    settings["select"] = {
      order: -1,
      visible: oldVisibility["select"] !== false,
    };
  }

  // Filter out select and actions from the order calculation
  const columnsToOrder = orderedDefaultOrder.filter((id) => id !== "select" && id !== "actions");

  // Ensure order is first in the array
  const normalizedOrder = columnsToOrder[0] === "order" ? columnsToOrder : ["order", ...columnsToOrder.filter((id) => id !== "order")];

  // Create settings with default order, preserving visibility state
  normalizedOrder.forEach((columnId) => {
    // Order column is always visible and first with order 0
    if (columnId === "order") {
      settings[columnId] = {
        order: 0,
        visible: true,
      };
      return;
    }

    orderCounter++;
    settings[columnId] = {
      order: orderCounter,
      visible: oldVisibility[columnId] !== false, // Default to true unless explicitly false
    };
  });

  // Handle actions separately (comes last)
  if (orderedDefaultOrder.includes("actions")) {
    const maxOrder = Math.max(...Object.values(settings).map((s) => s.order), 0);
    settings["actions"] = {
      order: maxOrder + 1,
      visible: oldVisibility["actions"] !== false,
    };
  }

  return settings;
}

function loadColumnSettingsFromStorage(defaultOrder: string[]): ColumnSettings {
  if (typeof window === "undefined") {
    return {};
  }

  // Get the properly ordered default column order
  const orderedDefaultOrder = getDefaultColumnOrder(defaultOrder);

  // Try new format first
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Validate structure - check if it's a valid non-empty settings object
      if (typeof parsed === "object" && parsed !== null && Object.keys(parsed).length > 0) {
        const settings = parsed as ColumnSettings;
        // Check if settings have valid structure (at least one column with order/visible)
        const hasValidStructure = Object.values(settings).some((s) => typeof s === "object" && s !== null && typeof s.order === "number");

        if (!hasValidStructure) {
          // Settings exist but are invalid/empty, clear them and treat as no settings
          localStorage.removeItem(STORAGE_KEY);
          // Fall through to create defaults
        } else {
          // Valid settings exist - check if order is malformed (avg_rating before my_rating)
          // If so, regenerate with correct order
          const avgRatingOrder = settings["avg_rating"]?.order ?? Infinity;
          const myRatingOrder = settings["my_rating"]?.order ?? Infinity;
          const myProgressOrder = settings["my_progress_status"]?.order ?? Infinity;
          const hasMalformedOrder = avgRatingOrder < myRatingOrder || avgRatingOrder < myProgressOrder;

          // If order is malformed or if many columns are missing, regenerate order
          const missingColumns = orderedDefaultOrder.filter((id) => !settings[id]);
          const shouldRegenerate = hasMalformedOrder || missingColumns.length > orderedDefaultOrder.length / 2;

          if (shouldRegenerate) {
            // Regenerate order completely
            const defaultSettings: ColumnSettings = {};

            // Handle select separately
            if (orderedDefaultOrder.includes("select")) {
              defaultSettings["select"] = {
                order: -1,
                visible: settings["select"]?.visible ?? true,
              };
            }

            // Filter out select and actions from the order calculation
            const columnsToOrder = orderedDefaultOrder.filter((id) => id !== "select" && id !== "actions");

            // Ensure order is first
            const normalizedOrder = columnsToOrder[0] === "order" ? columnsToOrder : ["order", ...columnsToOrder.filter((id) => id !== "order")];

            let orderCounter = 0;
            normalizedOrder.forEach((columnId) => {
              if (columnId === "order") {
                defaultSettings[columnId] = {
                  order: 0,
                  visible: true,
                };
                return;
              }
              orderCounter++;
              defaultSettings[columnId] = {
                order: orderCounter,
                visible: settings[columnId]?.visible ?? true,
              };
            });

            // Handle actions separately
            if (orderedDefaultOrder.includes("actions")) {
              const maxOrder = Math.max(...Object.values(defaultSettings).map((s) => s.order), 0);
              defaultSettings["actions"] = {
                order: maxOrder + 1,
                visible: settings["actions"]?.visible ?? true,
              };
            }

            return defaultSettings;
          }

          // Otherwise, just add missing columns and fix order column
          // Handle select separately
          if (orderedDefaultOrder.includes("select") && !settings["select"]) {
            settings["select"] = {
              order: -1,
              visible: true,
            };
          }

          // Filter out select and actions from the order calculation
          const columnsToOrder = orderedDefaultOrder.filter((id) => id !== "select" && id !== "actions");

          // Ensure order is first
          const normalizedOrder = columnsToOrder[0] === "order" ? columnsToOrder : ["order", ...columnsToOrder.filter((id) => id !== "order")];

          let orderCounter = 0;
          normalizedOrder.forEach((columnId) => {
            if (!settings[columnId]) {
              // Column is missing, add it with correct order
              if (columnId === "order") {
                settings[columnId] = {
                  order: 0,
                  visible: true,
                };
              } else {
                orderCounter++;
                settings[columnId] = {
                  order: orderCounter,
                  visible: true,
                };
              }
            } else if (columnId === "order") {
              // Ensure order column is always visible and first
              settings[columnId] = {
                ...settings[columnId],
                order: 0,
                visible: true,
              };
            }
            // For existing columns (except order), preserve their current order
          });

          // Handle actions separately
          if (orderedDefaultOrder.includes("actions") && !settings["actions"]) {
            const maxOrder = Math.max(...Object.values(settings).map((s) => s.order), 0);
            settings["actions"] = {
              order: maxOrder + 1,
              visible: true,
            };
          }

          return settings;
        }
      }
    } catch {
      // Invalid JSON, fall through to create defaults
    }
  }

  // Try old format and migrate
  const oldStored = localStorage.getItem(STORAGE_KEY_OLD);
  if (oldStored) {
    try {
      const oldVisibility = JSON.parse(oldStored) as VisibilityState;
      const migrated = migrateOldVisibilityFormat(oldVisibility, orderedDefaultOrder);
      // Save migrated format
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      // Remove old key
      localStorage.removeItem(STORAGE_KEY_OLD);
      return migrated;
    } catch {
      // Invalid JSON, use defaults
    }
  }

  // No stored data, return defaults with proper order
  const defaultSettings: ColumnSettings = {};
  let orderCounter = 0;

  // Handle select separately (order -1, comes before everything)
  if (orderedDefaultOrder.includes("select")) {
    defaultSettings["select"] = {
      order: -1,
      visible: true,
    };
  }

  // Filter out select and actions from the order calculation
  const columnsToOrder = orderedDefaultOrder.filter((id) => id !== "select" && id !== "actions");

  // Ensure order is first in the array
  const normalizedOrder = columnsToOrder[0] === "order" ? columnsToOrder : ["order", ...columnsToOrder.filter((id) => id !== "order")];

  normalizedOrder.forEach((columnId) => {
    // Order column is always visible and first with order 0
    if (columnId === "order") {
      defaultSettings[columnId] = {
        order: 0,
        visible: true,
      };
      // Don't increment counter for order
      return;
    }

    // All other columns get sequential order starting from 1
    orderCounter++;
    defaultSettings[columnId] = {
      order: orderCounter,
      visible: true,
    };
  });

  // Handle actions separately (comes last)
  if (orderedDefaultOrder.includes("actions")) {
    const maxOrder = Math.max(...Object.values(defaultSettings).map((s) => s.order), 0);
    defaultSettings["actions"] = {
      order: maxOrder + 1,
      visible: true,
    };
  }

  return defaultSettings;
}

function saveColumnSettingsToStorage(settings: ColumnSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useColumnSettings(
  getColumnSettings: () => ColumnSettings,
  setColumnSettings: (value: ColumnSettings) => void,
  getIsSettingsLoaded: () => boolean,
  setIsSettingsLoaded: (value: boolean) => void,
  getDefaultColumnOrder: () => string[]
) {
  // Load columnSettings from localStorage on mount (and when defaultColumnOrder changes)
  $effect(() => {
    const defaultColumnOrder = getDefaultColumnOrder(); // Access reactively via getter
    const loaded = loadColumnSettingsFromStorage(defaultColumnOrder);
    setColumnSettings(loaded);
    setIsSettingsLoaded(true);
  });

  // Save columnSettings to localStorage whenever it changes
  $effect(() => {
    if (getIsSettingsLoaded()) {
      saveColumnSettingsToStorage(getColumnSettings());
    }
  });

  function handleColumnVisibilityChange(updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) {
    const currentSettings = getColumnSettings();
    const currentVisibility: VisibilityState = {};

    // Convert settings to visibility state
    Object.keys(currentSettings).forEach((columnId) => {
      currentVisibility[columnId] = currentSettings[columnId].visible;
    });

    // Apply updater
    const newVisibility = typeof updater === "function" ? updater(currentVisibility) : updater;

    // Update settings with new visibility
    const updatedSettings: ColumnSettings = { ...currentSettings };
    Object.keys(newVisibility).forEach((columnId) => {
      // Index column is always visible
      if (columnId === "order") {
        updatedSettings[columnId] = {
          ...updatedSettings[columnId],
          visible: true,
        };
      } else if (updatedSettings[columnId]) {
        updatedSettings[columnId] = {
          ...updatedSettings[columnId],
          visible: newVisibility[columnId] !== false,
        };
      }
    });

    setColumnSettings(updatedSettings);
  }

  function handleColumnOrderChange(updater: string[] | ((prev: string[]) => string[])) {
    const currentSettings = getColumnSettings();
    const currentOrder = Object.keys(currentSettings).sort((a, b) => currentSettings[a].order - currentSettings[b].order);

    const newOrder = typeof updater === "function" ? updater(currentOrder) : updater;

    // Ensure index is first
    const normalizedOrder = newOrder[0] === "order" ? newOrder : ["order", ...newOrder.filter((id) => id !== "order")];

    // Update settings with new order
    const updatedSettings: ColumnSettings = { ...currentSettings };
    normalizedOrder.forEach((columnId, index) => {
      if (updatedSettings[columnId]) {
        // Index column always has order 0
        if (columnId === "order") {
          updatedSettings[columnId] = {
            ...updatedSettings[columnId],
            order: 0,
          };
        } else {
          updatedSettings[columnId] = {
            ...updatedSettings[columnId],
            order: index,
          };
        }
      }
    });

    setColumnSettings(updatedSettings);
  }

  return {
    handleColumnVisibilityChange,
    handleColumnOrderChange,
  };
}
