import { describe, expect, it } from "vitest";
import type { PortfolioState } from "../state/types";
import { applyEffects } from "./EffectEngine";
import type { Effect } from "./types";

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

describe("EffectEngine", () => {
  it("applies cash effects without changing the original state", () => {
    const effects: Effect[] = [
      { type: "INCREASE_CASH", amount: 1_000_000 },
      { type: "DECREASE_CASH", amount: 250_000 },
    ];

    const result = applyEffects(initialState, effects);

    expect(result.cash).toBe(2_750_000);
    expect(initialState.cash).toBe(2_000_000);
  });

  it("adds and removes assets", () => {
    const result = applyEffects(initialState, [
      { type: "REMOVE_ASSET", assetId: "property-a" },
      {
        type: "ADD_ASSET",
        asset: { id: "etf-a", type: "ETF", value: 500_000 },
      },
    ]);

    expect(result.assets).toEqual([
      { id: "etf-a", type: "ETF", value: 500_000 },
    ]);
  });

  it("adds and removes liabilities", () => {
    const result = applyEffects(initialState, [
      { type: "REMOVE_LIABILITY", liabilityId: "mortgage-a" },
      {
        type: "ADD_LIABILITY",
        liability: {
          id: "mortgage-b",
          type: "MORTGAGE",
          propertyId: "property-b",
          balance: 10_000_000,
          annualInterestRate: 0.03,
          termYears: 30,
        },
      },
    ]);

    expect(result.liabilities.map((liability) => liability.id)).toEqual([
      "mortgage-b",
    ]);
  });
});
