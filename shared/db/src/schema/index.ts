import * as auth from "./auth";
import * as chhanChhan from "./chhanchhan";
import * as howWasYourDay from "./howwasyourday";
import * as meViaYou from "./meviayou";
import * as rhymes from "./rhymes";
import * as watchlist from "./watchlist";

export const schema = {
  ...auth,
  ...chhanChhan,
  ...watchlist,
  ...howWasYourDay,
  ...meViaYou,
  ...rhymes,
};
