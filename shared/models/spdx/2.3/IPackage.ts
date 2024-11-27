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
