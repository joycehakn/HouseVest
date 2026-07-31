import { describe, expect, it } from "vitest";
import type { PortfolioState } from "../state/types";
import { BuyProperty } from "./BuyProperty";
import { InvestETF } from "./InvestETF";
import { SellProperty } from "./SellProperty";

const state: PortfolioState = {
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

describe("SellProperty", () => {
  it("resolves sale costs, tax, and mortgage payoff into effects", () => {
    const effects = new SellProperty({
      propertyId: "property-a",
      salePrice: 16_000_000,
      sellingCostRate: 0.04,
      taxRate: 0.15,
    }).resolve(state);

    expect(effects).toEqual([
      { type: "REMOVE_ASSET", assetId: "property-a" },
      { type: "REMOVE_LIABILITY", liabilityId: "mortgage-a" },
      { type: "INCREASE_CASH", amount: 6_760_000 },
    ]);
  });

  it("rejects an unknown property", () => {
    expect(() =>
      new SellProperty({
        propertyId: "missing",
        salePrice: 16_000_000,
      }).resolve(state),
    ).toThrow('Property "missing" was not found');
  });
});

describe("BuyProperty", () => {
  it("resolves down payment, property, and mortgage effects", () => {
    const effects = new BuyProperty({
      propertyId: "property-b",
      mortgageId: "mortgage-b",
      purchasePrice: 20_000_000,
      assumedLtv: 0.7,
      annualInterestRate: 0.025,
      loanTermYears: 30,
      transactionCostRate: 0.02,
    }).resolve(state);

    expect(effects).toEqual([
      { type: "DECREASE_CASH", amount: 6_400_000 },
      {
        type: "ADD_ASSET",
        asset: {
          id: "property-b",
          type: "PROPERTY",
          value: 20_000_000,
          costBasis: 20_000_000,
        },
      },
      {
        type: "ADD_LIABILITY",
        liability: {
          id: "mortgage-b",
          type: "MORTGAGE",
          propertyId: "property-b",
          balance: 14_000_000,
          annualInterestRate: 0.025,
          termYears: 30,
        },
      },
    ]);
  });
});

describe("InvestETF", () => {
  it("resolves a cash decrease and a new ETF asset", () => {
    const effects = new InvestETF({
      etfId: "etf-a",
      amount: 1_000_000,
    }).resolve(state);

    expect(effects).toEqual([
      { type: "DECREASE_CASH", amount: 1_000_000 },
      {
        type: "ADD_ASSET",
        asset: { id: "etf-a", type: "ETF", value: 1_000_000 },
      },
    ]);
  });
});
