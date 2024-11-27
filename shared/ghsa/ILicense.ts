import * as ghsaLicenseList from './licenses.json';

export interface ILicense {
  id: string;
  name: string;
  nickname?: string;
  permissions: string[];
  conditions: string[];
  limitations: string[];
  url: string;
}

export interface ILicenseRisk {
  severity: LicenseRiskSeverity;
  reasons: string[];
}

export enum LicenseRiskSeverity {
  Unknown = 'Unknown',
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
}

export function getLicenseRiskAssessment(licenseSpdxId: string): ILicenseRisk {
  let severity = LicenseRiskSeverity.Low;
  let reasons: string[] = [];

  // Find the license
  const license = ghsaLicenseList.data.licenses.find((l) => l.spdxId === licenseSpdxId);
  if (!license) {
    return {
      severity: LicenseRiskSeverity.Unknown,
      reasons: ['License not found'],
    };
  }

  // Check if the licensed material can be used for commercial purposes
  const commerialUseRestriction = !license.permissions.some((p) => p.key == 'commercial-use');
  if (commerialUseRestriction) {
    severity = LicenseRiskSeverity.Medium;
    reasons.push('The licensed material and derivatives cannot be used for commercial purposes');
  }

  // Check if the source code must be disclosed when using this license
  const mustDiscloseSource = license.conditions.find(
    (c) => c.key == 'disclose-source' || c.key == 'network-use-disclose',
  );
  if (mustDiscloseSource) {
    severity = LicenseRiskSeverity.High;
    reasons.push(mustDiscloseSource.description);
  }

  return {
    severity,
    reasons,
  };
}
