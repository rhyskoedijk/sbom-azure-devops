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
} from 'azure-devops-ui/Table';
import { FILTER_CHANGE_EVENT, IFilter } from 'azure-devops-ui/Utilities/Filter';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { ISecurityAdvisorySeverity, parseSecurityAdvisory } from '../models/SecurityAdvisory';
import { IPackage, IRelationship, ISpdx22Document } from '../models/Spdx22';

interface IPackageTableItem {
  id: string;
  name: string;
  version: string;
  supplier: string;
  license: string;
  level: string;
  introducedThrough: string[];
  packageManager: string;
  isVulnerable: string;
  securityAdvisories: { id: string; severity: ISecurityAdvisorySeverity; uri: string }[];
}

interface Props {
  document: ISpdx22Document;
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
    const dependsOnRelationships = (props.document?.relationships || []).filter(
      (r) => r.relationshipType === 'DEPENDS_ON',
    );
    const rootPackageId = props.document.documentDescribes?.[0];
    const packages = (props.document?.packages || []).filter((p) => {
      return dependsOnRelationships?.some((r) => r.relatedSpdxElement === p.SPDXID);
    });

    const rawTableItems: IPackageTableItem[] =
      packages.map((x) => {
        const packageManager = x.externalRefs
          ?.find((a) => a.referenceCategory === 'PACKAGE-MANAGER' && a.referenceType === 'purl')
          ?.referenceLocator?.match(/^pkg\:([^\:]+)\//i)?.[1]
          ?.toPascalCase()
          ?.trim();
        const securityAdvisories = x.externalRefs?.filter(
          (a) => a.referenceCategory === 'SECURITY' && a.referenceType === 'advisory',
        );
        const isTopLevel =
          x.SPDXID == rootPackageId ||
          dependsOnRelationships.some(
            (r) =>
              r.spdxElementId == rootPackageId &&
              r.relatedSpdxElement === x.SPDXID &&
              r.relationshipType === 'DEPENDS_ON',
          );
        return {
          id: x.SPDXID,
          name: x.name,
          version: x.versionInfo,
          supplier: x.supplier?.match(/^Organization\:(.*)$/i)?.[1]?.trim() || x.supplier || '',
          license: x.licenseConcluded || x.licenseDeclared || '',
          level: isTopLevel ? 'Top-Level' : 'Transitive',
          introducedThrough: getTransitivePackageChain(x.SPDXID, packages, dependsOnRelationships),
          packageManager: packageManager || '',
          isVulnerable: securityAdvisories?.length || false ? 'Yes' : 'No',
          securityAdvisories: securityAdvisories?.map((a) => {
            const advisory = parseSecurityAdvisory(a);
            return {
              id: advisory.id,
              severity: advisory.severity,
              uri: advisory.url,
            };
          }),
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
        id: 'packageManager',
        name: 'Type',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.packageManager),
        sortProps: {
          ariaLabelAscending: 'Sorted A to Z',
          ariaLabelDescending: 'Sorted Z to A',
        },
        width: new ObservableValue(-5),
      },
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
        width: new ObservableValue(-15),
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
        id: 'level',
        name: 'Level',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.level),
        width: new ObservableValue(-5),
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
        width: new ObservableValue(-25),
      },
      {
        id: 'securityAdvisories',
        name: 'Security Advisories',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: renderPackageSecurityAdvisoriesCell,
        sortProps: {
          ariaLabelAscending: 'Sorted low to high',
          ariaLabelDescending: 'Sorted high to low',
        },
        width: new ObservableValue(-25),
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
              // Sort on package manager
              (item1: IPackageTableItem, item2: IPackageTableItem): number => {
                return item1.packageManager!.localeCompare(item2.packageManager!);
              },
              // Sort on name
              (item1: IPackageTableItem, item2: IPackageTableItem): number => {
                return item1.name!.localeCompare(item2.name!);
              },
              null,
              null,
              // Sort on number of chained packages
              (item1: IPackageTableItem, item2: IPackageTableItem): number => {
                return item1.introducedThrough.length - item2.introducedThrough.length;
              },
              // Sort on number of security advisories
              (item1: IPackageTableItem, item2: IPackageTableItem): number => {
                return item1.securityAdvisories.length - item2.securityAdvisories.length;
              },
              // Sort on license
              (item1: IPackageTableItem, item2: IPackageTableItem): number => {
                return item1.license!.localeCompare(item2.license!);
              },
              // Sort on supplier
              (item1: IPackageTableItem, item2: IPackageTableItem): number => {
                return item1.supplier!.localeCompare(item2.supplier!);
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
          item.packageManager?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.name?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.version?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.securityAdvisories?.some((a) => a.uri?.toLowerCase()?.includes(keyword.toLowerCase())) ||
          item.license?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.supplier?.toLowerCase()?.includes(keyword.toLowerCase()),
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
      this.setState(SpdxPackageTableCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.state?.tableItems?.length) {
      return (
        <ZeroData
          iconProps={{ iconName: 'Package' }}
          primaryText={this.props.filter.getFilterItemValue('keyword') ? 'No Match' : 'No Packages'}
          secondaryText={
            this.props.filter.getFilterItemValue('keyword')
              ? 'Filter does not match any packages.'
              : 'Document does not contain any packages.'
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
        <Table<IPackageTableItem>
          role="table"
          containerClassName="h-scroll-auto"
          columns={this.state.tableColumns}
          itemProvider={this.state.tableItems}
          behaviors={this.state.tableSorting ? [this.state.tableSorting] : undefined}
        />
      </Card>
    );
  }
}

/**
 * Get a summary of the transitive dependency chain for a package.
 * @param packageId The SPDX ID of the package.
 * @param packages The list of packages in the document.
 * @param dependsOnRelationships The list of DEPENDS_ON relationships in the document.
 * @returns An array package names representing the transitive dependency chain.
 */
function getTransitivePackageChain(
  packageId: string,
  packages: IPackage[],
  dependsOnRelationships: IRelationship[],
): string[] {
  const chain: string[] = [];
  let currentId = packageId;
  while (currentId) {
    const relationship = dependsOnRelationships.find((r) => r.relatedSpdxElement === currentId);
    if (!relationship) break;

    const pkg = packages.find((p) => p.SPDXID === relationship.spdxElementId);
    if (!pkg) break;

    chain.unshift(pkg.name);
    currentId = relationship.spdxElementId;
  }

  return chain;
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
          <div key={index} className="rhythm-horizontal-4">
            {index > 0 ? <Icon iconName="ChevronRightSmall" size={IconSize.small} /> : null}
            <span>{pkg}</span>
          </div>
        ))}
      </div>
    ),
  });
}

function renderPackageSecurityAdvisoriesCell(
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
      <div className="bolt-table-cell-content flex-row flex-wrap rhythm-horizontal-8 rhythm-vertical-8">
        {tableItem.securityAdvisories
          .sort((a, b) => b.severity.id - a.severity.id)
          .map((advisory, index) => (
            <div key={index} className="flex-column margin-vertical-8">
              <Pill size={PillSize.compact} variant={PillVariant.colored} color={advisory.severity.color}>
                {advisory.severity.name}
              </Pill>
              <Link
                className="secondary-text bolt-table-link bolt-table-inline-link"
                target="_blank"
                href={advisory.uri}
                excludeTabStop
              >
                {advisory.id}
              </Link>
            </div>
          ))}
      </div>
    ),
  });
}
