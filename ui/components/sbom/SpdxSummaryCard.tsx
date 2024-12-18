import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { rgbToHex } from 'azure-devops-ui/Utilities/Color';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { createTheme, Theme, ThemeProvider } from '@mui/material';

import { ISecurityVulnerability } from '../../../shared/ghsa/ISecurityVulnerability';
import { ISeverity } from '../../../shared/models/severity/ISeverity';
import { DEFAULT_SEVERITY, getSeverityByName, SEVERITIES } from '../../../shared/models/severity/Severities';
import { spdxConstantsAreEqual } from '../../../shared/models/spdx/2.3/Constants';
import { IDocument, isPackageTopLevel } from '../../../shared/models/spdx/2.3/IDocument';
import { ExternalRefCategory, getExternalRefPackageManagerName } from '../../../shared/models/spdx/2.3/IExternalRef';
import { IFile } from '../../../shared/models/spdx/2.3/IFile';
import { ILicense } from '../../../shared/models/spdx/2.3/ILicense';
import { IPackage } from '../../../shared/models/spdx/2.3/IPackage';

import { BarChart, BarChartSeries } from '../charts/BarChart';
import { PieChart, PieChartValue } from '../charts/PieChart';
import { Tile } from '../charts/Tile';

interface Recommendation {
  severity: ISeverity;
  title: string;
  target: string;
  action: string;
}

interface Props {
  document: IDocument;
  files: IFile[];
  packages: IPackage[];
  securityAdvisories: ISecurityVulnerability[];
  licenses: ILicense[];
  suppliers: string[];
}

interface State {
  theme: Theme;
  files?: {
    total: number;
  };
  packageManagers: string[];
  packages?: {
    total: number;
    totalVulnerable: number;
    packageTypesChartData: PieChartValue[];
    packageManagersChartData: PieChartValue[];
  };
  securityAdvisories?: {
    total: number;
    weaknesses: string[];
    vulnPackageNames: string[];
    vulnHighestSeverity: ISeverity;
    vulnByPackageManagerChartData: BarChartSeries[];
    vulnByPackageNameChartData: BarChartSeries[];
    vulnByWeaknessChartData: BarChartSeries[];
    // vulnSeverityAndCvssHeatMapChartData: HeatMapValue[];
    // vulnPublishedTimelineChartData: TimelineValue[];
  };
  licenses?: {
    total: number;
    // licensesChartData: PieChartValue[];
  };
  suppliers?: {
    total: number;
    // suppliersChartData: PieChartValue[];
  };
  // recommendations?: Recommendation[];
}

export class SpdxSummaryCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { theme: SpdxSummaryCard.getChartTheme(), packageManagers: [] };
  }

  static getDerivedStateFromProps(props: Props): State {
    const packageManagers = reduceAsMap(
      props.packages,
      (p) => getExternalRefPackageManagerName(p.externalRefs) || 'Other',
      (k, v) => k,
    )
      .orderBy((pm: string) => pm, false)
      .distinct();
    const vulnPackageNames = reduceAsMap(
      props.securityAdvisories.map((v) => v.package),
      (p) => p.name,
      (k, v) => k,
    )
      .orderBy((pn: string) => pn, false)
      .distinct();
    const weaknesses = props.securityAdvisories
      .flatMap((v) => v.advisory.cwes || [])
      .map((w) => w.id)
      .orderBy((w: string) => new Number(w.match(/\d+/)?.[0] || '0'), false)
      .distinct();

    return {
      theme: SpdxSummaryCard.getChartTheme(),
      files: props.files ? { total: props.files.length } : undefined,
      packageManagers: packageManagers,
      packages: props.packages
        ? {
            total: props.packages.length,
            totalVulnerable: props.packages.filter((p) =>
              p.externalRefs?.some((ref) => spdxConstantsAreEqual(ref.referenceCategory, ExternalRefCategory.Security)),
            ).length,
            packageTypesChartData: reduceAsMap(
              props.packages,
              (p) => (isPackageTopLevel(props.document, p.SPDXID) ? 'Top Level' : 'Transitive'),
              (k, v) => ({ label: k, value: v }),
            ),
            packageManagersChartData: reduceAsMap(
              props.packages,
              (p) => getExternalRefPackageManagerName(p.externalRefs) || 'Other',
              (k, v) => ({ label: k, value: v }),
            ),
          }
        : undefined,
      securityAdvisories: props.securityAdvisories
        ? {
            total: props.securityAdvisories.length,
            weaknesses: weaknesses,
            vulnPackageNames: vulnPackageNames,
            vulnHighestSeverity: props.securityAdvisories
              .map((s) => getSeverityByName(s.advisory.severity))
              .reduce((max, s) => (s.weight > max.weight ? s : max), DEFAULT_SEVERITY),
            vulnByPackageManagerChartData: SpdxSummaryCard.getVulnerabilitiesByPackageManagerChartData(
              props.packages,
              packageManagers,
              props.securityAdvisories,
            ),
            vulnByPackageNameChartData: SpdxSummaryCard.getVulnerabilitiesByPackageNameChartData(
              props.packages,
              vulnPackageNames,
              props.securityAdvisories,
            ),
            vulnByWeaknessChartData: SpdxSummaryCard.getVulnerabiilityWeaknessesChartData(
              weaknesses,
              props.securityAdvisories,
            ),
          }
        : undefined,
      licenses: props.licenses ? { total: props.licenses.length } : undefined,
      suppliers: props.suppliers ? { total: props.suppliers.length } : undefined,
    };
  }

  static getChartTheme(): Theme {
    return createTheme({ palette: { mode: 'dark' } });
  }

  static getVulnerabilitiesByPackageManagerChartData(
    packages: IPackage[],
    packageManagers: string[],
    securityAdvisories: ISecurityVulnerability[],
  ): BarChartSeries[] {
    return SEVERITIES.filter((s: ISeverity) => s.id > 0)
      .orderBy((s: ISeverity) => s.weight, false)
      .map((s: ISeverity) => {
        return {
          color: rgbToHex(s.color),
          label: s.name,
          data: packageManagers.map(
            (pm) =>
              securityAdvisories.filter((v) => {
                const pkg = packages.find((p) => p.name == v.package.name);
                return (
                  pkg &&
                  pkg.externalRefs &&
                  getExternalRefPackageManagerName(pkg.externalRefs) == pm &&
                  v.advisory.severity.toUpperCase() === s.name.toUpperCase()
                );
              }).length,
          ),
          stack: 'severity',
        };
      });
  }

  static getVulnerabilitiesByPackageNameChartData(
    packages: IPackage[],
    packageNames: string[],
    securityAdvisories: ISecurityVulnerability[],
  ): BarChartSeries[] {
    return SEVERITIES.filter((s: ISeverity) => s.id > 0)
      .orderBy((s: ISeverity) => s.weight, false)
      .map((s: ISeverity) => {
        return {
          color: rgbToHex(s.color),
          label: s.name,
          data: packageNames.map(
            (pn) =>
              securityAdvisories.filter((v) => {
                const pkg = packages.find((p) => p.name == v.package.name);
                return pkg && pkg.name == pn && v.advisory.severity.toUpperCase() === s.name.toUpperCase();
              }).length,
          ),
          stack: 'severity',
        };
      });
  }

  static getVulnerabiilityWeaknessesChartData(
    weaknesses: string[],
    securityAdvisories: ISecurityVulnerability[],
  ): BarChartSeries[] {
    return [
      {
        label: 'Vulnerabilities',
        data: weaknesses.map((w) => securityAdvisories.filter((v) => v.advisory.cwes?.some((c) => c.id == w)).length),
      },
    ];
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
        <ThemeProvider theme={this.state.theme}>
          <div className="flex-column flex-gap-24">
            <div className="summary-row flex-row flex-wrap flex-gap-24">
              <Tile
                color={DEFAULT_SEVERITY.color}
                value={this.state.files?.total?.toString() || '0'}
                title="Total Files"
              />
              <Tile
                color={DEFAULT_SEVERITY.color}
                value={this.state.packages?.total?.toString() || '0'}
                title="Total Packages"
              />
              <Tile
                color={this.state.securityAdvisories?.vulnHighestSeverity?.color}
                value={this.state.packages?.totalVulnerable?.toString() || '0'}
                title="Vulnerable Packages"
              />
              <Tile
                color={this.state.securityAdvisories?.vulnHighestSeverity?.color}
                value={(this.state.securityAdvisories?.total || 0).toString()}
                title="Total Vulnerabilities"
              />
              <Tile
                color={DEFAULT_SEVERITY.color}
                value={this.state.licenses?.total?.toString() || '0'}
                title="Unique Licenses"
              />
              <Tile
                color={DEFAULT_SEVERITY.color}
                value={this.state.suppliers?.total?.toString() || '0'}
                title="Unique Suppliers"
              />
            </div>
            <div className="summary-row flex-row flex-wrap flex-gap-24">
              <BarChart
                bands={this.state.packageManagers}
                data={this.state.securityAdvisories?.vulnByPackageManagerChartData || []}
                layout="horizontal"
                title="Vulnerabilities by Package Manager"
                height={100 + this.state.packageManagers.length * 30}
              />
              <BarChart
                bands={this.state.securityAdvisories?.vulnPackageNames}
                data={this.state.securityAdvisories?.vulnByPackageNameChartData || []}
                layout="vertical"
                title="Vulnerabilities by Package Name"
                width={100 + (this.state.securityAdvisories?.vulnPackageNames?.length || 0) * 30}
              />
            </div>
            <div className="summary-row flex-row flex-wrap flex-gap-24">
              <PieChart data={this.state.packages?.packageManagersChartData || []} title="Package Managers" />
              <PieChart data={this.state.packages?.packageTypesChartData || []} title="Package Types" />
              <BarChart
                bands={this.state.securityAdvisories?.weaknesses || []}
                data={this.state.securityAdvisories?.vulnByWeaknessChartData || []}
                layout="horizontal"
                title="Weaknesses"
                height={100 + (this.state.securityAdvisories?.weaknesses?.length || 0) * 30}
              />
            </div>
          </div>
        </ThemeProvider>
      </Card>
    );
  }
}

function reduceAsMap<T, K extends keyof any, M>(
  array: T[],
  keySelector: (item: T) => K | K[],
  mapper: (key: K, value: number) => M,
) {
  const reduced = Object.entries(
    array.reduce(
      (acc, item) => {
        const key = keySelector(item);
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach((k) => {
          acc[k] = (acc[k] || 0) + 1;
        });
        return acc;
      },
      {} as Record<K, number>,
    ),
  ) as [K, number][];
  return reduced.sort().map(([k, v]) => mapper(k, v));
}

function summariseAsMap<T, K extends keyof any, V extends keyof any, M>(
  array: T[],
  keySelector: (item: T) => K | K[],
  valueSelector: (item: T) => V,
  mapper?: (key: K, value: V) => M,
) {
  const summarised = Object.entries(
    array.reduce(
      (acc, item) => {
        const key = keySelector(item);
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach((k) => {
          acc[k] = valueSelector(item);
        });
        return acc;
      },
      {} as Record<K, V>,
    ),
  ) as [K, V][];
  return summarised.sort().map(([k, v]) => (mapper ? mapper(k, v) : { label: k, value: v }));
}
