import axios from 'axios';
import * as semver from 'semver';

const GITHUB_ADVISORY_GRAPHQL_API = 'https://api.github.com/graphql';

/**
 * Package object
 */
export interface IPackage {
  id: any;
  name: string;
  version?: string;
}

/**
 * Security advisory object
 */
export interface ISecurityAdvisory {
  package: IPackage;
  affectedVersionRange: string;
  identifiers: {
    type: string;
    value: string;
  }[];
  severity: string;
  summary: string;
  description: string;
  permalink: string;
}

/**
 * Get the list of security advisories from the GitHub Security Advisory API using GraphQL
 * @param accessToken
 * @param packageEcosystem
 * @param packages
 */
export async function getSecurityAdvisoriesAsync(
  accessToken: string,
  packageEcosystem: string,
  packages: IPackage[],
): Promise<ISecurityAdvisory[]> {
  const query = `
    query($ecosystem: SecurityAdvisoryEcosystem, $package: String) {
      securityVulnerabilities(first: 100, ecosystem: $ecosystem, package: $package) {
        nodes {
          advisory {
            identifiers {
              type,
              value
            },
            severity,
            summary,
            description,
            permalink
          }
          firstPatchedVersion {
            identifier
          }
          vulnerableVersionRange
        }
      }
    }
  `;

  // GitHub API doesn't support querying multiple package at once, so we need to make a request for each package individually.
  // To speed up the process, we can make the requests in parallel, 100 at a time. We batch the requests to avoid hitting the rate limit too quickly.
  // https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api
  console.info(`Checking security advisories for ${packages.length} ${packageEcosystem} packages`);
  const securityAdvisories = await batchSecurityAdvisoryQueryAsync(100, packages, async (pkg) => {
    const variables = {
      ecosystem: packageEcosystem,
      package: pkg.name,
    };
    const response = await axios.post(
      GITHUB_ADVISORY_GRAPHQL_API,
      JSON.stringify({
        query,
        variables,
      }),
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (response.status < 200 || response.status > 299) {
      throw new Error(
        `Failed to fetch security advisories for '${pkg.name}': ${response.status} ${response.statusText}`,
      );
    }
    const vulnerabilities = response.data?.data?.securityVulnerabilities?.nodes;
    return vulnerabilities.map((vulnerabilitity: any) => {
      return {
        package: pkg,
        // TODO: Handle multiple, https://github.com/advisories/GHSA-8g4q-xg66-9fp4
        affectedVersionRange: vulnerabilitity.vulnerableVersionRange,
        identifiers: vulnerabilitity.advisory?.identifiers?.map((id: any) => ({
          type: id.type,
          value: id.value,
        })),
        severity: vulnerabilitity.advisory?.severity,
        summary: vulnerabilitity.advisory?.summary,
        description: vulnerabilitity.advisory?.description,
        permalink: vulnerabilitity.advisory?.permalink,
      };
    });
  });

  // Filter out advisories that are not relevant the version of the package we are using
  const affectedAdvisories = securityAdvisories.filter((advisory) => {
    const pkg = advisory.package;
    if (!pkg || !pkg.version || !advisory.affectedVersionRange) {
      return false;
    }

    const versionRangeRequirements = advisory.affectedVersionRange.split(',').map((v) => v.trim());
    return versionRangeRequirements.every((r) => pkg.version && semver.satisfies(pkg.version, r));
  });

  const vulnerablePackageCount = new Set(affectedAdvisories.map((advisory) => advisory.package.name)).size;
  console.info(`Found ${affectedAdvisories.length} advisories; affecting ${vulnerablePackageCount} packages`);
  return affectedAdvisories;
}

async function batchSecurityAdvisoryQueryAsync(
  batchSize: number,
  packages: IPackage[],
  action: (pkg: IPackage) => Promise<ISecurityAdvisory[]>,
) {
  const results: ISecurityAdvisory[] = [];
  for (let i = 0; i < packages.length; i += batchSize) {
    const batch = packages.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(action));
    results.push(...batchResults.flat());
  }
  return results;
}
