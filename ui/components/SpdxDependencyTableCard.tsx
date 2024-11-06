import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { IReadonlyObservableValue, ObservableArray, ObservableValue } from 'azure-devops-ui/Core/Observable';
import { Icon, IconSize } from 'azure-devops-ui/Icon';
import { Link } from 'azure-devops-ui/Link';
import {
  ColumnSorting,
  ITableColumn,
  SimpleTableCell,
  sortItems,
  SortOrder,
  Table,
  TableCell,
} from 'azure-devops-ui/Table';
import { IFilter } from 'azure-devops-ui/Utilities/Filter';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { IPackage, IRelationship, ISpdx22Document } from '../models/Spdx22';

interface IDependencyTableItem {
  id: string;
  name: string;
  version: string;
  supplier: string;
  license: string;
  level: string;
  introducedThrough: string[];
  packageManager: string;
  isVulnerable: string;
  securityAdvisories: { id: string; uri: string }[];
}

const dependencyTableColumns: ITableColumn<IDependencyTableItem>[] = [
  {
    id: 'packageManager',
    name: 'Type',
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
    readonly: true,
    renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
      renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.version),
    width: new ObservableValue(-5),
  },
  {
    id: 'level',
    name: 'Level',
    readonly: true,
    renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
      renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.level),
    sortProps: {
      ariaLabelAscending: 'Sorted A to Z',
      ariaLabelDescending: 'Sorted Z to A',
    },
    width: new ObservableValue(-5),
  },
  {
    id: 'introducedThrough',
    name: 'Introduced Through',
    readonly: true,
    renderCell: renderDependencyIntroducedThroughCell,
    sortProps: {
      ariaLabelAscending: 'Sorted low to high',
      ariaLabelDescending: 'Sorted high to low',
    },
    width: new ObservableValue(-25),
  },
  {
    id: 'securityAdvisories',
    name: 'Security Advisories',
    readonly: true,
    renderCell: renderDependencySecurityAdvisoriesCell,
    sortProps: {
      ariaLabelAscending: 'Sorted low to high',
      ariaLabelDescending: 'Sorted high to low',
    },
    width: new ObservableValue(-25),
  },
  {
    id: 'license',
    name: 'License',
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

interface Props {
  document: ISpdx22Document;
  filter: IFilter;
}

interface State {
  tableItems: ObservableArray<IDependencyTableItem | IReadonlyObservableValue<IDependencyTableItem | undefined>>;
  tableSorting: ColumnSorting<IDependencyTableItem> | undefined;
}

export class SpdxDependencyTableCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      tableItems: new ObservableArray<
        IDependencyTableItem | IReadonlyObservableValue<IDependencyTableItem | undefined>
      >(new Array(10).fill(new ObservableValue<IDependencyTableItem | undefined>(undefined))),
      tableSorting: undefined,
    };
  }

  static getDerivedStateFromProps(props: Props): State {
    const dependsOnRelationships = (props.document?.relationships || []).filter(
      (r) => r.relationshipType === 'DEPENDS_ON',
    );
    const rootPackageId = props.document.documentDescribes[0];
    const packages = (props.document?.packages || []).filter((p) => {
      return dependsOnRelationships?.some((r) => r.relatedSpdxElement === p.SPDXID);
    });

    const rawTableItems = packages.map((x) => {
      const packageManager = x.externalRefs
        ?.find((a) => a.referenceCategory === 'PACKAGE-MANAGER' && a.referenceType === 'purl')
        ?.referenceLocator?.match(/^pkg\:([^\:]+)\//i)?.[1]
        ?.toPascalCase()
        ?.trim();
      const securityAdvisories = x.externalRefs?.filter(
        (a) => a.referenceCategory === 'SECURITY' && a.referenceType === 'advisory',
      );
      const isTopLevel = dependsOnRelationships.some(
        (r) =>
          r.spdxElementId == rootPackageId && r.relatedSpdxElement === x.SPDXID && r.relationshipType === 'DEPENDS_ON',
      );
      return {
        id: x.SPDXID,
        name: x.name,
        version: x.versionInfo,
        supplier: x.supplier?.match(/^Organization\:(.*)$/i)?.[1]?.trim() || x.supplier || '',
        license: x.licenseConcluded || x.licenseDeclared || '',
        level: isTopLevel ? 'Top-Level' : 'Transitive',
        introducedThrough: getTransitiveDependencyChainSummary(x.SPDXID, packages, dependsOnRelationships),
        packageManager: packageManager || '',
        isVulnerable: securityAdvisories?.length || false ? 'Yes' : 'No',
        securityAdvisories: securityAdvisories?.map((a) => {
          return {
            id: a.comment?.match(/CVE-[0-9-]+/i)?.[0] || a.referenceLocator?.match(/GHSA-[0-9a-z-]+/i)?.[0] || '',
            uri: a.referenceLocator,
          };
        }),
      };
    });

    const tableItems = new ObservableArray<
      IDependencyTableItem | IReadonlyObservableValue<IDependencyTableItem | undefined>
    >(rawTableItems);

    const tableSorting = new ColumnSorting<IDependencyTableItem>(
      (
        columnIndex: number,
        proposedSortOrder: SortOrder,
        event: React.KeyboardEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
      ) => {
        tableItems.splice(
          0,
          tableItems.length,
          ...sortItems<IDependencyTableItem>(
            columnIndex,
            proposedSortOrder,
            sortFunctions,
            dependencyTableColumns,
            rawTableItems,
          ),
        );
      },
    );

    return { tableItems, tableSorting };
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.document !== this.props.document) {
      this.setState(SpdxDependencyTableCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.state?.tableItems?.length) {
      return (
        <ZeroData
          iconProps={{ iconName: 'Cancel' }}
          primaryText="Empty"
          secondaryText="Document contains no dependencies."
          imageAltText=""
        />
      );
    }
    // TODO: Render as tree, https://developer.microsoft.com/en-us/azure-devops/components/tree
    return (
      <Card
        className="flex-grow flex-column bolt-card bolt-table-card bolt-card-white"
        contentProps={{ contentPadding: false }}
      >
        <Table<IDependencyTableItem>
          role="table"
          containerClassName="h-scroll-auto"
          columns={dependencyTableColumns}
          itemProvider={this.state.tableItems}
          behaviors={this.state.tableSorting ? [this.state.tableSorting] : undefined}
        />
      </Card>
    );
  }
}

const sortFunctions = [
  // Sort on Name column
  (item1: IDependencyTableItem, item2: IDependencyTableItem): number => {
    return item1.packageManager!.localeCompare(item2.packageManager!);
  },
  // Sort on Age column
  (item1: IDependencyTableItem, item2: IDependencyTableItem): number => {
    return item1.name!.localeCompare(item2.name!);
  },
];

/**
 * Get a summary of the transitive dependency chain for a package.
 * @param packageId The SPDX ID of the package.
 * @param packages The list of packages in the document.
 * @param dependsOnRelationships The list of DEPENDS_ON relationships in the document.
 * @returns An array package names representing the transitive dependency chain.
 */
function getTransitiveDependencyChainSummary(
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

  return ['System.Text.Json', 'Newtonsoft.Json', 'Microsoft.Extensions.Logging'];
}

function renderSimpleValueCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<IDependencyTableItem>,
  tableItemValue: string,
): JSX.Element {
  return SimpleTableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: <span>{tableItemValue}</span>,
  });
}

function renderDependencyIntroducedThroughCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<IDependencyTableItem>,
  tableItem: IDependencyTableItem,
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

function renderDependencySecurityAdvisoriesCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<IDependencyTableItem>,
  tableItem: IDependencyTableItem,
): JSX.Element {
  return TableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: (
      <div className="bolt-table-cell-content flex-row flex-wrap rhythm-horizontal-4">
        {tableItem.securityAdvisories.map((advisory, index) => (
          <Link
            className="secondary-text bolt-table-link bolt-table-inline-link"
            target="_blank"
            href={advisory.uri}
            key={index}
            excludeTabStop
          >
            {advisory.id}
          </Link>
        ))}
      </div>
    ),
  });
}
