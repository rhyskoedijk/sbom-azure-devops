import { ISecurityAdvisory } from '../models/securityAdvisory/ISecurityAdvisory';
import {
  DEFAULT_SECURITY_ADVISORY_SEVERITY,
  SECURITY_ADVISORY_SEVERITIES,
} from '../models/securityAdvisory/Severities';
import { ExternalRefCategory, ExternalRefSecurityType, IExternalRef } from '../models/spdx/2.3/IExternalRef';
import { IPackage } from '../models/spdx/2.3/IPackage';

import '../extensions/StringExtensions';

export function parseSecurityAdvisoryFromSpdxExternalRef(
  externalRef: IExternalRef,
  packages: IPackage[] | undefined = undefined,
): ISecurityAdvisory | undefined {
  if (
    externalRef.referenceCategory !== ExternalRefCategory.Security ||
    externalRef.referenceType !== ExternalRefSecurityType.Advisory
  ) {
    return undefined;
  }
  const pkg = packages?.find((p) => p.externalRefs.includes(externalRef));
  const ghsaId = externalRef.referenceLocator?.match(/GHSA-[0-9a-z-]+/i)?.[0];
  const severity = externalRef.comment?.match(/^\[(\w+)\]/)?.[1]?.toPascalCase();
  const summary = externalRef.comment?.match(/^\[(\w+)\]([^;]*)/)?.[2]?.trim();
  const url = externalRef.referenceLocator;
  return {
    id: ghsaId || '',
    severity: SECURITY_ADVISORY_SEVERITIES.find((s) => s.name === severity || '') || DEFAULT_SECURITY_ADVISORY_SEVERITY,
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
