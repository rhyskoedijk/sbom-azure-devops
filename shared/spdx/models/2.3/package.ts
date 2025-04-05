import { NOASSERTION } from './constants';
import { IExternalRef } from './externalRef';
import { IPackageVerificationCode } from './packageVerificationCode';

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

export function getPackageLicenseExpression(pkg: IPackage): string | undefined {
  if (pkg.licenseConcluded && pkg.licenseConcluded !== NOASSERTION) {
    return pkg.licenseConcluded;
  }
  if (pkg.licenseDeclared && pkg.licenseDeclared !== NOASSERTION) {
    return pkg.licenseDeclared;
  }
  return undefined;
}

export function getPackageLicenseReferences(pkg: IPackage): string[] {
  const expression = getPackageLicenseExpression(pkg) || '';
  return expression.split(/\s+/).filter((word) => word.length > 0);
}

export function getPackageSupplierOrganization(pkg: IPackage): string | undefined {
  if (pkg.supplier === NOASSERTION) {
    return undefined;
  }
  return pkg.supplier?.match(/^Organization\:(.*)$/i)?.[1]?.trim() || pkg.supplier;
}
