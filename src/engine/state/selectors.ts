import type {
  MortgageLiability,
  PortfolioState,
  PropertyAsset,
} from "./types";

export function findProperty(
  state: PortfolioState,
  propertyId: string,
): PropertyAsset | undefined {
  return state.assets.find(
    (asset): asset is PropertyAsset =>
      asset.type === "PROPERTY" && asset.id === propertyId,
  );
}

export function findMortgageByProperty(
  state: PortfolioState,
  propertyId: string,
): MortgageLiability | undefined {
  return state.liabilities.find(
    (liability) =>
      liability.type === "MORTGAGE" &&
      liability.propertyId === propertyId,
  );
}
