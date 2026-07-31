import { describe, expect, it } from "vitest";
import { findMortgageByProperty, findProperty } from "./selectors";
import type { PortfolioState } from "./types";

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

describe("PortfolioState selectors", () => {
  it("finds a property by id", () => {
    expect(findProperty(state, "property-a")?.value).toBe(15_000_000);
  });

  it("finds the mortgage secured by a property", () => {
    expect(findMortgageByProperty(state, "property-a")?.balance).toBe(
      8_000_000,
    );
  });

  it("returns undefined when an item does not exist", () => {
    expect(findProperty(state, "missing")).toBeUndefined();
    expect(findMortgageByProperty(state, "missing")).toBeUndefined();
  });
});
