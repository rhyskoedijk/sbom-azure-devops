export interface ISecurityAdvisory {
  identifiers: {
    type: SecurityAdvisoryIdentifierType | string;
    value: string;
  }[];
  severity: SecurityAdvisorySeverity;
  summary: string;
  description: string;
  references: string[];
  cvss: {
    score: number;
    vectorString: string;
  };
  cwes: {
    id: string;
    name: string;
    description: string;
  }[];
  epss: {
    percentage: number;
    percentile: number;
  };
  publishedAt: string;
  updatedAt: string;
  withdrawnAt: string;
  permalink: string;
}

export enum SecurityAdvisoryIdentifierType {
  Cve = 'CVE',
  Ghsa = 'GHSA',
}

export enum SecurityAdvisorySeverity {
  Low = 'LOW',
  Moderate = 'MODERATE',
  High = 'HIGH',
  Critical = 'CRITICAL',
}
