import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { IReadonlyObservableValue, ObservableArray, ObservableValue } from 'azure-devops-ui/Core/Observable';
import { Icon, IconSize } from 'azure-devops-ui/Icon';
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
import { FILTER_CHANGE_EVENT, IFilter } from 'azure-devops-ui/Utilities/Filter';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { ISecurityAdvisory, parseSecurityAdvisory } from '../models/SecurityAdvisory';
import { IPackage, IRelationship, ISpdx22Document } from '../models/Spdx22Document';

interface ISecurityAdvisoryTableItem extends ISecurityAdvisory {
  introducedThrough: string[];
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
    const dependsOnRelationships = (props.document?.relationships || []).filter(
      (r) => r.relationshipType === 'DEPENDS_ON',
    );
    const rootPackageId = props.document.documentDescribes?.[0];
    const packages = (props.document?.packages || []).filter((p) => {
      return dependsOnRelationships?.some((r) => r.relatedSpdxElement === p.SPDXID);
    });
    const securityAdvisories = packages.flatMap((p) => {
      return p.externalRefs.filter((r) => r.referenceCategory == 'SECURITY' && r.referenceType == 'advisory') || [];
    });

    const rawTableItems: ISecurityAdvisoryTableItem[] =
      securityAdvisories.map((x) => {
        const securityAdvisory = parseSecurityAdvisory(x, packages);
        const pkg = packages.find(
          (p) => p.name === securityAdvisory.package?.name && p.versionInfo === securityAdvisory.package?.version,
        );
        const isTopLevel =
          pkg?.SPDXID == rootPackageId ||
          dependsOnRelationships.some(
            (r) =>
              r.spdxElementId == rootPackageId &&
              r.relatedSpdxElement === pkg?.SPDXID &&
              r.relationshipType === 'DEPENDS_ON',
          );
        return {
          ...securityAdvisory,
          introducedThrough: getTransitivePackageChain(pkg?.SPDXID || '', packages, props.document.relationships),
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
        width: new ObservableValue(-40),
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
        id: 'affectedVersions',
        name: 'Affected Versions',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.affectedVersions || ''),
        width: new ObservableValue(-10),
      },
      {
        id: 'patchedVersions',
        name: 'Patched Versions',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.patchedVersions || ''),
        width: new ObservableValue(-10),
      },
      {
        id: 'introducedThrough',
        name: 'Introduced Through',
        readonly: true,
        renderCell: renderAdvisoryIntroducedThroughCell,
        width: new ObservableValue(-20),
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
                return item1.severity.id - item2.severity.id;
              },
              // Sort on package
              (item1: ISecurityAdvisoryTableItem, item2: ISecurityAdvisoryTableItem): number => {
                if (!item1.package || !item2.package) return 0;
                return item1.package!.name!.localeCompare(item2.package!.name!);
              },
              null,
              null,
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
        (item) =>
          !keyword ||
          item.id?.toLowerCase()?.includes(keyword.toLowerCase()) ||
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
    if (prevProps.document !== this.props.document) {
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
        <div className="secondary-text">{tableItem.id}</div>
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

function renderAdvisoryIntroducedThroughCell(
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
