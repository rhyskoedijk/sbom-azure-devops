import { NOASSERTION } from './Constants';
import { IExternalRef } from './IExternalRef';
import { IPackageVerificationCode } from './IPackageVerificationCode';

export interface IPackage {
  name: string;
  SPDXID: string;
  downloadLocation: string;
  filesAnalyzed: boolean;
  licenseConcluded: string;
  licenseDeclared: string;
  copyrightText: string;
  versionInfo: string;
  externalRefs: IExternalRef[];
  supplier: string;
  packageVerificationCode?: IPackageVerificationCode;
  licenseInfoFromFiles?: string[];
  hasFiles?: string[];
}

export function getPackageLicense(pkg: IPackage): string | undefined {
  if (pkg.licenseConcluded && pkg.licenseConcluded !== NOASSERTION) {
    return pkg.licenseConcluded;
  }
  if (pkg.licenseDeclared && pkg.licenseDeclared !== NOASSERTION) {
    return pkg.licenseDeclared;
  }
  return undefined;
}

export function getPackageSupplierOrganization(pkg: IPackage): string | undefined {
  if (pkg.supplier === NOASSERTION) {
    return undefined;
  }
  return pkg.supplier?.match(/^Organization\:(.*)$/i)?.[1]?.trim() || pkg.supplier;
}
