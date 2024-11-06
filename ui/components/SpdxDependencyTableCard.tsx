import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { IReadonlyObservableValue, ObservableArray, ObservableValue } from 'azure-devops-ui/Core/Observable';
import { ITableColumn, SimpleTableCell, Table, TableCell } from 'azure-devops-ui/Table';
import { IFilter } from 'azure-devops-ui/Utilities/Filter';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { Link } from 'azure-devops-ui/Link';
import { IPackage, IRelationship, ISpdx22Document } from '../models/Spdx22';

interface IDependencyTableItem {
  id: string;
  name: string;
  version: string;
  supplier: string;
  license: string;
  level: string;
  introducedThrough: string;
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
      renderSimpleValue(columnIndex, tableColumn, tableItem.packageManager),
    width: new ObservableValue(-5),
  },
  {
    id: 'name',
    name: 'Name',
    readonly: true,
    renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
      renderSimpleValue(columnIndex, tableColumn, tableItem.name),
    width: new ObservableValue(-15),
  },
  {
    id: 'version',
    name: 'Version',
    readonly: true,
    renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
      renderSimpleValue(columnIndex, tableColumn, tableItem.version),
    width: new ObservableValue(-5),
  },
  {
    id: 'supplier',
    name: 'Supplier',
    readonly: true,
    renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
      renderSimpleValue(columnIndex, tableColumn, tableItem.supplier),
    width: new ObservableValue(-10),
  },
  {
    id: 'liense',
    name: 'License',
    readonly: true,
    renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
      renderSimpleValue(columnIndex, tableColumn, tableItem.license),
    width: new ObservableValue(-10),
  },
  {
    id: 'level',
    name: 'Level',
    readonly: true,
    renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
      renderSimpleValue(columnIndex, tableColumn, tableItem.level),
    width: new ObservableValue(-5),
  },
  {
    id: 'introducedThrough',
    name: 'Introduced Through',
    readonly: true,
    renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
      renderSimpleValue(columnIndex, tableColumn, tableItem.introducedThrough),
    width: new ObservableValue(-25),
  },
  {
    id: 'securityAdvisories',
    name: 'Security Advisories',
    readonly: true,
    renderCell: renderSecurityAdvisories,
    width: new ObservableValue(-25),
  },
];

interface Props {
  document: ISpdx22Document;
  keywordFilter: IFilter;
}

interface State {
  tableItems: ObservableArray<IDependencyTableItem | IReadonlyObservableValue<IDependencyTableItem | undefined>>;
}

export class SpdxDependencyTableCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      tableItems: new ObservableArray<
        IDependencyTableItem | IReadonlyObservableValue<IDependencyTableItem | undefined>
      >(new Array(10).fill(new ObservableValue<IDependencyTableItem | undefined>(undefined))),
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

    return {
      tableItems: new ObservableArray<
        IDependencyTableItem | IReadonlyObservableValue<IDependencyTableItem | undefined>
      >(
        packages.map((x) => {
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
        }),
      ),
    };
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
 * @returns A string summarizing the transitive dependency chain.
 */
function getTransitiveDependencyChainSummary(
  packageId: string,
  packages: IPackage[],
  dependsOnRelationships: IRelationship[],
): string {
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

  return chain.join(' > ');
}

function renderSimpleValue(
  columnIndex: number,
  tableColumn: ITableColumn<IDependencyTableItem>,
  tableItemValue: string,
): JSX.Element {
  return SimpleTableCell({
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: <span>{tableItemValue}</span>,
  });
}

function renderSecurityAdvisories(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<IDependencyTableItem>,
  tableItem: IDependencyTableItem,
): JSX.Element {
  return TableCell({
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: tableItem.securityAdvisories.map((a) => (
      <Link
        className="secondary-text bolt-table-link bolt-table-inline-link"
        target="_blank"
        href={a.uri}
        excludeTabStop
      >
        {a.id}
      </Link>
    )),
  });
}
