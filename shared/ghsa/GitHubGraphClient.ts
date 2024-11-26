import axios from 'axios';
import * as semver from 'semver';

import { IPackage } from './IPackage';
import { ISecurityVulnerability } from './ISecurityVulnerability';

const GHSA_GRAPHQL_API = 'https://api.github.com/graphql';
const GHSA_SECURITY_VULNERABILITIES_QUERY = `
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
          references {
            url
          }
          cvss {
            score
            vectorString
          }
          cwes (first: 100) {
            nodes {
              cweId
              name
              description
            }
          }
          epss {
            percentage
            percentile
          }
          publishedAt
          updatedAt
          withdrawnAt
          permalink
        }
        vulnerableVersionRange
        firstPatchedVersion {
          identifier
        }
      }
    }
  }
`;

/**
 * GitHub GraphQL client
 */
export class GitHubGraphClient {
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get the list of security vulnerabilities for a given package ecosystem and list of packages
   * @param packageEcosystem
   * @param packages
   */
  public async getSecurityVulnerabilitiesAsync(
    packageEcosystem: string,
    packages: IPackage[],
  ): Promise<ISecurityVulnerability[]> {
    // GitHub API doesn't support querying multiple package at once, so we need to make a request for each package individually.
    // To speed up the process, we can make the requests in parallel, 100 at a time. We batch the requests to avoid hitting the rate limit too quickly.
    // https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api
    const securityVulnerabilities = await this.batchGraphQueryAsync<IPackage, ISecurityVulnerability>(
      100,
      packages,
      async (pkg) => {
        const variables = {
          ecosystem: packageEcosystem,
          package: pkg.name,
        };
        const response = await axios.post(
          GHSA_GRAPHQL_API,
          JSON.stringify({
            query: GHSA_SECURITY_VULNERABILITIES_QUERY,
            variables: variables,
          }),
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        );
        if (response.status < 200 || response.status > 299) {
          throw new Error(
            `GHSA GraphQL request failed querying 'securityVulnerabilities' with '${packageEcosystem}' '${pkg.name}'. Response: ${response.status} ${response.statusText}`,
          );
        }
        const vulnerabilities = response.data?.data?.securityVulnerabilities?.nodes;
        return vulnerabilities?.map((vulnerabilitity: any) => {
          return {
            ecosystem: packageEcosystem,
            package: pkg,
            ...vulnerabilitity,
          };
        });
      },
    );

    // Filter out vulnerabilities that have been withdrawn or that are not relevant the current version of the package
    const affectedVulnerabilities = securityVulnerabilities
      .filter((v) => !v.advisory.withdrawnAt)
      .filter((v) => {
        const pkg = v.package;
        if (!pkg || !pkg.version || !v.vulnerableVersionRange) {
          return false;
        }

        const versionRangeRequirements = v.vulnerableVersionRange.split(',').map((v) => v.trim());
        return versionRangeRequirements.every((r) => pkg.version && semver.satisfies(pkg.version, r));
      });

    return affectedVulnerabilities;
  }

  private async batchGraphQueryAsync<T1, T2>(batchSize: number, items: T1[], action: (item: T1) => Promise<T2[]>) {
    const results: T2[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      if (batch?.length) {
        try {
          const batchResults = await Promise.all(batch.map(action));
          if (batchResults?.length) {
            results.push(...batchResults.flat());
          }
        } catch (error) {
          console.warn(`Graph batch [${i}-${i + batchSize}] failed, data may be incomplete`, error);
        }
      }
    }
    return results;
  }
}
