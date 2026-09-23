import type { ConnectorCatalogEntry, DatasetDefinition, DatasetId, IntegratorStub } from "./types";

export const DATASETS: Record<DatasetId, DatasetDefinition> = {
  catalog: {
    id: "catalog",
    label: "Catalog",
    description: "Shared watchlist titles (title, type, language, seasons, release status, tags). Public — no personal ratings.",
    access: "public",
    direction: "both",
    columns: ["title", "type", "language", "seasons", "release_status", "tags"],
  },
  ratings: {
    id: "ratings",
    label: "My ratings & progress",
    description: "Your ratings, infinity/shitty flags, recommendations, reviews, and progress for catalog titles. Private.",
    access: "private",
    direction: "both",
    columns: ["title", "rating", "infinity", "shitty", "recommendation", "review", "progress_status", "dropped_at_season", "dropped_at_episode"],
  },
  views: {
    id: "views",
    label: "Saved views",
    description: "Your saved filter/sort views. Private.",
    access: "private",
    direction: "export",
    columns: ["name", "filters", "is_favorite"],
  },
};

export const INTEGRATORS: IntegratorStub[] = [
  {
    id: "imdb",
    label: "IMDb",
    description: "Import ratings and lists from IMDb. Stub only — real sync comes later.",
    direction: "import",
    status: "coming_soon",
    homepage: "https://www.imdb.com/",
  },
  {
    id: "letterboxd",
    label: "Letterboxd",
    description: "Import diary and watchlist from Letterboxd. Stub only — real sync comes later.",
    direction: "import",
    status: "coming_soon",
    homepage: "https://letterboxd.com/",
  },
];

export function listDatasets(): DatasetDefinition[] {
  return Object.values(DATASETS);
}

export function getDataset(id: string): DatasetDefinition | undefined {
  return DATASETS[id as DatasetId];
}

export function listConnectors(): ConnectorCatalogEntry[] {
  const datasets = listDatasets();

  return [
    {
      kind: "csv",
      id: "csv",
      label: "CSV download / upload",
      description: "Export datasets as CSV files, or upload CSV to import into supported datasets.",
      direction: "both",
      status: "available",
      datasets: datasets.map((d) => d.id),
      endpoints: {
        exportCsv: "/api/connectors/csv/{dataset}",
        importCsv: "/api/connectors/csv/{dataset}",
      },
    },
    {
      kind: "api",
      id: "api",
      label: "JSON API",
      description: "GET and POST dataset rows as JSON. Public datasets need no auth; private datasets need a session or API token.",
      direction: "both",
      status: "available",
      datasets: datasets.map((d) => d.id),
      endpoints: {
        getJson: "/api/connectors/api/{dataset}",
        postJson: "/api/connectors/api/{dataset}",
      },
    },
    ...INTEGRATORS.map((integrator): ConnectorCatalogEntry => ({
      kind: "integrator",
      id: integrator.id,
      label: integrator.label,
      description: integrator.description,
      direction: integrator.direction,
      status: integrator.status,
    })),
  ];
}
