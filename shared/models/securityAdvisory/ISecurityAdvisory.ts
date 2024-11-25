import { IPackage } from './IPackage';
import { ISeverity } from './ISeverity';

export interface ISecurityAdvisory {
  id: string;
  severity: ISeverity;
  summary: string;
  package: IPackage | undefined;
  affectedVersions?: string;
  patchedVersions?: string;
  url: string;
}
