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

export function getLicense(spdxLicenseId: string): ILicense | undefined {
  return spdxLicenseList.licenses.find((license: { licenseId: string }) => license.licenseId === spdxLicenseId);
}
