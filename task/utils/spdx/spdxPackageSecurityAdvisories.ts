import { existsSync as fileExistsSync } from 'fs';
import * as fs from 'fs/promises';
import { getSecurityAdvisoriesAsync, IPackage, ISecurityAdvisory } from '../github/securityAdvisories';

/**
 * Check SPDX packages for security advisories; adds external references for all applicable advisories
 * @param spdxFilePath The path to the SPDX file
 * @param gitHubAccessToken The GitHub access token
 */
export async function spdxAddPackageSecurityAdvisoryExternalRefsAsync(
  spdxFilePath: string,
  gitHubAccessToken: string,
): Promise<void> {
  if (!fileExistsSync(spdxFilePath)) {
    throw new Error(`SPDX file not found: ${spdxFilePath}`);
  }

  // Read the SPDX file
  const sbom = JSON.parse(await fs.readFile(spdxFilePath, 'utf-8'));

  // Map packages by package manager
  const packageManagers: Record<string, IPackage[]> = {};
  for (const pkg of sbom.packages) {
    const packageReferenceLocator = (pkg.externalRefs as any[])?.find(
      (r) => r.referenceCategory === 'PACKAGE-MANAGER' && r.referenceType === 'purl',
    )?.referenceLocator;
    const packageManager = getGHSAEcosystemFromPackageUrl(packageReferenceLocator);
    if (packageManager) {
      if (!packageManagers[packageManager]) {
        packageManagers[packageManager] = [];
      }
      packageManagers[packageManager].push({
        id: packageReferenceLocator,
        name: pkg.name,
        version: pkg.versionInfo,
      });
    }
  }

  // Fetch security advisories for each package manager
  const securityAdvisories: ISecurityAdvisory[] = [];
  for (const [packageManager, packages] of Object.entries(packageManagers)) {
    securityAdvisories.push(...(await getSecurityAdvisoriesAsync(gitHubAccessToken, packageManager, packages)));
  }

  // Exit early if no security advisories found
  if (securityAdvisories.length === 0) {
    console.info('No security advisories found');
    return;
  }

  // Add external references for each security advisory
  for (const advisory of securityAdvisories) {
    const pkg = (sbom.packages as any[]).find((p) => {
      const packageReferenceLocator = (p.externalRefs as any[])?.find(
        (r) => r.referenceCategory === 'PACKAGE-MANAGER',
      )?.referenceLocator;
      return packageReferenceLocator === advisory.package.id;
    });
    if (pkg) {
      if (!pkg.externalRefs) {
        pkg.externalRefs = [];
      }
      pkg.externalRefs.push({
        referenceCategory: 'SECURITY',
        referenceType: 'advisory',
        referenceLocator: advisory.permalink,
        comment: `[${advisory.severity}] ${advisory.summary}`,
      });
    }
  }

  // Write changes to the SPDX file
  console.info(`Exporting security advisories to SPDX file: '${spdxFilePath}'`);
  await fs.writeFile(spdxFilePath, JSON.stringify(sbom, null, 2), 'utf-8');
}

/**
 * Get GitHub package ecosystem name from purl
 * @param url
 * @returns
 */
function getGHSAEcosystemFromPackageUrl(purl: string): string | undefined {
  const packageType = purl?.split('/')[0] || '';
  const packageManager = (packageType.includes(':') ? packageType.split(':')[1] : packageType).toUpperCase();
  switch (packageManager) {
    case 'GOLANG':
      return 'GO';
    case 'PYPI':
      return 'PIP';
    case 'GEM':
      return 'RUBYGEMS';
    case 'CARGO':
      return 'RUST';
    case 'COMPOSE':
    case 'ERLANG':
    case 'ACTIONS':
    case 'GO':
    case 'MAVEN':
    case 'NPM':
    case 'NUGET':
    case 'PIP':
    case 'PUB':
    case 'RUBYGEMS':
    case 'RUST':
    case 'SWIFT':
      return packageManager;
    default:
      return undefined;
  }
}
