import type { PortfolioState } from "../state/types";
import type { Effect } from "./types";

function applyEffect(state: PortfolioState, effect: Effect): PortfolioState {
  switch (effect.type) {
    case "INCREASE_CASH":
      return { ...state, cash: state.cash + effect.amount };
    case "DECREASE_CASH":
      return { ...state, cash: state.cash - effect.amount };
    case "ADD_ASSET":
      return { ...state, assets: [...state.assets, effect.asset] };
    case "REMOVE_ASSET":
      return {
        ...state,
        assets: state.assets.filter((asset) => asset.id !== effect.assetId),
      };
    case "ADD_LIABILITY":
      return {
        ...state,
        liabilities: [...state.liabilities, effect.liability],
      };
    case "REMOVE_LIABILITY":
      return {
        ...state,
        liabilities: state.liabilities.filter(
          (liability) => liability.id !== effect.liabilityId,
        ),
      };
  }
}

export function applyEffects(
  state: PortfolioState,
  effects: Effect[],
): PortfolioState {
  return effects.reduce(applyEffect, state);
}
