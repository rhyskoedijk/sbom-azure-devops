import { SecurityAdvisoryIdentifierType, SecurityAdvisorySeverity } from '../ghsa/models/securityAdvisory';
import { ISecurityVulnerability } from '../ghsa/models/securityVulnerability';
import {
  ExternalRefCategory,
  ExternalRefSecurityType,
  getExternalRefPackageManagerName,
  IExternalRef,
  parseExternalRefsAs,
} from './models/2.3/externalRef';
import { IPackage } from './models/2.3/package';

/**
 * Parse security advisories from human-friendly text encoded external references;
 * Found in SPDX documents generated using DevOps extension version 1.2.1 or earlier
 * TODO: Remove this eventually...
 * @param pkg
 * @returns
 */
export function parseSpdxLegacySecurityAdvisories(pkg: IPackage): ISecurityVulnerability[] | undefined {
  return parseExternalRefsAs<ISecurityVulnerability>(
    pkg.externalRefs || [],
    ExternalRefCategory.Security,
    ExternalRefSecurityType.Advisory,
    (ref: IExternalRef): ISecurityVulnerability => {
      return {
        ecosystem: getExternalRefPackageManagerName(pkg.externalRefs) || '',
        package: {
          id: pkg.SPDXID || '',
          name: pkg.name || '',
          version: pkg.versionInfo || '',
        },
        advisory: {
          identifiers: [
            {
              type: SecurityAdvisoryIdentifierType.Ghsa,
              value: ref.referenceLocator?.match(/GHSA-[0-9a-z-]+/i)?.[0] || '',
            },
            { type: SecurityAdvisoryIdentifierType.Cve, value: ref.comment?.match(/CVE-[0-9-]+/i)?.[0] || '' },
          ],
          severity: (ref.comment?.match(/^\[(\w+)\]/)?.[1]?.toUpperCase() as SecurityAdvisorySeverity) || '',
          summary: ref.comment?.match(/^\[(\w+)\](.*);/)?.[2]?.trim() || '',
          description: '',
          references: [],
          cvss: { score: 0, vectorString: '' },
          epss: { percentage: 0, percentile: 0 },
          cwes: [],
          publishedAt: '',
          updatedAt: '',
          withdrawnAt: '',
          permalink: ref.referenceLocator || '',
        },
        vulnerableVersionRange: '',
        firstPatchedVersion: '',
      };
    },
  );
}
