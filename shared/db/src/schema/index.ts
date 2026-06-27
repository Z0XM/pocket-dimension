import * as auth from "./auth";
import * as chhanChhan from "./chhanchhan";
import * as howWasYourDay from "./howwasyourday";
import * as meViaYou from "./meviayou";
import * as watchlist from "./watchlist";
import * as zeo from "./zeo";

export const schema = {
  ...auth,
  ...chhanChhan,
  ...watchlist,
  ...howWasYourDay,
  ...meViaYou,
  ...zeo,
};
