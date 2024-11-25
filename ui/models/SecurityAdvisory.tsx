import { IColor } from 'azure-devops-extension-api';
import { IExternalRef, IPackage } from './Spdx22Document';

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
  prefix: string;
  color: IColor;
}

export interface ISecurityAdvisoryPackage {
  name: string;
  version: string;
}

export const securityAdvisorySeverities: ISecurityAdvisorySeverity[] = [
  { id: 0, name: 'None', prefix: 'N', color: { red: 127, green: 127, blue: 127 } },
  { id: 1, name: 'Low', prefix: 'L', color: { red: 0, green: 120, blue: 212 } },
  { id: 2, name: 'Moderate', prefix: 'M', color: { red: 214, green: 119, blue: 48 } },
  { id: 3, name: 'High', prefix: 'H', color: { red: 205, green: 74, blue: 69 } },
  { id: 4, name: 'Critical', prefix: 'C', color: { red: 162, green: 48, blue: 44 } },
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
