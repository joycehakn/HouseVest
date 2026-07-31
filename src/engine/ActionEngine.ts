import type { Action } from "./actions/Action";
import { applyEffects } from "./effects/EffectEngine";
import type { Effect } from "./effects/types";
import type { PortfolioState } from "./state/types";

export type ActionResult = {
  nextState: PortfolioState;
  effects: Effect[];
};

export function executeAction(
  state: PortfolioState,
  action: Action,
): ActionResult {
  const effects = action.resolve(state);
  return {
    effects,
    nextState: applyEffects(state, effects),
  };
}

export function executeActions(
  initialState: PortfolioState,
  actions: Action[],
): PortfolioState {
  return actions.reduce(
    (state, action) => executeAction(state, action).nextState,
    initialState,
  );
}
