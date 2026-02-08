import * as auth from "./auth";
import * as howWasYourDay from "./howwasyourday";
import * as watchlist from "./watchlist";

export const schema = {
  ...auth,
  ...watchlist,
  ...howWasYourDay,
};
