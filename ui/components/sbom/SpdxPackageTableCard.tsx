import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { IReadonlyObservableValue, ObservableArray, ObservableValue } from 'azure-devops-ui/Core/Observable';
import { Icon, IconSize } from 'azure-devops-ui/Icon';
import {
  ColumnSorting,
  ITableColumn,
  SimpleTableCell,
  sortItems,
  SortOrder,
  Table,
  TableCell,
} from 'azure-devops-ui/Table';
import { FILTER_CHANGE_EVENT, IFilter } from 'azure-devops-ui/Utilities/Filter';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { ISecurityVulnerability } from '../../../shared/ghsa/ISecurityVulnerability';
import { getSeverityByName } from '../../../shared/models/severity/Severities';
import { getPackageDependsOnChain, getPackageLevelName, IDocument } from '../../../shared/models/spdx/2.3/IDocument';
import {
  ExternalRefCategory,
  ExternalRefSecurityType,
  getExternalRefPackageManagerName,
  getExternalRefPackageManagerUrl,
  parseExternalRefsAs,
} from '../../../shared/models/spdx/2.3/IExternalRef';
import {
  getPackageLicenseExpression,
  getPackageSupplierOrganization,
  IPackage,
} from '../../../shared/models/spdx/2.3/IPackage';
import { parseSpdxSecurityAdvisoriesLegacy } from '../../../shared/spdx/parseSpdxSecurityAdvisoriesLegacy';

import { VulnerabilitiesSummaryBadge } from './VulnerabilitiesSummaryBadge';

interface IPackageTableItem {
  id: string;
  name: string;
  version: string;
  packageManagerName: string;
  packageManagerUrl: string;
  type: string;
  introducedThrough: string[];
  license: string;
  supplier: string;
  vulnerabilityServerityWeighting: number;
  securityAdvisories: ISecurityVulnerability[];
}

interface Props {
  document: IDocument;
  packages: IPackage[];
  filter: IFilter;
}

interface State {
  tableColumns: ITableColumn<IPackageTableItem>[] | undefined;
  tableItems: ObservableArray<IPackageTableItem | IReadonlyObservableValue<IPackageTableItem | undefined>>;
  tableSorting: ColumnSorting<IPackageTableItem> | undefined;
  filterTableItems?: (keywords: string) => void;
}

export class SpdxPackageTableCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      tableColumns: undefined,
      tableItems: new ObservableArray<IPackageTableItem | IReadonlyObservableValue<IPackageTableItem | undefined>>(),
      tableSorting: undefined,
    };
    this.props.filter?.subscribe(() => {
      const keyword = this.props.filter.getFilterItemValue('keyword') as string;
      this.state.filterTableItems?.(keyword);
    }, FILTER_CHANGE_EVENT);
  }

  static getDerivedStateFromProps(props: Props): State {
    const rawTableItems: IPackageTableItem[] =
      props.packages
        ?.orderBy((pkg: IPackage) => pkg.name)
        ?.map((pkg: IPackage) => {
          const securityAdvisories =
            parseExternalRefsAs<ISecurityVulnerability>(
              pkg.externalRefs || [],
              ExternalRefCategory.Security,
              ExternalRefSecurityType.Url,
            ) ||
            parseSpdxSecurityAdvisoriesLegacy(pkg) ||
            [];
          return {
            id: pkg.SPDXID,
            name: pkg.name,
            version: pkg.versionInfo,
            packageManagerName: getExternalRefPackageManagerName(pkg.externalRefs) || '',
            packageManagerUrl: getExternalRefPackageManagerUrl(pkg.externalRefs) || '',
            type: getPackageLevelName(props.document, pkg.SPDXID) || '',
            introducedThrough: getPackageDependsOnChain(props.document, pkg.SPDXID).map((x) => x.name),
            license: getPackageLicenseExpression(pkg) || '',
            supplier: getPackageSupplierOrganization(pkg) || '',
            vulnerabilityServerityWeighting: securityAdvisories.reduce(
              (acc, cur) => acc + 1 * getSeverityByName(cur.advisory.severity).weight,
              0,
            ),
            securityAdvisories: securityAdvisories,
          };
        }) || [];

    const tableColumnResize = function onSize(
      event: MouseEvent | KeyboardEvent,
      columnIndex: number,
      width: number,
      column: ITableColumn<IPackageTableItem>,
    ) {
      (column.width as ObservableValue<number>).value = width;
    };
    const tableColumns: ITableColumn<IPackageTableItem>[] = [
      {
        id: 'name',
        name: 'Name',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.name),
        sortProps: {
          ariaLabelAscending: 'Sorted A to Z',
          ariaLabelDescending: 'Sorted Z to A',
        },
        width: new ObservableValue(-20),
      },
      {
        id: 'version',
        name: 'Version',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.version),
        width: new ObservableValue(-5),
      },
      {
        id: 'packageManagerName',
        name: 'Manager',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.packageManagerName),
        sortProps: {
          ariaLabelAscending: 'Sorted A to Z',
          ariaLabelDescending: 'Sorted Z to A',
        },
        width: new ObservableValue(-7.5),
      },
      {
        id: 'type',
        name: 'Type',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.type),
        sortProps: {
          ariaLabelAscending: 'Sorted low to high',
          ariaLabelDescending: 'Sorted high to low',
        },
        width: new ObservableValue(-7.5),
      },
      {
        id: 'introducedThrough',
        name: 'Introduced Through',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: renderPackageIntroducedThroughCell,
        sortProps: {
          ariaLabelAscending: 'Sorted low to high',
          ariaLabelDescending: 'Sorted high to low',
        },
        width: new ObservableValue(-30),
      },
      {
        id: 'license',
        name: 'License',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.license),
        sortProps: {
          ariaLabelAscending: 'Sorted A to Z',
          ariaLabelDescending: 'Sorted Z to A',
        },
        width: new ObservableValue(-10),
      },
      {
        id: 'supplier',
        name: 'Supplier',
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.supplier),
        sortProps: {
          ariaLabelAscending: 'Sorted A to Z',
          ariaLabelDescending: 'Sorted Z to A',
        },
        width: new ObservableValue(-10),
      },
      {
        id: 'vulnerabilities',
        name: 'Vulnerabilities',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: renderPackageVulnerabilitiesCell,
        sortProps: {
          ariaLabelAscending: 'Sorted low to high',
          ariaLabelDescending: 'Sorted high to low',
        },
        width: new ObservableValue(-10),
      },
    ];

    const tableItems = new ObservableArray<IPackageTableItem | IReadonlyObservableValue<IPackageTableItem | undefined>>(
      rawTableItems.slice(),
    );

    const tableSorting = new ColumnSorting<IPackageTableItem>(
      (
        columnIndex: number,
        proposedSortOrder: SortOrder,
        event: React.KeyboardEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
      ) => {
        tableItems.splice(
          0,
          tableItems.length,
          ...sortItems<IPackageTableItem>(
            columnIndex,
            proposedSortOrder,
            [
              // Sort on name
              (item1: IPackageTableItem, item2: IPackageTableItem): number => {
                return item1.name!.localeCompare(item2.name!);
              },
              null,
              // Sort on package manager
              (item1: IPackageTableItem, item2: IPackageTableItem): number => {
                return item1.packageManagerName!.localeCompare(item2.packageManagerName!);
              },
              // Sort on type
              (item1: IPackageTableItem, item2: IPackageTableItem): number => {
                return item1.type!.localeCompare(item2.type!);
              },
              // Sort on number of chained packages
              (item1: IPackageTableItem, item2: IPackageTableItem): number => {
                return item1.introducedThrough.length - item2.introducedThrough.length;
              },
              // Sort on license
              (item1: IPackageTableItem, item2: IPackageTableItem): number => {
                return item1.license!.localeCompare(item2.license!);
              },
              // Sort on supplier
              (item1: IPackageTableItem, item2: IPackageTableItem): number => {
                return item1.supplier!.localeCompare(item2.supplier!);
              },
              // Sort on number of security advisories
              (item1: IPackageTableItem, item2: IPackageTableItem): number => {
                return item1.vulnerabilityServerityWeighting - item2.vulnerabilityServerityWeighting;
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
          item.name?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.version?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.packageManagerName?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.type?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.license?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.supplier?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.securityAdvisories?.some((v) =>
            v.advisory.identifiers?.some((i) => i.value.toLowerCase().includes(keyword.toLowerCase())),
          ),
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
    if (prevProps.document !== this.props.document || prevProps.packages !== this.props.packages) {
      this.setState(SpdxPackageTableCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.state?.tableItems?.length) {
      return (
        <ZeroData
          className="margin-vertical-32"
          iconProps={{ iconName: 'Package' }}
          primaryText={this.props.filter.getFilterItemValue('keyword') ? 'No Match' : 'No Packages'}
          secondaryText={
            this.props.filter.getFilterItemValue('keyword')
              ? 'Filter does not match any packages.'
              : 'Document does not contain any packages.'
          }
          imageAltText=""
        />
      );
    }
    return (
      <Card
        className="flex-grow flex-column bolt-card bolt-table-card bolt-card-white"
        contentProps={{ contentPadding: false }}
      >
        <Table<IPackageTableItem>
          role="table"
          containerClassName="h-scroll-auto"
          columns={this.state.tableColumns}
          itemProvider={this.state.tableItems}
          behaviors={this.state.tableSorting ? [this.state.tableSorting] : undefined}
          singleClickActivation={true}
          selectRowOnClick={true}
          onActivate={(event, tableRow) => {
            if (tableRow?.data?.packageManagerUrl) {
              window.open(tableRow.data.packageManagerUrl, '_blank');
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
  tableColumn: ITableColumn<IPackageTableItem>,
  tableItemValue: string,
): JSX.Element {
  return SimpleTableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: <span>{tableItemValue}</span>,
  });
}

function renderPackageIntroducedThroughCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<IPackageTableItem>,
  tableItem: IPackageTableItem,
): JSX.Element {
  return TableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: (
      <div className="bolt-table-cell-content flex-row flex-wrap rhythm-horizontal-4">
        {tableItem.introducedThrough.map((pkg, index) => (
          <div key={index} className={'rhythm-horizontal-4' + (index > 0 ? ' secondary-text' : undefined)}>
            {index > 0 ? <Icon size={IconSize.small} iconName="ChevronRightSmall" /> : null}
            <span>{pkg}</span>
          </div>
        ))}
      </div>
    ),
  });
}

function renderPackageVulnerabilitiesCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<IPackageTableItem>,
  tableItem: IPackageTableItem,
): JSX.Element {
  return TableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: <VulnerabilitiesSummaryBadge vulnerabilities={tableItem.securityAdvisories} />,
  });
}
