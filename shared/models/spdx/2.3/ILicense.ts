import * as spdxLicenseList from './licenses.json';

export interface ILicense {
  reference: string;
  isDeprecatedLicenseId: boolean;
  detailsUrl: string;
  referenceNumber: number;
  name: string;
  licenseId: string;
  seeAlso: string[];
  isOsiApproved: boolean;
  isFsfLibre?: boolean;
}

/**
 * Parse SPDX license expression and return the licenses
 * https://spdx.github.io/spdx-spec/v2.3/SPDX-license-expressions/
 * @param licenseExpression The SPDX license expression
 * @returns The licenses
 */
export function getLicensesFromExpression(licenseExpression: string): ILicense[] | undefined {
  return spdxLicenseList.licenses.filter((x: { licenseId: string }) => licenseExpression.includes(x.licenseId));
}
