import type { AppId } from "$lib/apps";
import chhanChhanIcon from "../../../chhan-chhan/static/icon.png";
import howwasyourdayIcon from "../../../howwasyourday/static/icon.svg";
import meViaYouIcon from "../../../me-via-you/static/icon.svg";
import rhymesIcon from "../../../rhymes/static/rhyme_icon.svg";
import watchlistIcon from "../../../watchlist/static/icon.svg";
import zeoIcon from "../../../zeo/static/icon.svg";

/** App icons sourced from each project's own favicon/static assets. */
export const appIcons: Partial<Record<AppId, string>> = {
  watchlist: watchlistIcon,
  rhymes: rhymesIcon,
  howwasyourday: howwasyourdayIcon,
  "chhan-chhan": chhanChhanIcon,
  "me-via-you": meViaYouIcon,
  zeo: zeoIcon,
};
