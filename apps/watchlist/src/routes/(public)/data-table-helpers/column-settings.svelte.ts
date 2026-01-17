import type { VisibilityState } from "@tanstack/table-core";

const STORAGE_KEY_OLD = "data-table-column-visibility";
const STORAGE_KEY = "data-table-column-settings";

export type ColumnSettings = {
  [columnId: string]: {
    order: number;
    visible: boolean;
  };
};

function migrateOldVisibilityFormat(oldVisibility: VisibilityState, defaultOrder: string[]): ColumnSettings {
  const settings: ColumnSettings = {};

  // Create settings with default order, preserving visibility state
  defaultOrder.forEach((columnId, index) => {
    // Order column is always visible and first
    if (columnId === "order") {
      settings[columnId] = {
        order: 0,
        visible: true,
      };
    } else {
      settings[columnId] = {
        order: index,
        visible: oldVisibility[columnId] !== false, // Default to true unless explicitly false
      };
    }
  });

  return settings;
}

function loadColumnSettingsFromStorage(defaultOrder: string[]): ColumnSettings {
  if (typeof window === "undefined") {
    return {};
  }

  // Try new format first
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Validate structure
      if (typeof parsed === "object" && parsed !== null) {
        const settings = parsed as ColumnSettings;
        // Ensure all columns from defaultOrder exist in settings
        defaultOrder.forEach((columnId, index) => {
          if (!settings[columnId]) {
            if (columnId === "order") {
              settings[columnId] = {
                order: 0,
                visible: true,
              };
            } else {
              settings[columnId] = {
                order: index,
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
        });
        return settings;
      }
    } catch {
      // Invalid JSON, fall through to migration
    }
  }

  // Try old format and migrate
  const oldStored = localStorage.getItem(STORAGE_KEY_OLD);
  if (oldStored) {
    try {
      const oldVisibility = JSON.parse(oldStored) as VisibilityState;
      const migrated = migrateOldVisibilityFormat(oldVisibility, defaultOrder);
      // Save migrated format
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      // Remove old key
      localStorage.removeItem(STORAGE_KEY_OLD);
      return migrated;
    } catch {
      // Invalid JSON, use defaults
    }
  }

  // No stored data, return defaults
  const defaultSettings: ColumnSettings = {};
  defaultOrder.forEach((columnId, index) => {
    // Index column is always visible and first
    if (columnId === "order") {
      defaultSettings[columnId] = {
        order: 0,
        visible: true,
      };
    } else {
      defaultSettings[columnId] = {
        order: index,
        visible: true,
      };
    }
  });
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
