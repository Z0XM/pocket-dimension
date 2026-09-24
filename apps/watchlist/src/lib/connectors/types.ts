/**
 * Watchlist connector types — shared contracts for datasets, CSV/API handlers, and integrators.
 */

export type ConnectorAccess = "public" | "private";
export type ConnectorDirection = "export" | "import" | "both";
export type ConnectorKind = "csv" | "api" | "integrator";

export type DatasetId = "catalog" | "ratings" | "views";

export type DatasetDefinition = {
  id: DatasetId;
  label: string;
  description: string;
  access: ConnectorAccess;
  direction: ConnectorDirection;
  /** CSV column headers in export order. */
  columns: string[];
};

export type IntegratorId = "imdb" | "letterboxd";

export type IntegratorStub = {
  id: IntegratorId;
  label: string;
  description: string;
  direction: ConnectorDirection;
  status: "coming_soon";
  homepage: string;
};

export type ConnectorCatalogEntry = {
  kind: ConnectorKind;
  id: string;
  label: string;
  description: string;
  access?: ConnectorAccess;
  direction: ConnectorDirection;
  status?: "available" | "coming_soon";
  datasets?: DatasetId[];
  endpoints?: {
    exportCsv?: string;
    importCsv?: string;
    getJson?: string;
    postJson?: string;
  };
};

export type CatalogRow = {
  title: string;
  type: string;
  language: string;
  seasons: number | null;
  release_status: string | null;
  tags: string;
};

export type RatingRow = {
  title: string;
  rating: string | null;
  infinity: boolean;
  shitty: boolean;
  recommendation: string | null;
  review: string;
  progress_status: string | null;
  dropped_at_season: number | null;
  dropped_at_episode: number | null;
};

export type ViewRow = {
  name: string;
  filters: string;
  is_favorite: boolean;
};

export type ImportResult = {
  dataset: DatasetId;
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};
