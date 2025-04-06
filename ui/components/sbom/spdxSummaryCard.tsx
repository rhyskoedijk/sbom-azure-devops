import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { rgbToHex } from 'azure-devops-ui/Utilities/Color';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { ISecurityVulnerability } from '../../../shared/ghsa/models/securityVulnerability';
import { DEFAULT_SEVERITY, getSeverityByName, ISeverity, SEVERITIES } from '../../../shared/models/severity';
import { spdxConstantsAreEqual } from '../../../shared/spdx/models/2.3/constants';
import { IDocument, isPackageTopLevel } from '../../../shared/spdx/models/2.3/document';
import { ExternalRefCategory, getExternalRefPackageManagerName } from '../../../shared/spdx/models/2.3/externalRef';
import { IFile } from '../../../shared/spdx/models/2.3/file';
import { ILicense } from '../../../shared/spdx/models/2.3/license';
import { IPackage } from '../../../shared/spdx/models/2.3/package';

import { BarChart, ChartBar as BarChartBar, ChartSeries as BarChartSeries } from '../charts/bar';
import { PieChart, ChartSlice as PieChartSlice } from '../charts/pie';
import { Tile } from '../charts/tile';

interface PieChartData {
  colors?: string[];
  data: PieChartSlice[];
}

interface BarChartData {
  colors?: string[];
  bars: BarChartBar[];
  data: BarChartSeries[];
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
  files?: {
    total: number;
  };
  packageManagers: string[];
  packages?: {
    total: number;
    totalVulnerable: number;
    packageTypesChartData: PieChartData;
    packageManagersChartData: PieChartData;
  };
  securityAdvisories?: {
    total: number;
    weaknesses: string[];
    vulnPackageNames: string[];
    vulnHighestSeverity: ISeverity;
    vulnByPackageManagerChartData: BarChartData;
    vulnByPackageNameChartData: BarChartData;
    vulnByWeaknessChartData: BarChartData;
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
    this.state = { packageManagers: [] };
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
      files: props.files ? { total: props.files.length } : undefined,
      packageManagers: packageManagers,
      packages: props.packages
        ? {
            total: props.packages.length,
            totalVulnerable: props.packages.filter((p) =>
              p.externalRefs?.some((ref) => spdxConstantsAreEqual(ref.referenceCategory, ExternalRefCategory.Security)),
            ).length,
            packageTypesChartData: SpdxSummaryCard.getPackageTypesChartData(props.document, props.packages),
            packageManagersChartData: SpdxSummaryCard.getPackageManagersChartData(packageManagers, props.packages),
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

  static getPackageManagersChartData(packageManagers: string[], packages: IPackage[]): PieChartData {
    return {
      colors: packageManagers.map((pm) => packageManagerTypeColours[pm.toLowerCase()] || '#7F7F7F'),
      data: reduceAsMap(
        packages,
        (p) => getExternalRefPackageManagerName(p.externalRefs) || 'Other',
        (k, v) => ({ name: k, value: v }),
      ),
    };
  }

  static getPackageTypesChartData(document: IDocument, packages: IPackage[]): PieChartData {
    return {
      colors: ['#7F7F7F', '#CCCCCC'],
      data: reduceAsMap(
        packages,
        (p) => (isPackageTopLevel(document, p.SPDXID) ? 'Top Level' : 'Transitive'),
        (k, v) => ({ name: k, value: v }),
      ),
    };
  }

  static getVulnerabilitiesByPackageManagerChartData(
    packages: IPackage[],
    packageManagers: string[],
    securityAdvisories: ISecurityVulnerability[],
  ): BarChartData {
    const severities = SEVERITIES.filter((s: ISeverity) => s.id > 0).orderBy((s: ISeverity) => s.weight, false);
    return {
      bars: severities.map((s: ISeverity) => {
        return {
          name: s.name,
          color: rgbToHex(s.color),
          stack: 'severity',
        };
      }),
      data: packageManagers.map((name) => ({
        name: name,
        values: severities.reduce(
          (acc, s) => ({
            ...acc,
            [s.name]: securityAdvisories.filter((v) => {
              const pkg = packages.find((p) => p.name == v.package.name);
              return (
                pkg &&
                pkg.externalRefs &&
                getExternalRefPackageManagerName(pkg.externalRefs) == name &&
                v.advisory.severity.toUpperCase() === s.name.toUpperCase()
              );
            }).length,
          }),
          {} as Record<string, number>,
        ),
      })),
    };
  }

  static getVulnerabilitiesByPackageNameChartData(
    packages: IPackage[],
    packageNames: string[],
    securityAdvisories: ISecurityVulnerability[],
  ): BarChartData {
    const severities = SEVERITIES.filter((s: ISeverity) => s.id > 0).orderBy((s: ISeverity) => s.weight, false);
    return {
      bars: severities.map((s: ISeverity) => {
        return {
          name: s.name,
          color: rgbToHex(s.color),
          stack: 'severity',
        };
      }),
      data: packageNames.map((name) => ({
        name: name,
        values: severities.reduce(
          (acc, s) => ({
            ...acc,
            [s.name]: securityAdvisories.filter((v) => {
              const pkg = packages.find((p) => p.name == v.package.name);
              return pkg && pkg.name == name && v.advisory.severity.toUpperCase() === s.name.toUpperCase();
            }).length,
          }),
          {} as Record<string, number>,
        ),
      })),
    };
  }

  static getVulnerabiilityWeaknessesChartData(
    weaknesses: string[],
    securityAdvisories: ISecurityVulnerability[],
  ): BarChartData {
    return {
      bars: [{ name: 'Weaknesses', color: '#CD4A45', stack: 'weakness' }],
      data: weaknesses.map((weakness) => ({
        name: weakness,
        values: { Weaknesses: securityAdvisories.filter((v) => v.advisory.cwes?.some((c) => c.id == weakness)).length },
      })),
    };
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
          className="margin-vertical-32"
          iconProps={{ iconName: 'ViewDashboard' }}
          primaryText="Nothing to display"
          secondaryText="Document does not contain any data to summarise."
          imageAltText=""
        />
      );
    }
    return (
      <Card className="flex-grow flex-column bolt-card bolt-card-white">
        <div className="flex-column flex-gap-24 margin-vertical-4">
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
            <PieChart
              colors={this.state.packages?.packageTypesChartData.colors}
              data={this.state.packages?.packageTypesChartData.data || []}
              title="Package References"
              width={250}
              height={250}
            />
            <PieChart
              colors={this.state.packages?.packageManagersChartData.colors}
              data={this.state.packages?.packageManagersChartData.data || []}
              title="Package Managers"
              width={250}
              height={250}
            />
            <BarChart
              className="flex-grow"
              title="Vulnerabilities by Package Manager"
              layout="vertical"
              colors={this.state.securityAdvisories?.vulnByPackageManagerChartData.colors}
              bars={this.state.securityAdvisories?.vulnByPackageManagerChartData.bars || []}
              data={this.state.securityAdvisories?.vulnByPackageManagerChartData.data || []}
              height={80 * (this.state.securityAdvisories?.vulnByPackageManagerChartData.data.length || 0)}
            />
          </div>
          <div className="summary-row flex-row flex-wrap flex-gap-24">
            <BarChart
              className="flex-grow"
              title="Weaknesses"
              layout="vertical"
              colors={this.state.securityAdvisories?.vulnByWeaknessChartData.colors}
              bars={this.state.securityAdvisories?.vulnByWeaknessChartData.bars || []}
              data={this.state.securityAdvisories?.vulnByWeaknessChartData.data || []}
              height={40 * (this.state.securityAdvisories?.vulnByPackageNameChartData.data.length || 0)}
            />
            <BarChart
              className="flex-grow"
              title="Vulnerabilities by Package Name"
              colors={this.state.securityAdvisories?.vulnByPackageNameChartData.colors}
              bars={this.state.securityAdvisories?.vulnByPackageNameChartData.bars || []}
              data={this.state.securityAdvisories?.vulnByPackageNameChartData.data || []}
              layout="vertical"
              height={40 * (this.state.securityAdvisories?.vulnByPackageNameChartData.data.length || 0)}
            />
          </div>
        </div>
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
  return reduced.sort((a, b) => a[0].toString().localeCompare(b[0].toString())).map(([k, v]) => mapper(k, v));
}

const packageManagerTypeColours: Record<string, string> = {
  alpm: '#E03C31',
  apk: '#5CB8DB',
  bitbucket: '#2684FF',
  bitnami: '#FF6D00',
  cargo: '#dea584',
  cocoapods: '#FA2A02',
  composer: '#885630',
  conan: '#00B2A9',
  conda: '#44A833',
  cpan: '#1A1E1C',
  cran: '#7A2483',
  deb: '#A80030',
  docker: '#2496ED',
  gem: '#701516',
  generic: '#808080',
  git: '#F05032',
  github: '#181717',
  gitlab: '#FC6D26',
  golang: '#00ADD8',
  hackage: '#A67241',
  hex: '#6E4A7E',
  hg: '#FF4500',
  huggingface: '#FFC0CB',
  luarocks: '#2C2D72',
  maven: '#C71A36',
  mlflow: '#000000',
  npm: '#CB3837',
  nuget: '#004880',
  qpkg: '#8CC84B',
  oci: '#00A6D6',
  pub: '#0175C2',
  pypi: '#3775A9',
  rpm: '#F1502F',
  swid: '#FFA500',
  swift: '#FA7343',
  vscode: '#007ACC',
};
