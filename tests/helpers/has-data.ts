// The real-data tests render pages from data/public, which the first import writes. Until it exists they skip, and say why.
import { existsSync } from "node:fs";

export const NO_DATA = existsSync("data/public/meta.json") ? false : "data/public is not written yet (the first import writes it)";
