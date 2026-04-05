import * as auth from "./auth";
import * as chhanChhan from "./chhanchhan";
import * as howWasYourDay from "./howwasyourday";
import * as watchlist from "./watchlist";

export const schema = {
  ...auth,
  ...chhanChhan,
  ...watchlist,
  ...howWasYourDay,
};
