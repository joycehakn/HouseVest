import type { Effect } from "../effects/types";
import { findMortgageByProperty, findProperty } from "../state/selectors";
import type { PortfolioState } from "../state/types";
import type { Action } from "./Action";
import { assertNonNegative, assertRate } from "./validation";

export type SellPropertyInput = {
  propertyId: string;
  salePrice: number;
  sellingCostRate?: number;
  taxRate?: number;
};

export class SellProperty implements Action {
  constructor(private readonly input: SellPropertyInput) {}

  resolve(state: PortfolioState): Effect[] {
    const { propertyId, salePrice } = this.input;
    const sellingCostRate = this.input.sellingCostRate ?? 0;
    const taxRate = this.input.taxRate ?? 0;

    assertNonNegative(salePrice, "salePrice");
    assertRate(sellingCostRate, "sellingCostRate");
    assertRate(taxRate, "taxRate");

    const property = findProperty(state, propertyId);
    if (!property) {
      throw new Error(`Property "${propertyId}" was not found`);
    }

    const mortgage = findMortgageByProperty(state, propertyId);
    const sellingCost = salePrice * sellingCostRate;
    const taxableGain = Math.max(salePrice - property.costBasis, 0);
    const tax = taxableGain * taxRate;
    const mortgagePayoff = mortgage?.balance ?? 0;
    const netProceeds = salePrice - sellingCost - tax - mortgagePayoff;

    const effects: Effect[] = [
      { type: "REMOVE_ASSET", assetId: property.id },
    ];

    if (mortgage) {
      effects.push({
        type: "REMOVE_LIABILITY",
        liabilityId: mortgage.id,
      });
    }

    effects.push({ type: "INCREASE_CASH", amount: netProceeds });
    return effects;
  }
}
