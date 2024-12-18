import * as spdxLicenseList from 'spdx-license-list';

export interface ILicense {
  id: string;
  name: string;
  url: string;
}

/**
 * Parse SPDX license expression and return the licenses
 * https://spdx.github.io/spdx-spec/v2.3/SPDX-license-expressions/
 * @param licenseExpression The SPDX license expression
 * @returns The licenses
 */
export function getLicensesFromExpression(licenseExpression: string): ILicense[] | undefined {
  return Object.keys(spdxLicenseList)
    .filter((id) =>
      licenseExpression
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .includes(id),
    )
    .map((id) => ({
      id,
      name: spdxLicenseList[id].name,
      url: spdxLicenseList[id].url,
    }));
}
