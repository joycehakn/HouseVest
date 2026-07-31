import { describe, expect, it } from "vitest";
import { executeAction, executeActions } from "./ActionEngine";
import { BuyProperty } from "./actions/BuyProperty";
import { InvestETF } from "./actions/InvestETF";
import { SellProperty } from "./actions/SellProperty";
import type { PortfolioState } from "./state/types";

const initialState: PortfolioState = {
  cash: 2_000_000,
  assets: [
    {
      id: "property-a",
      type: "PROPERTY",
      value: 15_000_000,
      costBasis: 12_000_000,
    },
  ],
  liabilities: [
    {
      id: "mortgage-a",
      type: "MORTGAGE",
      propertyId: "property-a",
      balance: 8_000_000,
      annualInterestRate: 0.025,
      termYears: 30,
    },
  ],
};

describe("ActionEngine", () => {
  it("returns both effects and the next state", () => {
    const result = executeAction(
      initialState,
      new SellProperty({
        propertyId: "property-a",
        salePrice: 16_000_000,
      }),
    );

    expect(result.effects).toHaveLength(3);
    expect(result.nextState).toEqual({
      cash: 10_000_000,
      assets: [],
      liabilities: [],
    });
    expect(initialState.assets).toHaveLength(1);
  });

  it("executes sell, buy, and ETF actions in sequence", () => {
    const result = executeActions(initialState, [
      new SellProperty({
        propertyId: "property-a",
        salePrice: 16_000_000,
      }),
      new BuyProperty({
        propertyId: "property-b",
        mortgageId: "mortgage-b",
        purchasePrice: 20_000_000,
        assumedLtv: 0.7,
        annualInterestRate: 0.025,
        loanTermYears: 30,
      }),
      new InvestETF({ etfId: "etf-a", amount: 1_000_000 }),
    ]);

    expect(result.cash).toBe(3_000_000);
    expect(result.assets.map((asset) => asset.id)).toEqual([
      "property-b",
      "etf-a",
    ]);
    expect(result.liabilities).toEqual([
      {
        id: "mortgage-b",
        type: "MORTGAGE",
        propertyId: "property-b",
        balance: 14_000_000,
        annualInterestRate: 0.025,
        termYears: 30,
      },
    ]);
  });
});
