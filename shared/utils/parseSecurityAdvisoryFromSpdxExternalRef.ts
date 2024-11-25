import { ISecurityAdvisory } from '../models/securityAdvisory/ISecurityAdvisory';
import {
  DEFAULT_SECURITY_ADVISORY_SEVERITY,
  SECURITY_ADVISORY_SEVERITIES,
} from '../models/securityAdvisory/Severities';
import { IExternalRef } from '../models/spdx/2.2/IExternalRef';
import { IPackage } from '../models/spdx/2.2/IPackage';

import '../extensions/StringExtensions';

export function parseSecurityAdvisoryFromSpdxExternalRef(
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
