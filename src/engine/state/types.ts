export type Money = number;

export type PropertyAsset = {
  id: string;
  type: "PROPERTY";
  value: Money;
  costBasis: Money;
};

export type EtfAsset = {
  id: string;
  type: "ETF";
  value: Money;
};

export type Asset = PropertyAsset | EtfAsset;

export type MortgageLiability = {
  id: string;
  type: "MORTGAGE";
  propertyId: string;
  balance: Money;
  annualInterestRate: number;
  termYears: number;
};

export type Liability = MortgageLiability;

export type PortfolioState = {
  cash: Money;
  assets: Asset[];
  liabilities: Liability[];
};
