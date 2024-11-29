import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { IReadonlyObservableValue, ObservableArray, ObservableValue } from 'azure-devops-ui/Core/Observable';
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

import { IPackage } from '../../shared/ghsa/IPackage';
import { SecurityAdvisoryIdentifierType } from '../../shared/ghsa/ISecurityAdvisory';
import { ISecurityVulnerability } from '../../shared/ghsa/ISecurityVulnerability';
import { ISeverity } from '../../shared/models/severity/ISeverity';
import { getSeverityByName } from '../../shared/models/severity/Severities';
import { getPackageDependsOnChain, IDocument } from '../../shared/models/spdx/2.3/IDocument';

interface ISecurityAdvisoryTableItem {
  ghsaId: string;
  cveId: string;
  summary: string;
  package: IPackage;
  vulnerableVersionRange: string;
  firstPatchedVersion: string;
  severity: ISeverity;
  cvssScore: number;
  cvssVector: string;
  cweIds: string[];
  epssPercentage: number;
  epssPercentile: number;
  publishedAt: Date;
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
          return {
            ghsaId: vuln.advisory.identifiers.find((i) => i.type == SecurityAdvisoryIdentifierType.Ghsa)?.value || '',
            cveId: vuln.advisory.identifiers.find((i) => i.type == SecurityAdvisoryIdentifierType.Cve)?.value || '',
            summary: vuln.advisory.summary,
            package: vuln.package,
            vulnerableVersionRange: vuln.vulnerableVersionRange,
            fixAvailable: vuln.firstPatchedVersion ? 'Yes' : 'No',
            firstPatchedVersion: vuln.firstPatchedVersion,
            introducedThrough: getPackageDependsOnChain(props.document, vuln.package.id).map((p) => p.name),
            severity: getSeverityByName(vuln.advisory.severity),
            cvssScore: vuln.advisory.cvss?.score,
            cvssVector: vuln.advisory.cvss?.vectorString,
            cweIds: vuln.advisory.cwes?.map((x) => x.id),
            epssPercentage: (vuln.advisory.epss?.percentage || 0) * 100,
            epssPercentile: (vuln.advisory.epss?.percentile || 0) * 100,
            publishedAt: new Date(vuln.advisory.publishedAt),
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
        id: 'advisory',
        name: 'Advisory',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: renderAdvisorySummaryCell,
        sortProps: {
          ariaLabelAscending: 'Sorted low to high',
          ariaLabelDescending: 'Sorted high to low',
        },
        width: new ObservableValue(-35),
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
        width: new ObservableValue(-20),
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
        renderCell: renderAdvisorCvssCell,
        sortProps: {
          ariaLabelAscending: 'Sorted low to high',
          ariaLabelDescending: 'Sorted high to low',
        },
        width: new ObservableValue(-10),
      },
      {
        id: 'cwes',
        name: 'CWEs',
        readonly: true,
        renderCell: renderAdvisorCwesCell,
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
        renderCell: renderAdvisorEpssCell,
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
              // Sort on cwes
              (item1: ISecurityAdvisoryTableItem, item2: ISecurityAdvisoryTableItem): number => {
                return item1.cweIds.length - item2.cweIds.length;
              },
              // Sort on epss
              (item1: ISecurityAdvisoryTableItem, item2: ISecurityAdvisoryTableItem): number => {
                return item1.epssPercentage - item2.epssPercentage;
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
          item.severity?.name?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.summary?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.package?.name?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.url?.toLowerCase()?.includes(keyword.toLowerCase()),
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
          <span className="font-weight-heavy text-on-communication-background">{tableItem.severity.name}</span>
        </Pill>
        <div className="secondary-text">
          {tableItem.ghsaId}
          {tableItem.cveId ? ', ' + tableItem.cveId : null}
        </div>
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
    line1: <div className="primary-text">{tableItem.package?.name}</div>,
    line2: <div className="secondary-text">{tableItem.package?.version}</div>,
  });
}

function renderAdvisorCvssCell(
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
      <div className="bolt-table-cell-content">
        <Tooltip text={tableItem.cvssVector}>
          <span>{tableItem.cvssScore} / 10</span>
        </Tooltip>
      </div>
    ),
  });
}

function renderAdvisorCwesCell(
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
        {tableItem.cweIds.map((cwe, index) => (
          <div key={index} className="rhythm-horizontal-4">
            <span>{cwe}; </span>
          </div>
        ))}
      </div>
    ),
  });
}

function renderAdvisorEpssCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ISecurityAdvisoryTableItem>,
  tableItem: ISecurityAdvisoryTableItem,
): JSX.Element {
  return TwoLineTableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    line1: <div className="primary-text">{tableItem.epssPercentage.toFixed(3)}%</div>,
    line2: (
      <div className="secondary-text">
        {tableItem.epssPercentile.toFixed(0)}
        {tableItem.epssPercentile.toOridinal()} percentile
      </div>
    ),
  });
}
