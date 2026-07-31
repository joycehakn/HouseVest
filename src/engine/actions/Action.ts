import type { Effect } from "../effects/types";
import type { PortfolioState } from "../state/types";

export interface Action {
  resolve(state: PortfolioState): Effect[];
}
