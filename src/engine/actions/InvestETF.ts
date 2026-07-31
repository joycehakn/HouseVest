import type { Effect } from "../effects/types";
import type { PortfolioState } from "../state/types";
import type { Action } from "./Action";
import { assertNonNegative } from "./validation";

export type InvestEtfInput = {
  etfId: string;
  amount: number;
};

export class InvestETF implements Action {
  constructor(private readonly input: InvestEtfInput) {}

  resolve(_state: PortfolioState): Effect[] {
    assertNonNegative(this.input.amount, "amount");

    return [
      { type: "DECREASE_CASH", amount: this.input.amount },
      {
        type: "ADD_ASSET",
        asset: {
          id: this.input.etfId,
          type: "ETF",
          value: this.input.amount,
        },
      },
    ];
  }
}
