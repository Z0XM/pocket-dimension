export type AppId =
  | "watchlist"
  | "rhymes"
  | "howwasyourday"
  | "chhan-chhan"
  | "me-via-you"
  | "markitdown";

export type AppEntry = {
  id: AppId;
  name: string;
  description: string;
  envKey: string;
};

export const appCatalog: AppEntry[] = [
  {
    id: "watchlist",
    name: "Watchlist",
    description: "Track movies, shows, and what to watch next.",
    envKey: "POCKET_APP_WATCHLIST_URL",
  },
  {
    id: "rhymes",
    name: "Rhymes",
    description: "Poetry, verses, and creative writing.",
    envKey: "POCKET_APP_RHYMES_URL",
  },
  {
    id: "howwasyourday",
    name: "How Was Your Day",
    description: "Daily reflections and mood tracking.",
    envKey: "POCKET_APP_HOWWASYOURDAY_URL",
  },
  {
    id: "chhan-chhan",
    name: "Chhan Chhan",
    description: "Personal finance and expense tracking.",
    envKey: "POCKET_APP_CHHAN_CHAN_URL",
  },
  {
    id: "me-via-you",
    name: "Me Via You",
    description: "Connect and share through thoughtful forms.",
    envKey: "POCKET_APP_ME_VIA_YOU_URL",
  },
  {
    id: "markitdown",
    name: "MarkItDown",
    description: "Convert documents and media to Markdown.",
    envKey: "POCKET_APP_MARKITDOWN_URL",
  },
];

export type LinkedApp = {
  id: AppId;
  name: string;
  description: string;
  url: string;
};
