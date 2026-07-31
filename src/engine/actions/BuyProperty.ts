import type { Effect } from "../effects/types";
import type { PortfolioState } from "../state/types";
import type { Action } from "./Action";
import { assertNonNegative, assertRate } from "./validation";

export type BuyPropertyInput = {
  propertyId: string;
  mortgageId: string;
  purchasePrice: number;
  assumedLtv: number;
  annualInterestRate: number;
  loanTermYears: number;
  transactionCostRate?: number;
};

export class BuyProperty implements Action {
  constructor(private readonly input: BuyPropertyInput) {}

  resolve(_state: PortfolioState): Effect[] {
    const {
      propertyId,
      mortgageId,
      purchasePrice,
      assumedLtv,
      annualInterestRate,
      loanTermYears,
    } = this.input;
    const transactionCostRate = this.input.transactionCostRate ?? 0;

    assertNonNegative(purchasePrice, "purchasePrice");
    assertRate(assumedLtv, "assumedLtv");
    assertRate(annualInterestRate, "annualInterestRate");
    assertRate(transactionCostRate, "transactionCostRate");

    if (!Number.isFinite(loanTermYears) || loanTermYears <= 0) {
      throw new Error("loanTermYears must be greater than 0");
    }

    const loanAmount = purchasePrice * assumedLtv;
    const downPayment = purchasePrice - loanAmount;
    const transactionCost = purchasePrice * transactionCostRate;

    return [
      {
        type: "DECREASE_CASH",
        amount: downPayment + transactionCost,
      },
      {
        type: "ADD_ASSET",
        asset: {
          id: propertyId,
          type: "PROPERTY",
          value: purchasePrice,
          costBasis: purchasePrice,
        },
      },
      {
        type: "ADD_LIABILITY",
        liability: {
          id: mortgageId,
          type: "MORTGAGE",
          propertyId,
          balance: loanAmount,
          annualInterestRate,
          termYears: loanTermYears,
        },
      },
    ];
  }
}
