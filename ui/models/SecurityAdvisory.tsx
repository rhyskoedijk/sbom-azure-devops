import { IColor } from 'azure-devops-extension-api';
import { IExternalRef, IPackage } from './Spdx22';

export interface ISecurityAdvisory {
  id: string;
  severity: ISecurityAdvisorySeverity;
  summary: string;
  url: string;
  package: ISecurityAdvisoryPackage | undefined;
}

export interface ISecurityAdvisorySeverity {
  id: number;
  name: string;
  color: IColor;
}

export interface ISecurityAdvisoryPackage {
  name: string;
  version: string;
}

export const securityAdvisorySeverities: ISecurityAdvisorySeverity[] = [
  { id: 0, name: 'None', color: { red: 0, green: 0, blue: 0 } },
  { id: 1, name: 'Low', color: { red: 100, green: 181, blue: 246 } },
  { id: 2, name: 'Moderate', color: { red: 255, green: 183, blue: 77 } },
  { id: 3, name: 'High', color: { red: 255, green: 138, blue: 101 } },
  { id: 4, name: 'Critical', color: { red: 229, green: 115, blue: 115 } },
];

export const defaultSecurityAdvisorySeverity: ISecurityAdvisorySeverity = securityAdvisorySeverities[0];

export function parseSecurityAdvisory(
  securityAdvisory: IExternalRef,
  packages: IPackage[] | undefined = undefined,
): ISecurityAdvisory {
  const pkg = packages?.find((p) => p.externalRefs.includes(securityAdvisory));
  const ghsaId = securityAdvisory.referenceLocator?.match(/GHSA-[0-9a-z-]+/i)?.[0];
  const severity = securityAdvisory.comment?.match(/^\[(\w+)\]/)?.[1]?.toPascalCase();
  const summary = securityAdvisory.comment?.match(/^\[(\w+)\]([^;]*)/)?.[2]?.trim();
  const url = securityAdvisory.referenceLocator;
  return {
    id: ghsaId || '',
    severity: securityAdvisorySeverities.find((s) => s.name === severity || '') || defaultSecurityAdvisorySeverity,
    summary: summary || '',
    url: url,
    package: pkg
      ? {
          name: pkg.name || '',
          version: pkg.versionInfo || '',
        }
      : undefined,
  };
}
