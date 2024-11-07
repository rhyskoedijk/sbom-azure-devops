import * as React from 'react';

import { IColor } from 'azure-devops-extension-api';
import { Card } from 'azure-devops-ui/Card';
import { IReadonlyObservableValue, ObservableArray, ObservableValue } from 'azure-devops-ui/Core/Observable';
import { Pill, PillSize, PillVariant } from 'azure-devops-ui/Pill';
import { ColumnSorting, ITableColumn, sortItems, SortOrder, Table, TwoLineTableCell } from 'azure-devops-ui/Table';
import { FILTER_CHANGE_EVENT, IFilter } from 'azure-devops-ui/Utilities/Filter';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { ISpdx22Document } from '../models/Spdx22';

interface ISecurityAdvisorySeverity {
  name: string;
  color: IColor;
}

const securityAdvisorySeverities: ISecurityAdvisorySeverity[] = [
  { name: 'Critical', color: { red: 205, green: 74, blue: 69 } },
  { name: 'High', color: { red: 205, green: 74, blue: 69 } },
  { name: 'Moderate', color: { red: 214, green: 127, blue: 60 } },
  { name: 'Low', color: { red: 0, green: 120, blue: 212 } },
];

interface ISecurityAdvisoryTableItem {
  id: string;
  severity: string;
  summary: string;
  url: string;
  package: { name: string; version: string };
}

interface Props {
  document: ISpdx22Document;
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
    const packages = props.document?.packages || [];
    const securityAdvisories = packages.flatMap((p) => {
      return p.externalRefs.filter((r) => r.referenceCategory == 'SECURITY' && r.referenceType == 'advisory') || [];
    });

    const rawTableItems: ISecurityAdvisoryTableItem[] =
      securityAdvisories.map((x) => {
        const pkg = packages.find((p) => p.externalRefs.includes(x));
        const ghsaId = x.referenceLocator?.match(/GHSA-[0-9a-z-]+/i)?.[0];
        const severity = x.comment?.match(/^\[(\w+)\]/)?.[1]?.toPascalCase();
        const summary = x.comment?.match(/^\[(\w+)\]([^;]*)/)?.[2]?.trim();
        const url = x.referenceLocator;
        return {
          id: ghsaId || '',
          severity: severity || '',
          summary: summary || '',
          url: url,
          package: {
            name: pkg?.name || '',
            version: pkg?.versionInfo || '',
          },
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
        width: new ObservableValue(-65),
      },
      {
        id: 'introducedThrough',
        name: 'Introduced Through',
        readonly: true,
        renderCell: renderAdvisoryIntroducedThroughCell,
        sortProps: {
          ariaLabelAscending: 'Sorted A to Z',
          ariaLabelDescending: 'Sorted Z to A',
        },
        width: new ObservableValue(-30),
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
                const item1Severity = securityAdvisorySeverities.findIndex((x) => x.name === item1.severity);
                const item2Severity = securityAdvisorySeverities.findIndex((x) => x.name === item2.severity);
                return item1Severity - item2Severity;
              },
              // Sort on package name
              (item1: ISecurityAdvisoryTableItem, item2: ISecurityAdvisoryTableItem): number => {
                return item1.package.name!.localeCompare(item2.package.name!);
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
          item.id?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.severity?.toLowerCase()?.includes(keyword.toLowerCase()) ||
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
    if (prevProps.document !== this.props.document) {
      this.setState(SpdxSecurityTableCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.state?.tableItems?.length) {
      return (
        <ZeroData
          iconProps={{ iconName: 'CheckMark' }}
          primaryText="No Security Advisories"
          secondaryText={
            this.props.filter.getFilterItemValue('keyword')
              ? 'Filter does not match any security advisories.'
              : 'Document contains no security advisories.'
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
    line1: <div className="primary-text font-weight-heavy">{tableItem.summary}</div>,
    line2: (
      <div className="flex-row rhythm-horizontal-8">
        <Pill
          size={PillSize.compact}
          variant={PillVariant.colored}
          color={securityAdvisorySeverities.find((x) => x.name === tableItem.severity)?.color}
        >
          {tableItem.severity}
        </Pill>
        <div className="secondary-text">{tableItem.id}</div>
      </div>
    ),
  });
}

function renderAdvisoryIntroducedThroughCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ISecurityAdvisoryTableItem>,
  tableItem: ISecurityAdvisoryTableItem,
): JSX.Element {
  return TwoLineTableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    line1: <div className="primary-text">{tableItem.package.name}</div>,
    line2: <div className="secondary-text">{tableItem.package.version}</div>,
  });
}
