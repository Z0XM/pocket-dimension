import { getContext, setContext } from "svelte";
import type { Watchlist, WatchProgressStatus } from "../columns";

export type UserRole = "user" | "contributor" | "admin";

export interface EditableFields {
  title?: string;
  languageId?: string;
  language?: string;
  type?: string;
  tags?: string;
  my_rating?: string | null;
  my_infinity?: boolean | null;
  my_shitty?: boolean | null;
  my_progress_status?: WatchProgressStatus | null;
}

export interface OriginalValues {
  [field: string]: unknown;
}

export interface NewWatchItem {
  tempId: string;
  title: string;
  languageId: string;
  language: string;
  type: string;
  tags: string[];
}

export interface EditModeState {
  isEditMode: boolean;
  // Original values for undo - stores the original value before editing
  originalValues: Map<string, OriginalValues>;
  // Current edited values per row
  editedRows: Map<string, Partial<EditableFields>>;
  // Track which fields have been changed per row
  changedFields: Map<string, Set<string>>;
  // Temporary new rows with temp-{uuid} IDs
  newRows: NewWatchItem[];
  // Tags removed from each row
  deletedTagsByRow: Map<string, string[]>;
  // Tags added to each row
  addedTagsByRow: Map<string, string[]>;
  // Row IDs marked for deletion (admin only)
  deletedRowIds: Set<string>;
  // Selected row IDs for bulk operations
  selectedRowIds: Set<string>;
  // Validation errors: rowId -> fieldName -> error message
  validationErrors: Map<string, Map<string, string>>;
  // Last clicked row index for shift+click selection
  lastSelectedIndex: number | null;
}

const EDIT_MODE_CONTEXT_KEY = "editModeContext";

/**
 * Creates and returns the edit mode state manager
 */
export function createEditModeState() {
  // Reactive state
  let isEditMode = $state(false);
  let originalValues = $state<Map<string, OriginalValues>>(new Map());
  let editedRows = $state<Map<string, Partial<EditableFields>>>(new Map());
  let changedFields = $state<Map<string, Set<string>>>(new Map());
  let newRows = $state<NewWatchItem[]>([]);
  let deletedTagsByRow = $state<Map<string, string[]>>(new Map());
  let addedTagsByRow = $state<Map<string, string[]>>(new Map());
  let deletedRowIds = $state<Set<string>>(new Set());
  let selectedRowIds = $state<Set<string>>(new Set());
  let validationErrors = $state<Map<string, Map<string, string>>>(new Map());
  let lastSelectedIndex = $state<number | null>(null);

  // Derived state
  const hasChanges = $derived(
    editedRows.size > 0 || newRows.length > 0 || deletedRowIds.size > 0 || deletedTagsByRow.size > 0 || addedTagsByRow.size > 0
  );

  const hasValidationErrors = $derived.by(() => {
    for (const fieldErrors of validationErrors.values()) {
      if (fieldErrors.size > 0) return true;
    }
    return false;
  });

  const selectedCount = $derived(selectedRowIds.size);

  const deletedCount = $derived(deletedRowIds.size);

  // Functions
  function enterEditMode() {
    isEditMode = true;
  }

  function exitEditMode() {
    isEditMode = false;
    resetEditState();
  }

  function resetEditState() {
    originalValues = new Map();
    editedRows = new Map();
    changedFields = new Map();
    newRows = [];
    deletedTagsByRow = new Map();
    addedTagsByRow = new Map();
    deletedRowIds = new Set();
    selectedRowIds = new Set();
    validationErrors = new Map();
    lastSelectedIndex = null;
  }

  function markFieldEdited<K extends keyof EditableFields>(rowId: string, field: K, newValue: EditableFields[K], originalValue: EditableFields[K]) {
    // Store original value if not already stored
    if (!originalValues.has(rowId)) {
      originalValues = new Map(originalValues).set(rowId, {});
    }
    const rowOriginals = originalValues.get(rowId)!;
    if (!(field in rowOriginals)) {
      rowOriginals[field] = originalValue;
      originalValues = new Map(originalValues).set(rowId, rowOriginals);
    }

    // Update edited value
    const currentEdits = editedRows.get(rowId) || {};
    const updatedEdits = { ...currentEdits, [field]: newValue };
    editedRows = new Map(editedRows).set(rowId, updatedEdits);

    // Track changed field
    const rowChangedFields = changedFields.get(rowId) || new Set();

    // Check if value is different from original
    const storedOriginal = originalValues.get(rowId)?.[field];
    if (newValue === storedOriginal) {
      // Value reverted to original, remove from changed fields
      rowChangedFields.delete(field);
      if (rowChangedFields.size === 0) {
        const newChangedFields = new Map(changedFields);
        newChangedFields.delete(rowId);
        changedFields = newChangedFields;

        // Also clean up edited rows if no changes left
        const newEditedRows = new Map(editedRows);
        newEditedRows.delete(rowId);
        editedRows = newEditedRows;
      } else {
        changedFields = new Map(changedFields).set(rowId, rowChangedFields);
      }
    } else {
      rowChangedFields.add(field);
      changedFields = new Map(changedFields).set(rowId, rowChangedFields);
    }
  }

  function undoFieldEdit(rowId: string, field: keyof EditableFields) {
    const rowOriginals = originalValues.get(rowId);
    if (!rowOriginals || !(field in rowOriginals)) return;

    const originalValue = rowOriginals[field] as EditableFields[typeof field];

    // Remove the field from edited rows
    const currentEdits = editedRows.get(rowId);
    if (currentEdits) {
      const { [field]: _, ...remaining } = currentEdits;
      if (Object.keys(remaining).length === 0) {
        const newEditedRows = new Map(editedRows);
        newEditedRows.delete(rowId);
        editedRows = newEditedRows;
      } else {
        editedRows = new Map(editedRows).set(rowId, remaining);
      }
    }

    // Remove from changed fields
    const rowChangedFields = changedFields.get(rowId);
    if (rowChangedFields) {
      rowChangedFields.delete(field);
      if (rowChangedFields.size === 0) {
        const newChangedFields = new Map(changedFields);
        newChangedFields.delete(rowId);
        changedFields = newChangedFields;
      } else {
        changedFields = new Map(changedFields).set(rowId, rowChangedFields);
      }
    }

    // Clear validation error for this field
    clearValidationError(rowId, field);

    return originalValue;
  }

  function getEditedValue<K extends keyof EditableFields>(rowId: string, field: K): EditableFields[K] | undefined {
    return editedRows.get(rowId)?.[field];
  }

  function getOriginalValue(rowId: string, field: string): unknown {
    return originalValues.get(rowId)?.[field];
  }

  function isFieldChanged(rowId: string, field: string): boolean {
    return changedFields.get(rowId)?.has(field) ?? false;
  }

  function addNewRow(): string {
    const tempId = `temp-${crypto.randomUUID()}`;
    const newRow: NewWatchItem = {
      tempId,
      title: "",
      languageId: "",
      language: "",
      type: "",
      tags: [],
    };
    newRows = [newRow, ...newRows];
    return tempId;
  }

  function removeNewRow(tempId: string) {
    newRows = newRows.filter((row) => row.tempId !== tempId);
    // Also clear any validation errors for this row
    const newValidationErrors = new Map(validationErrors);
    newValidationErrors.delete(tempId);
    validationErrors = newValidationErrors;
  }

  function updateNewRow(tempId: string, updates: Partial<NewWatchItem>) {
    newRows = newRows.map((row) => (row.tempId === tempId ? { ...row, ...updates } : row));
  }

  function markRowDeleted(id: string) {
    deletedRowIds = new Set(deletedRowIds).add(id);
    // Remove from selection if selected
    if (selectedRowIds.has(id)) {
      const newSelected = new Set(selectedRowIds);
      newSelected.delete(id);
      selectedRowIds = newSelected;
    }
  }

  function unmarkRowDeleted(id: string) {
    const newDeleted = new Set(deletedRowIds);
    newDeleted.delete(id);
    deletedRowIds = newDeleted;
  }

  function isRowDeleted(id: string): boolean {
    return deletedRowIds.has(id);
  }

  function toggleRowSelection(id: string) {
    const newSelected = new Set(selectedRowIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    selectedRowIds = newSelected;
  }

  function selectRow(id: string) {
    selectedRowIds = new Set(selectedRowIds).add(id);
  }

  function deselectRow(id: string) {
    const newSelected = new Set(selectedRowIds);
    newSelected.delete(id);
    selectedRowIds = newSelected;
  }

  function selectAllRows(rowIds: string[]) {
    selectedRowIds = new Set(rowIds.filter((id) => !deletedRowIds.has(id)));
  }

  function clearSelection() {
    selectedRowIds = new Set();
    lastSelectedIndex = null;
  }

  function isRowSelected(id: string): boolean {
    return selectedRowIds.has(id);
  }

  function setLastSelectedIndex(index: number | null) {
    lastSelectedIndex = index;
  }

  function handleShiftSelect(rowIds: string[], clickedIndex: number) {
    if (lastSelectedIndex === null) {
      // No previous selection, just select the clicked row
      toggleRowSelection(rowIds[clickedIndex]);
      lastSelectedIndex = clickedIndex;
      return;
    }

    const start = Math.min(lastSelectedIndex, clickedIndex);
    const end = Math.max(lastSelectedIndex, clickedIndex);

    const newSelected = new Set(selectedRowIds);
    for (let i = start; i <= end; i++) {
      const id = rowIds[i];
      if (id && !deletedRowIds.has(id)) {
        newSelected.add(id);
      }
    }
    selectedRowIds = newSelected;
  }

  function setValidationError(rowId: string, field: string, error: string) {
    const rowErrors = validationErrors.get(rowId) || new Map();
    rowErrors.set(field, error);
    validationErrors = new Map(validationErrors).set(rowId, rowErrors);
  }

  function clearValidationError(rowId: string, field: string) {
    const rowErrors = validationErrors.get(rowId);
    if (rowErrors) {
      rowErrors.delete(field);
      if (rowErrors.size === 0) {
        const newErrors = new Map(validationErrors);
        newErrors.delete(rowId);
        validationErrors = newErrors;
      } else {
        validationErrors = new Map(validationErrors).set(rowId, rowErrors);
      }
    }
  }

  function getValidationError(rowId: string, field: string): string | undefined {
    return validationErrors.get(rowId)?.get(field);
  }

  function hasFieldError(rowId: string, field: string): boolean {
    return validationErrors.get(rowId)?.has(field) ?? false;
  }

  function addTagToRow(rowId: string, tag: string) {
    const currentDeleted = deletedTagsByRow.get(rowId) || [];

    // If tag was previously deleted (meaning it was originally in the tags),
    // just remove it from deleted list (don't add to added list)
    if (currentDeleted.includes(tag)) {
      deletedTagsByRow = new Map(deletedTagsByRow).set(
        rowId,
        currentDeleted.filter((t) => t !== tag)
      );
    } else {
      // Tag wasn't deleted, so it's a new tag - add it to added tags
      const currentAdded = addedTagsByRow.get(rowId) || [];
      if (!currentAdded.includes(tag)) {
        addedTagsByRow = new Map(addedTagsByRow).set(rowId, [...currentAdded, tag]);
      }
    }
  }

  function removeTagFromRow(rowId: string, tag: string, isNewTag: boolean) {
    if (isNewTag) {
      // Remove from added tags
      const currentAdded = addedTagsByRow.get(rowId) || [];
      addedTagsByRow = new Map(addedTagsByRow).set(
        rowId,
        currentAdded.filter((t) => t !== tag)
      );
    } else {
      // Add to deleted tags
      const currentDeleted = deletedTagsByRow.get(rowId) || [];
      if (!currentDeleted.includes(tag)) {
        deletedTagsByRow = new Map(deletedTagsByRow).set(rowId, [...currentDeleted, tag]);
      }
    }
  }

  function getAddedTags(rowId: string): string[] {
    return addedTagsByRow.get(rowId) || [];
  }

  function getDeletedTags(rowId: string): string[] {
    return deletedTagsByRow.get(rowId) || [];
  }

  function isTagDeleted(rowId: string, tag: string): boolean {
    return deletedTagsByRow.get(rowId)?.includes(tag) ?? false;
  }

  function isTagAdded(rowId: string, tag: string): boolean {
    return addedTagsByRow.get(rowId)?.includes(tag) ?? false;
  }

  function hasTagChanges(rowId: string): boolean {
    const added = addedTagsByRow.get(rowId);
    const deleted = deletedTagsByRow.get(rowId);
    return (added !== undefined && added.length > 0) || (deleted !== undefined && deleted.length > 0);
  }

  function undoTagChanges(rowId: string) {
    const newAdded = new Map(addedTagsByRow);
    newAdded.delete(rowId);
    addedTagsByRow = newAdded;

    const newDeleted = new Map(deletedTagsByRow);
    newDeleted.delete(rowId);
    deletedTagsByRow = newDeleted;
  }

  /**
   * Get the changeset for the save API
   */
  function getChangeset() {
    const updates: Array<{
      id: string;
      title?: string;
      languageId?: string;
      type?: string;
      addTags?: string[];
      removeTags?: string[];
      rating?: number | null;
      infinity?: boolean;
      shitty?: boolean;
      progressStatus?: string | null;
    }> = [];

    // Process edited rows
    for (const [rowId, edits] of editedRows) {
      if (rowId.startsWith("temp-")) continue; // Skip new rows

      const update: (typeof updates)[0] = { id: rowId };

      if (edits.title !== undefined) update.title = edits.title;
      if (edits.languageId !== undefined) update.languageId = edits.languageId;
      if (edits.type !== undefined) update.type = edits.type;
      if (edits.my_rating !== undefined) {
        update.rating = edits.my_rating ? parseFloat(edits.my_rating) : null;
      }
      if (edits.my_infinity !== undefined) update.infinity = edits.my_infinity ?? false;
      if (edits.my_shitty !== undefined) update.shitty = edits.my_shitty ?? false;
      if (edits.my_progress_status !== undefined) {
        update.progressStatus = edits.my_progress_status;
      }

      // Add tag changes
      const addedTags = getAddedTags(rowId);
      const removedTags = getDeletedTags(rowId);
      if (addedTags.length > 0) update.addTags = addedTags;
      if (removedTags.length > 0) update.removeTags = removedTags;

      updates.push(update);
    }

    // Also include rows that only have tag changes but no field edits
    for (const [rowId, tags] of addedTagsByRow) {
      if (rowId.startsWith("temp-")) continue;
      if (!editedRows.has(rowId)) {
        updates.push({
          id: rowId,
          addTags: tags,
          removeTags: getDeletedTags(rowId),
        });
      }
    }
    for (const [rowId, tags] of deletedTagsByRow) {
      if (rowId.startsWith("temp-")) continue;
      if (!editedRows.has(rowId) && !addedTagsByRow.has(rowId)) {
        updates.push({
          id: rowId,
          removeTags: tags,
        });
      }
    }

    // Process new rows - merge with any edits from editedRows
    const newItems = newRows.map((row) => {
      const edits = editedRows.get(row.tempId);
      // Get tags from addedTagsByRow for this new row
      const addedTags = getAddedTags(row.tempId);
      // Merge edits from editedRows into the base row data
      const progressStatus = edits?.my_progress_status !== undefined ? edits.my_progress_status : null;
      // Ratings are only allowed when progress is "watched" or "dropped"
      const canHaveRating = progressStatus === "watched" || progressStatus === "dropped";

      const baseItem = {
        tempId: row.tempId,
        title: edits?.title ?? row.title,
        languageId: edits?.languageId ?? row.languageId,
        language: edits?.language ?? row.language,
        type: edits?.type ?? row.type,
        tags: addedTags.length > 0 ? addedTags : row.tags, // Use added tags if any, otherwise base tags
        progressStatus: progressStatus !== null ? progressStatus : undefined,
      };

      // Only include rating fields if progress is "watched" or "dropped" and they were edited
      if (canHaveRating) {
        return {
          ...baseItem,
          rating: edits?.my_rating !== undefined ? (edits.my_rating ? parseFloat(edits.my_rating) : null) : undefined,
          infinity: edits?.my_infinity !== undefined ? (edits.my_infinity ?? false) : undefined,
          shitty: edits?.my_shitty !== undefined ? (edits.my_shitty ?? false) : undefined,
        };
      }

      // Don't include rating fields if progress is not "watched" or "dropped"
      return baseItem;
    });

    // Process deleted rows
    const deleteIds = Array.from(deletedRowIds);

    return {
      updates,
      newItems,
      deleteIds,
    };
  }

  /**
   * Apply bulk edit to selected rows
   */
  function bulkEditField<K extends keyof EditableFields>(field: K, value: EditableFields[K], data: Watchlist[]) {
    // Map EditableFields field names to Watchlist property names
    // (languageId in EditableFields corresponds to language_id in Watchlist)
    const fieldToWatchlistKey: Record<string, keyof Watchlist> = {
      languageId: "language_id",
    };

    for (const id of selectedRowIds) {
      const row = data.find((r) => r.id === id);
      if (row) {
        const watchlistKey = fieldToWatchlistKey[field] ?? (field as keyof Watchlist);
        const originalValue = row[watchlistKey] as unknown as EditableFields[K];
        markFieldEdited(id, field, value, originalValue);
      }
    }
  }

  /**
   * Mark selected rows for deletion (admin only)
   */
  function bulkDeleteSelected() {
    for (const id of selectedRowIds) {
      markRowDeleted(id);
    }
    clearSelection();
  }

  /**
   * Add a tag to all selected rows
   */
  function bulkAddTag(tag: string) {
    for (const id of selectedRowIds) {
      addTagToRow(id, tag);
    }
  }

  /**
   * Check if user can edit a specific field based on role
   */
  function canEditField(role: UserRole, field: keyof EditableFields): boolean {
    const userEditableFields: (keyof EditableFields)[] = ["my_rating", "my_infinity", "my_shitty", "my_progress_status"];

    const contributorEditableFields: (keyof EditableFields)[] = [...userEditableFields, "title", "languageId", "language", "type", "tags"];

    if (role === "admin" || role === "contributor") {
      return contributorEditableFields.includes(field);
    }

    return userEditableFields.includes(field);
  }

  /**
   * Check if user can add new rows
   */
  function canAddRows(role: UserRole): boolean {
    return role === "admin" || role === "contributor";
  }

  /**
   * Check if user can delete rows
   */
  function canDeleteRows(role: UserRole): boolean {
    return role === "admin";
  }

  /**
   * Clear edits for a specific row (used after successful save)
   */
  function clearRowEdits(rowId: string) {
    // Remove from all tracking maps
    const newOriginalValues = new Map(originalValues);
    newOriginalValues.delete(rowId);
    originalValues = newOriginalValues;

    const newEditedRows = new Map(editedRows);
    newEditedRows.delete(rowId);
    editedRows = newEditedRows;

    const newChangedFields = new Map(changedFields);
    newChangedFields.delete(rowId);
    changedFields = newChangedFields;

    const newDeletedTags = new Map(deletedTagsByRow);
    newDeletedTags.delete(rowId);
    deletedTagsByRow = newDeletedTags;

    const newAddedTags = new Map(addedTagsByRow);
    newAddedTags.delete(rowId);
    addedTagsByRow = newAddedTags;

    const newValidationErrors = new Map(validationErrors);
    newValidationErrors.delete(rowId);
    validationErrors = newValidationErrors;
  }

  /**
   * Remove a row from deleted set (used after successful delete)
   */
  function clearDeletedRow(rowId: string) {
    unmarkRowDeleted(rowId);
  }

  /**
   * Remove a new row by temp ID (used after successful create)
   */
  function clearNewRow(tempId: string) {
    removeNewRow(tempId);
  }

  return {
    // State getters
    get isEditMode() {
      return isEditMode;
    },
    get originalValues() {
      return originalValues;
    },
    get editedRows() {
      return editedRows;
    },
    get changedFields() {
      return changedFields;
    },
    get newRows() {
      return newRows;
    },
    get deletedTagsByRow() {
      return deletedTagsByRow;
    },
    get addedTagsByRow() {
      return addedTagsByRow;
    },
    get deletedRowIds() {
      return deletedRowIds;
    },
    get selectedRowIds() {
      return selectedRowIds;
    },
    get validationErrors() {
      return validationErrors;
    },
    get lastSelectedIndex() {
      return lastSelectedIndex;
    },
    // Derived
    get hasChanges() {
      return hasChanges;
    },
    get hasValidationErrors() {
      return hasValidationErrors;
    },
    get selectedCount() {
      return selectedCount;
    },
    get deletedCount() {
      return deletedCount;
    },
    // Functions
    enterEditMode,
    exitEditMode,
    resetEditState,
    markFieldEdited,
    undoFieldEdit,
    getEditedValue,
    getOriginalValue,
    isFieldChanged,
    addNewRow,
    removeNewRow,
    updateNewRow,
    markRowDeleted,
    unmarkRowDeleted,
    isRowDeleted,
    toggleRowSelection,
    selectRow,
    deselectRow,
    selectAllRows,
    clearSelection,
    isRowSelected,
    setLastSelectedIndex,
    handleShiftSelect,
    setValidationError,
    clearValidationError,
    getValidationError,
    hasFieldError,
    addTagToRow,
    removeTagFromRow,
    getAddedTags,
    getDeletedTags,
    isTagDeleted,
    isTagAdded,
    hasTagChanges,
    undoTagChanges,
    getChangeset,
    bulkEditField,
    bulkDeleteSelected,
    bulkAddTag,
    canEditField,
    canAddRows,
    canDeleteRows,
    clearRowEdits,
    clearDeletedRow,
    clearNewRow,
  };
}

export type EditModeContext = ReturnType<typeof createEditModeState>;

/**
 * Set the edit mode context for child components
 */
export function setEditModeContext(context: EditModeContext) {
  setContext(EDIT_MODE_CONTEXT_KEY, context);
}

/**
 * Get the edit mode context in child components
 */
export function getEditModeContext(): EditModeContext {
  return getContext<EditModeContext>(EDIT_MODE_CONTEXT_KEY);
}
