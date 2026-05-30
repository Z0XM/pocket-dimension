import questions from "$lib/data/qna.json";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  return { questions };
};
