import type { Asset, Liability, Money } from "../state/types";

export type Effect =
  | { type: "INCREASE_CASH"; amount: Money }
  | { type: "DECREASE_CASH"; amount: Money }
  | { type: "ADD_ASSET"; asset: Asset }
  | { type: "REMOVE_ASSET"; assetId: string }
  | { type: "ADD_LIABILITY"; liability: Liability }
  | { type: "REMOVE_LIABILITY"; liabilityId: string };
