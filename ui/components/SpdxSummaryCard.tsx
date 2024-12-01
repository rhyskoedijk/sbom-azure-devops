import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { SecurityAdvisoryIdentifierType } from '../../shared/ghsa/ISecurityAdvisory';
import { ISecurityVulnerability } from '../../shared/ghsa/ISecurityVulnerability';
import { getHexStringFromColor } from '../../shared/models/severity/IColor';
import { ISeverity } from '../../shared/models/severity/ISeverity';
import { SEVERITIES } from '../../shared/models/severity/Severities';
import { IDocument, isPackageTopLevel } from '../../shared/models/spdx/2.3/IDocument';
import { ExternalRefCategory, getExternalRefPackageManagerName } from '../../shared/models/spdx/2.3/IExternalRef';
import { IFile } from '../../shared/models/spdx/2.3/IFile';
import { getLicensesFromExpression, ILicense } from '../../shared/models/spdx/2.3/ILicense';
import {
  getPackageLicenseExpression,
  getPackageSupplierOrganization,
  IPackage,
} from '../../shared/models/spdx/2.3/IPackage';

import { VulnerabilitiesSummaryBadge } from './VulnerabilitiesSummaryBadge';

interface ChartData {}

interface Props {
  document: IDocument;
  files: IFile[];
  packages: IPackage[];
  securityAdvisories: ISecurityVulnerability[];
  licenses: ILicense[];
  suppliers: string[];
}

interface State {
  files?: {
    total: number;
  };
  packages?: {
    total: number;
    groupedByPackageManager: Record<string, number>;
    groupedByType: Record<string, number>;
    groupedByLicense: Record<string, number>;
    groupedBySupplier: Record<string, number>;
    groupedByVulnerable: Record<string, number>;
  };
  securityAdvisories?: {
    total: number;
    chartBySeverity: ChartData;
    byAgeInDays: Record<string, number>;
    groupedBySeverity: Record<string, number>;
    groupedByPackageName: Record<string, number>;
    groupedByFixable: Record<string, number>;
    groupedByCvssScore: Record<number, number>;
    groupedByWeakness: Record<string, number>;
  };
  licenses?: {
    total: number;
  };
  suppliers?: {
    total: number;
  };
}

export class SpdxSummaryCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  static getDerivedStateFromProps(props: Props): State {
    return {
      files: !props.files
        ? undefined
        : {
            total: props.files.length,
          },
      packages: !props.packages
        ? undefined
        : {
            total: props.packages.length,
            groupedByPackageManager: props.packages.reduce(
              (acc, p) => {
                const name = getExternalRefPackageManagerName(p.externalRefs) || 'Other';
                acc[name] = (acc[name] || 0) + 1;
                return acc;
              },
              {} as { [name: string]: number },
            ),
            groupedByType: props.packages.reduce(
              (acc, p) => {
                const type = isPackageTopLevel(props.document, p.SPDXID) ? 'Top Level' : 'Transitive';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
              },
              {} as { [name: string]: number },
            ),
            groupedByLicense: props.packages.reduce(
              (acc, p) => {
                getLicensesFromExpression(getPackageLicenseExpression(p) || '')?.forEach((license) => {
                  acc[license.licenseId] = (acc[license.licenseId] || 0) + 1;
                });
                return acc;
              },
              {} as { [name: string]: number },
            ),
            groupedBySupplier: props.packages.reduce(
              (acc, p) => {
                const supplier = getPackageSupplierOrganization(p);
                if (supplier) {
                  acc[supplier] = (acc[supplier] || 0) + 1;
                }
                return acc;
              },
              {} as { [name: string]: number },
            ),
            groupedByVulnerable: props.packages.reduce(
              (acc, p) => {
                const hasVulnerabilities = p.externalRefs?.some(
                  (ref) => ref.referenceCategory === ExternalRefCategory.Security,
                );
                const key = hasVulnerabilities ? 'Vulnerable' : 'Not Vulnerable';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              },
              {} as { [name: string]: number },
            ),
          },
      securityAdvisories: !props.securityAdvisories
        ? undefined
        : {
            total: props.securityAdvisories.length,
            byAgeInDays: props.securityAdvisories.reduce(
              (acc, vuln) => {
                const id = vuln.advisory.identifiers?.find((id) => id.type == SecurityAdvisoryIdentifierType.Ghsa);
                if (id) {
                  acc[id.value] = Math.floor(
                    (Date.now() - new Date(vuln.advisory.publishedAt).getTime()) / (1000 * 60 * 60 * 24),
                  );
                }
                return acc;
              },
              {} as { [name: string]: number },
            ),
            chartBySeverity: SpdxSummaryCard.getChartBySeverity(props.securityAdvisories),
            groupedBySeverity: props.securityAdvisories.reduce(
              (acc, vuln) => {
                const severity = vuln.advisory.severity?.toPascalCase();
                if (severity) {
                  acc[severity] = (acc[severity] || 0) + 1;
                }
                return acc;
              },
              {} as { [name: string]: number },
            ),
            groupedByPackageName: props.securityAdvisories.reduce(
              (acc, vuln) => {
                acc[vuln.package.name] = (acc[vuln.package.name] || 0) + 1;
                return acc;
              },
              {} as { [name: string]: number },
            ),
            groupedByFixable: props.securityAdvisories.reduce(
              (acc, vuln) => {
                const key = vuln.firstPatchedVersion ? 'Fixable' : 'Not Fixable';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              },
              {} as { [name: string]: number },
            ),
            groupedByCvssScore: props.securityAdvisories.reduce(
              (acc, vuln) => {
                const key = Math.floor(vuln.advisory.cvss?.score || 0);
                if (key > 0) {
                  acc[key] = (acc[key] || 0) + 1;
                }
                return acc;
              },
              {} as { [name: number]: number },
            ),
            groupedByWeakness: props.securityAdvisories.reduce(
              (acc, vuln) => {
                vuln.advisory.cwes.forEach((weakness) => {
                  acc[weakness.id] = (acc[weakness.id] || 0) + 1;
                });
                return acc;
              },
              {} as { [name: string]: number },
            ),
          },
      licenses: !props.licenses
        ? undefined
        : {
            total: props.licenses.length,
          },
      suppliers: !props.suppliers
        ? undefined
        : {
            total: props.suppliers.length,
          },
    };
  }

  static getChartBySeverity(securityAdvisories: ISecurityVulnerability[]): ChartData {
    const severities = SEVERITIES.filter((s: ISeverity) => s.id > 0)
      .orderBy((s: ISeverity) => s.weight, false)
      .map((s: ISeverity) => {
        return {
          name: s.name,
          color: getHexStringFromColor(s.color),
          count: securityAdvisories.filter((v) => v.advisory.severity.toUpperCase() === s.name.toUpperCase()).length,
        };
      });

    // TODO: Implement chart data
    return {};
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (
      prevProps.document !== this.props.document ||
      prevProps.files !== this.props.files ||
      prevProps.packages !== this.props.packages ||
      prevProps.securityAdvisories !== this.props.securityAdvisories ||
      prevProps.licenses !== this.props.licenses ||
      prevProps.suppliers !== this.props.suppliers
    ) {
      this.setState(SpdxSummaryCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.props?.document) {
      return (
        <ZeroData
          iconProps={{ iconName: 'ViewDashboard' }}
          primaryText="Nothing to display"
          secondaryText="Document does not contain any data to summarise."
          imageAltText=""
          className="margin-vertical-20"
        />
      );
    }
    return (
      <Card className="flex-grow flex-column bolt-card bolt-card-white">
        <div className="flex-grow flex-column flex-center flex-gap-8">
          <div className="summary-row flex-row flex-grow flex-center flex-gap-8">
            <div className="summary-column flex-column flex-grow">
              {this.props.securityAdvisories.length > 0 && (
                <VulnerabilitiesSummaryBadge vulnerabilities={this.props.securityAdvisories} />
              )}
            </div>
          </div>
          <div className="summary-row flex-row flex-grow flex-center flex-gap-8">
            <div className="summary-column flex-column flex-grow">
              <span>TODO: Add pretty dashboard for:</span>
              <pre>{JSON.stringify(this.state, null, 2)}</pre>
            </div>
          </div>
        </div>
      </Card>
    );
  }
}
