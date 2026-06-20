import type { Component } from "svelte";
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import CalendarHeartIcon from "@lucide/svelte/icons/calendar-heart";
import FileTextIcon from "@lucide/svelte/icons/file-text";
import FilmIcon from "@lucide/svelte/icons/film";
import HeartHandshakeIcon from "@lucide/svelte/icons/heart-handshake";
import WalletIcon from "@lucide/svelte/icons/wallet";
import type { AppId } from "$lib/apps";

export const appIcons: Record<AppId, Component> = {
  watchlist: FilmIcon,
  rhymes: BookOpenIcon,
  howwasyourday: CalendarHeartIcon,
  "chhan-chhan": WalletIcon,
  "me-via-you": HeartHandshakeIcon,
  markitdown: FileTextIcon,
};
