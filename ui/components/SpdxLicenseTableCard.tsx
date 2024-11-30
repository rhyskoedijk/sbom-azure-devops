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
} from 'azure-devops-ui/Table';
import { Tooltip } from 'azure-devops-ui/TooltipEx';
import { FILTER_CHANGE_EVENT, IFilter } from 'azure-devops-ui/Utilities/Filter';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { getLicenseRiskAssessment, LicenseRiskSeverity } from '../../shared/ghsa/ILicense';
import { ISeverity } from '../../shared/models/severity/ISeverity';
import { getSeverityByName } from '../../shared/models/severity/Severities';
import { IDocument } from '../../shared/models/spdx/2.3/IDocument';
import { ILicense } from '../../shared/models/spdx/2.3/ILicense';
import { getPackageLicenseExpression } from '../../shared/models/spdx/2.3/IPackage';

interface ILicenseTableItem {
  id: string;
  name: string;
  packageCount: number;
  packages: string[];
  riskSeverity: ISeverity;
  riskReasons: string[];
  url: string;
}

interface Props {
  document: IDocument;
  licenses: ILicense[];
  filter: IFilter;
}

interface State {
  tableColumns: ITableColumn<ILicenseTableItem>[] | undefined;
  tableItems: ObservableArray<ILicenseTableItem | IReadonlyObservableValue<ILicenseTableItem | undefined>>;
  tableSorting: ColumnSorting<ILicenseTableItem> | undefined;
  filterTableItems?: (keywords: string) => void;
}

export class SpdxLicenseTableCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      tableColumns: undefined,
      tableItems: new ObservableArray<ILicenseTableItem | IReadonlyObservableValue<ILicenseTableItem | undefined>>(),
      tableSorting: undefined,
    };
    this.props.filter?.subscribe(() => {
      const keyword = this.props.filter.getFilterItemValue('keyword') as string;
      this.state.filterTableItems?.(keyword);
    }, FILTER_CHANGE_EVENT);
  }

  static getDerivedStateFromProps(props: Props): State {
    const licenses = Array.from(
      new Set(props.document?.packages?.map((p) => p.licenseConcluded || p.licenseDeclared || '')),
    );
    const rawTableItems: ILicenseTableItem[] =
      props.licenses
        ?.orderBy((license: ILicense) => license.licenseId)
        ?.map((license: ILicense) => {
          const packagesWithLicense = props.document.packages
            ?.filter((p) => getPackageLicenseExpression(p)?.includes(license.licenseId))
            ?.map((p) => p.name || '')
            ?.distinct();
          const licenseRisk = getLicenseRiskAssessment(license.licenseId);
          return {
            id: license.licenseId,
            name: license.name,
            packageCount: packagesWithLicense.length,
            packages: packagesWithLicense,
            riskSeverity: getSeverityByName(licenseRisk?.severity || LicenseRiskSeverity.Low),
            riskReasons: licenseRisk?.reasons || [],
            url: license.reference,
          };
        }) || [];

    const tableColumnResize = function onSize(
      event: MouseEvent | KeyboardEvent,
      columnIndex: number,
      width: number,
      column: ITableColumn<ILicenseTableItem>,
    ) {
      (column.width as ObservableValue<number>).value = width;
    };
    const tableColumns: ITableColumn<ILicenseTableItem>[] = [
      {
        id: 'name',
        name: 'Name',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: renderLicenseSummaryCell,
        sortProps: {
          ariaLabelAscending: 'Sorted A to Z',
          ariaLabelDescending: 'Sorted Z to A',
        },
        width: new ObservableValue(-25),
      },
      {
        id: 'packageCount',
        name: 'Count',
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.packageCount.toString()),
        sortProps: {
          ariaLabelAscending: 'Sorted low to high',
          ariaLabelDescending: 'Sorted high to low',
        },
        width: new ObservableValue(-5),
      },
      {
        id: 'packages',
        name: 'Packages',
        readonly: true,
        renderCell: renderPackagesCell,
        width: new ObservableValue(-70),
      },
    ];

    const tableItems = new ObservableArray<ILicenseTableItem | IReadonlyObservableValue<ILicenseTableItem | undefined>>(
      rawTableItems.slice(),
    );

    const tableSorting = new ColumnSorting<ILicenseTableItem>(
      (
        columnIndex: number,
        proposedSortOrder: SortOrder,
        event: React.KeyboardEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
      ) => {
        tableItems.splice(
          0,
          tableItems.length,
          ...sortItems<ILicenseTableItem>(
            columnIndex,
            proposedSortOrder,
            [
              // Sort on name
              (item1: ILicenseTableItem, item2: ILicenseTableItem): number => {
                return item1.name!.localeCompare(item2.name!);
              },
              // Sort on package count
              (item1: ILicenseTableItem, item2: ILicenseTableItem): number => {
                return item1.packageCount - item2.packageCount;
              },
              null,
            ],
            tableColumns,
            rawTableItems,
          ),
        );
      },
    );

    const filterTableItems = (keyword: string) => {
      const filteredItems = rawTableItems.filter(
        (item) => !keyword || item.name?.toLowerCase()?.includes(keyword.toLowerCase()),
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
    if (prevProps.document !== this.props.document || prevProps.licenses !== this.props.licenses) {
      this.setState(SpdxLicenseTableCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.state?.tableItems?.length) {
      return (
        <ZeroData
          iconProps={{ iconName: 'Info' }}
          primaryText={this.props.filter.getFilterItemValue('keyword') ? 'No Match' : 'No License'}
          secondaryText={
            this.props.filter.getFilterItemValue('keyword')
              ? 'Filter does not match any licenses.'
              : 'Document does not contain any license information.'
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
        <Table<ILicenseTableItem>
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
  tableColumn: ITableColumn<ILicenseTableItem>,
  tableItemValue: string,
): JSX.Element {
  return SimpleTableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: <span>{tableItemValue}</span>,
  });
}

function renderLicenseSummaryCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ILicenseTableItem>,
  tableItem: ILicenseTableItem,
): JSX.Element {
  return TableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: (
      <div className="bolt-table-cell-content flex-row rhythm-horizontal-8">
        <div className="primary-text">{tableItem.name}</div>
        {tableItem.riskSeverity.id > 1 ? (
          <Tooltip text={tableItem.riskReasons.join('; ')}>
            <Pill size={PillSize.compact} variant={PillVariant.colored} color={tableItem.riskSeverity.color}>
              <span className="font-weight-heavy text-on-communication-background">
                {tableItem.riskSeverity.name} Risk
              </span>
            </Pill>
          </Tooltip>
        ) : null}
      </div>
    ),
  });
}

function renderPackagesCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ILicenseTableItem>,
  tableItem: ILicenseTableItem,
): JSX.Element {
  return TableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: (
      <div className="bolt-table-cell-content flex-row flex-wrap flex-gap-4">
        {tableItem.packages.map((pkg, index) => (
          <span key={index}>{pkg}; </span>
        ))}
      </div>
    ),
  });
}
