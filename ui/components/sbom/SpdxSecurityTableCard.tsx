import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { IReadonlyObservableValue, ObservableArray, ObservableValue } from 'azure-devops-ui/Core/Observable';
import { Icon, IconSize } from 'azure-devops-ui/Icon';
import { Link } from 'azure-devops-ui/Link';
import { Pill, PillSize, PillVariant } from 'azure-devops-ui/Pill';
import {
  ColumnSorting,
  ITableColumn,
  SimpleTableCell,
  sortItems,
  SortOrder,
  Table,
  TableCell,
  TwoLineTableCell,
} from 'azure-devops-ui/Table';
import { Tooltip } from 'azure-devops-ui/TooltipEx';
import { FILTER_CHANGE_EVENT, IFilter } from 'azure-devops-ui/Utilities/Filter';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { IPackage } from '../../../shared/ghsa/IPackage';
import { SecurityAdvisoryIdentifierType } from '../../../shared/ghsa/ISecurityAdvisory';
import { ISecurityVulnerability } from '../../../shared/ghsa/ISecurityVulnerability';
import { ISeverity } from '../../../shared/models/severity/ISeverity';
import { getSeverityByName } from '../../../shared/models/severity/Severities';
import { getPackageDependsOnChain, IDocument } from '../../../shared/models/spdx/2.3/IDocument';

interface ISecurityAdvisoryTableItem {
  ghsaId: string;
  cveId: string;
  summary: string;
  package: IPackage;
  vulnerableVersionRange: string;
  firstPatchedVersion: string;
  introducedThrough: string[];
  severity: ISeverity;
  cvssScore: number;
  cvssVector: string;
  cvssVersion: string;
  epssPercentage: number;
  epssPercentile: number;
  cwes: {
    id: string;
    name: string;
    description: string;
  }[];
  publishedAt: Date;
  ageInDays: number;
  url: string;
}

interface Props {
  document: IDocument;
  securityAdvisories: ISecurityVulnerability[];
  filter: IFilter;
}

interface State {
  tableColumns: ITableColumn<ISecurityAdvisoryTableItem>[] | undefined;
  tableItems: ObservableArray<
    ISecurityAdvisoryTableItem | IReadonlyObservableValue<ISecurityAdvisoryTableItem | undefined>
  >;
  tableSorting: ColumnSorting<ISecurityAdvisoryTableItem> | undefined;
  filterTableItems?: (keywords: string) => void;
}

export class SpdxSecurityTableCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      tableColumns: undefined,
      tableItems: new ObservableArray<
        ISecurityAdvisoryTableItem | IReadonlyObservableValue<ISecurityAdvisoryTableItem | undefined>
      >(),
      tableSorting: undefined,
    };
    this.props.filter?.subscribe(() => {
      const keyword = this.props.filter.getFilterItemValue('keyword') as string;
      this.state.filterTableItems?.(keyword);
    }, FILTER_CHANGE_EVENT);
  }

  static getDerivedStateFromProps(props: Props): State {
    const rawTableItems: ISecurityAdvisoryTableItem[] =
      props.securityAdvisories
        ?.orderBy((vuln: ISecurityVulnerability) => getSeverityByName(vuln.advisory.severity).weight, false)
        ?.map((vuln: ISecurityVulnerability) => {
          const packageSpdxId = props.document.packages?.find(
            (p) => p.name == vuln.package.name && p.versionInfo == vuln.package.version,
          )?.SPDXID;
          const cvssParts = vuln.advisory.cvss?.vectorString?.match(/^CVSS\:([\d]+\.[\d]+)\/(.*)$/i);
          return {
            ghsaId: vuln.advisory.identifiers.find((i) => i.type == SecurityAdvisoryIdentifierType.Ghsa)?.value || '',
            cveId: vuln.advisory.identifiers.find((i) => i.type == SecurityAdvisoryIdentifierType.Cve)?.value || '',
            summary: vuln.advisory.summary,
            package: vuln.package,
            vulnerableVersionRange: vuln.vulnerableVersionRange,
            fixAvailable: vuln.firstPatchedVersion ? 'Yes' : 'No',
            firstPatchedVersion: vuln.firstPatchedVersion,
            introducedThrough:
              (packageSpdxId && getPackageDependsOnChain(props.document, packageSpdxId).map((p) => p.name)) || [],
            severity: getSeverityByName(vuln.advisory.severity),
            cvssScore: vuln.advisory.cvss?.score,
            cvssVector: cvssParts?.[2]?.trim() || '',
            cvssVersion: cvssParts?.[1]?.trim() || '',
            epssPercentage: (vuln.advisory.epss?.percentage || 0) * 100,
            epssPercentile: (vuln.advisory.epss?.percentile || 0) * 100,
            cwes: vuln.advisory.cwes,
            publishedAt: new Date(vuln.advisory.publishedAt),
            ageInDays: Math.floor((Date.now() - new Date(vuln.advisory.publishedAt).getTime()) / (1000 * 60 * 60 * 24)),
            url: vuln.advisory.permalink,
          };
        }) || [];

    const tableColumnResize = function onSize(
      event: MouseEvent | KeyboardEvent,
      columnIndex: number,
      width: number,
      column: ITableColumn<ISecurityAdvisoryTableItem>,
    ) {
      (column.width as ObservableValue<number>).value = width;
    };
    const tableColumns: ITableColumn<ISecurityAdvisoryTableItem>[] = [
      {
        id: 'id',
        name: 'ID',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: renderAdvisoryIdsCell,
        sortProps: {
          ariaLabelAscending: 'Sorted A to Z',
          ariaLabelDescending: 'Sorted Z to A',
        },
        width: new ObservableValue(-10),
      },
      {
        id: 'advisory',
        name: 'Advisory',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: renderAdvisorySummaryCell,
        sortProps: {
          ariaLabelAscending: 'Sorted low to high',
          ariaLabelDescending: 'Sorted high to low',
        },
        width: new ObservableValue(-30),
      },
      {
        id: 'package',
        name: 'Vulnerable Package',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: renderAdvisoryPackageCell,
        sortProps: {
          ariaLabelAscending: 'Sorted A to Z',
          ariaLabelDescending: 'Sorted Z to A',
        },
        width: new ObservableValue(-15),
      },
      {
        id: 'vulnerableVersionRange',
        name: 'Vulnerable Versions',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.vulnerableVersionRange || ''),
        width: new ObservableValue(-7.5),
      },
      {
        id: 'firstPatchedVersion',
        name: 'Fixed In',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.firstPatchedVersion || ''),
        width: new ObservableValue(-7.5),
      },
      {
        id: 'cvss',
        name: 'CVSS',
        readonly: true,
        renderCell: renderAdvisoryCvssCell,
        sortProps: {
          ariaLabelAscending: 'Sorted low to high',
          ariaLabelDescending: 'Sorted high to low',
        },
        width: new ObservableValue(-10),
      },
      {
        id: 'epss',
        name: 'EPSS',
        readonly: true,
        renderCell: renderAdvisoryEpssCell,
        sortProps: {
          ariaLabelAscending: 'Sorted low to high',
          ariaLabelDescending: 'Sorted high to low',
        },
        width: new ObservableValue(-10),
      },
      {
        id: 'cwes',
        name: 'Weaknesses',
        readonly: true,
        renderCell: renderAdvisoryCwesCell,
        sortProps: {
          ariaLabelAscending: 'Sorted low to high',
          ariaLabelDescending: 'Sorted high to low',
        },
        width: new ObservableValue(-10),
      },
    ];

    const tableItems = new ObservableArray<
      ISecurityAdvisoryTableItem | IReadonlyObservableValue<ISecurityAdvisoryTableItem | undefined>
    >(rawTableItems.slice());

    const tableSorting = new ColumnSorting<ISecurityAdvisoryTableItem>(
      (
        columnIndex: number,
        proposedSortOrder: SortOrder,
        event: React.KeyboardEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
      ) => {
        tableItems.splice(
          0,
          tableItems.length,
          ...sortItems<ISecurityAdvisoryTableItem>(
            columnIndex,
            proposedSortOrder,
            [
              // Sort on id
              (item1: ISecurityAdvisoryTableItem, item2: ISecurityAdvisoryTableItem): number => {
                return item1.ghsaId!.localeCompare(item2.ghsaId!);
              },
              // Sort on severity
              (item1: ISecurityAdvisoryTableItem, item2: ISecurityAdvisoryTableItem): number => {
                return item1.severity.weight - item2.severity.weight;
              },
              // Sort on package
              (item1: ISecurityAdvisoryTableItem, item2: ISecurityAdvisoryTableItem): number => {
                if (!item1.package || !item2.package) return 0;
                return item1.package!.name!.localeCompare(item2.package!.name!);
              },
              null,
              null,
              // Sort on cvss
              (item1: ISecurityAdvisoryTableItem, item2: ISecurityAdvisoryTableItem): number => {
                return item1.cvssScore - item2.cvssScore;
              },
              // Sort on epss
              (item1: ISecurityAdvisoryTableItem, item2: ISecurityAdvisoryTableItem): number => {
                return item1.epssPercentage - item2.epssPercentage;
              },
              // Sort on cwes
              (item1: ISecurityAdvisoryTableItem, item2: ISecurityAdvisoryTableItem): number => {
                return item1.cwes.length - item2.cwes.length;
              },
            ],
            tableColumns,
            rawTableItems,
          ),
        );
      },
    );

    const filterTableItems = (keyword: string) => {
      const filteredItems = rawTableItems.filter(
        (item) =>
          !keyword ||
          item.ghsaId?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.cveId?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.summary?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.package?.name?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.severity?.name?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.cwes?.some((cwe) => cwe.id.toLowerCase().includes(keyword.toLowerCase())),
      );
      tableItems.splice(0, tableItems.length, ...filteredItems);
    };

    if (props.filter) {
      const keyword = props.filter.getFilterItemValue('keyword') as string;
      filterTableItems(keyword);
    }

    return { tableColumns, tableItems, tableSorting, filterTableItems: filterTableItems };
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.document !== this.props.document || prevProps.securityAdvisories !== this.props.securityAdvisories) {
      this.setState(SpdxSecurityTableCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.state?.tableItems?.length) {
      return (
        <ZeroData
          iconProps={{ iconName: 'Shield' }}
          primaryText={this.props.filter.getFilterItemValue('keyword') ? 'No Match' : 'No Security Advisories'}
          secondaryText={
            this.props.filter.getFilterItemValue('keyword')
              ? 'Filter does not match any security advisories.'
              : 'Document does not contain any security advisories.'
          }
          imageAltText=""
          className="margin-vertical-20"
        />
      );
    }
    return (
      <Card
        className="flex-grow flex-column bolt-card bolt-table-card bolt-card-white"
        contentProps={{ contentPadding: false }}
      >
        <Table<ISecurityAdvisoryTableItem>
          role="table"
          containerClassName="h-scroll-auto"
          columns={this.state.tableColumns}
          itemProvider={this.state.tableItems}
          behaviors={this.state.tableSorting ? [this.state.tableSorting] : undefined}
          singleClickActivation={true}
          selectRowOnClick={true}
          onActivate={(event, tableRow) => {
            if (tableRow?.data?.url) {
              window.open(tableRow.data.url, '_blank');
            }
          }}
        />
      </Card>
    );
  }
}

function renderSimpleValueCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ISecurityAdvisoryTableItem>,
  tableItemValue: string,
): JSX.Element {
  return SimpleTableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: <span>{tableItemValue}</span>,
  });
}

function renderAdvisoryIdsCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ISecurityAdvisoryTableItem>,
  tableItem: ISecurityAdvisoryTableItem,
): JSX.Element {
  return TwoLineTableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    line1: (
      <Link
        tooltipProps={{ text: 'View this advisory in the GitHub Advisory (GHSA) Database' }}
        className="bolt-table-link bolt-table-link-inline"
        href={`https://github.com/advisories/${tableItem.ghsaId}`}
        target="_blank"
        excludeTabStop
      >
        {tableItem.ghsaId}
      </Link>
    ),
    line2: tableItem.cveId ? (
      <Link
        tooltipProps={{ text: 'View this advisory in the Common Vulnerabilities and Exposures (CVE) Database' }}
        className="bolt-table-link bolt-table-link-inline"
        href={`https://www.cve.org/CVERecord?id=${tableItem.cveId}`}
        target="_blank"
        excludeTabStop
      >
        {tableItem.cveId}
      </Link>
    ) : null,
  });
}

function renderAdvisorySummaryCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ISecurityAdvisoryTableItem>,
  tableItem: ISecurityAdvisoryTableItem,
): JSX.Element {
  return TwoLineTableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    line1: <div className="primary-text">{tableItem.summary}</div>,
    line2: (
      <div className="flex-row rhythm-horizontal-8">
        <Pill size={PillSize.compact} variant={PillVariant.colored} color={tableItem.severity.color}>
          <span className="font-weight-heavy text-on-communication-background">{tableItem.severity.name} Severity</span>
        </Pill>
        {tableItem.publishedAt && tableItem.ageInDays > 0 && (
          <div className="secondary-text">
            Published on {tableItem.publishedAt.toLocaleString()}; {tableItem.ageInDays} days ago
          </div>
        )}
      </div>
    ),
  });
}

function renderAdvisoryPackageCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ISecurityAdvisoryTableItem>,
  tableItem: ISecurityAdvisoryTableItem,
): JSX.Element {
  return TwoLineTableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    line1: (
      <Tooltip
        text={
          tableItem.introducedThrough?.length
            ? `Transitive dependency introduced through:\n${tableItem.introducedThrough?.join('\n > ')}\n > ${tableItem.package?.name}`
            : 'Direct dependency'
        }
      >
        <div className="primary-text">{tableItem.package?.name}</div>
      </Tooltip>
    ),
    line2: <div className="secondary-text">{tableItem.package?.version}</div>,
  });
}

function renderAdvisoryCvssCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ISecurityAdvisoryTableItem>,
  tableItem: ISecurityAdvisoryTableItem,
): JSX.Element {
  return TableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: tableItem.cvssScore > 0 && tableItem.cvssVector && tableItem.cvssVersion && (
      <div className="bolt-table-cell-content flex-row flex-wrap rhythm-horizontal-4">
        <span>{tableItem.cvssScore} / 10</span>
        <Link
          tooltipProps={{
            text: 'Learn more about the Common Vulnerability Scoring System (CVSS) and how this score was calculated',
          }}
          className="bolt-table-link bolt-table-link-icon"
          href={`https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator?vector=${tableItem.cvssVector}&version=${tableItem.cvssVersion}`}
          target="_blank"
          excludeTabStop
        >
          <Icon size={IconSize.medium} iconName="Info" />
        </Link>
      </div>
    ),
  });
}

function renderAdvisoryCwesCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ISecurityAdvisoryTableItem>,
  tableItem: ISecurityAdvisoryTableItem,
): JSX.Element {
  return TableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: (
      <div className="bolt-table-cell-content flex-row flex-wrap rhythm-horizontal-4">
        {tableItem.cwes.map((cwe, index) => (
          <Link
            key={index}
            tooltipProps={{ text: `${cwe.name}; ${cwe.description}` }}
            className="bolt-table-link bolt-table-link-inline"
            href={`https://cwe.mitre.org/data/definitions/${cwe.id.match(/([0-9]+)/)?.[1]?.trim()}.html`}
            target="_blank"
            excludeTabStop
          >
            {cwe.id}
          </Link>
        ))}
      </div>
    ),
  });
}

function renderAdvisoryEpssCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ISecurityAdvisoryTableItem>,
  tableItem: ISecurityAdvisoryTableItem,
): JSX.Element {
  return TwoLineTableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    line1: tableItem.epssPercentage > 0 && (
      <div className="primary-text">
        <span>{tableItem.epssPercentage.toFixed(3)}%</span>
        <Link
          tooltipProps={{ text: 'Learn more about the Exploit Prediction Scoring System (EPSS)' }}
          className="bolt-table-link bolt-table-link-icon"
          href="https://www.first.org/epss/user-guide"
          target="_blank"
          excludeTabStop
        >
          <Icon size={IconSize.medium} iconName="Info" />
        </Link>
      </div>
    ),
    line2: tableItem.epssPercentile > 0 && (
      <div className="secondary-text">
        {tableItem.epssPercentile.toFixed(0)}
        {tableItem.epssPercentile.toOridinal()} percentile
      </div>
    ),
  });
}
