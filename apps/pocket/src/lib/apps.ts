import type { Component } from "svelte";
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import CalendarHeartIcon from "@lucide/svelte/icons/calendar-heart";
import FileTextIcon from "@lucide/svelte/icons/file-text";
import FilmIcon from "@lucide/svelte/icons/film";
import HeartHandshakeIcon from "@lucide/svelte/icons/heart-handshake";
import ShieldIcon from "@lucide/svelte/icons/shield";
import WalletIcon from "@lucide/svelte/icons/wallet";

export type AppEntry = {
  id: string;
  name: string;
  description: string;
  icon: Component;
  envKey: string;
};

export const appCatalog: AppEntry[] = [
  {
    id: "auth",
    name: "Auth Service",
    description: "Central authentication for all Pocket Dimension apps.",
    icon: ShieldIcon,
    envKey: "POCKET_APP_AUTH_URL",
  },
  {
    id: "watchlist",
    name: "Watchlist",
    description: "Track movies, shows, and what to watch next.",
    icon: FilmIcon,
    envKey: "POCKET_APP_WATCHLIST_URL",
  },
  {
    id: "rhymes",
    name: "Rhymes",
    description: "Poetry, verses, and creative writing.",
    icon: BookOpenIcon,
    envKey: "POCKET_APP_RHYMES_URL",
  },
  {
    id: "howwasyourday",
    name: "How Was Your Day",
    description: "Daily reflections and mood tracking.",
    icon: CalendarHeartIcon,
    envKey: "POCKET_APP_HOWWASYOURDAY_URL",
  },
  {
    id: "chhan-chhan",
    name: "Chhan Chhan",
    description: "Personal finance and expense tracking.",
    icon: WalletIcon,
    envKey: "POCKET_APP_CHHAN_CHAN_URL",
  },
  {
    id: "me-via-you",
    name: "Me Via You",
    description: "Connect and share through thoughtful forms.",
    icon: HeartHandshakeIcon,
    envKey: "POCKET_APP_ME_VIA_YOU_URL",
  },
  {
    id: "markitdown",
    name: "MarkItDown",
    description: "Convert documents and media to Markdown.",
    icon: FileTextIcon,
    envKey: "POCKET_APP_MARKITDOWN_URL",
  },
];

export type LinkedApp = AppEntry & {
  url: string;
};
