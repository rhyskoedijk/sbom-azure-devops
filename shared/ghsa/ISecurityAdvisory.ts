export interface ISecurityAdvisory {
  identifiers: {
    type: string;
    value: string;
  }[];
  severity: string;
  summary: string;
  description: string;
  references: {
    url: string;
  }[];
  cvss: {
    score: number;
    vectorString: string;
  };
  cwes: {
    cweId: string;
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
