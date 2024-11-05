import * as React from 'react';

import { ObservableValue } from 'azure-devops-ui/Core/Observable';
import { ISimpleTableCell, renderSimpleCell, Table, TableColumnLayout } from 'azure-devops-ui/Table';
import { ArrayItemProvider } from 'azure-devops-ui/Utilities/Provider';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { IPackage } from '../models/Spdx22';

interface ITableItem extends ISimpleTableCell {
  name: string;
  version: string;
  type: string;
  referencedBy: string;
}

const packageTableColumns = [
  {
    columnLayout: TableColumnLayout.singleLinePrefix,
    id: 'name',
    name: 'Dependency Name',
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-30),
  },
  {
    id: 'version',
    name: 'Version',
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-10),
  },
  {
    columnLayout: TableColumnLayout.none,
    id: 'type',
    name: 'Type',
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-10),
  },
  {
    columnLayout: TableColumnLayout.none,
    id: 'securityAdvisories',
    name: 'Security Advisories',
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-30),
  },
  {
    columnLayout: TableColumnLayout.none,
    id: 'referencedBy',
    name: 'Referenced By Project(s)',
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-50),
  },
];

interface ISbomPackageTableProps {
  packages: IPackage[];
}

export class SbomPackageTable extends React.Component<ISbomPackageTableProps, ISbomPackageTableProps> {
  constructor(props: ISbomPackageTableProps) {
    super(props);
    this.state = props;
  }

  private getPackageTableItems(): ArrayItemProvider<ITableItem> {
    return new ArrayItemProvider<ITableItem>(
      this.state.packages.map((x) => {
        return {
          name: x.name,
          version: x.versionInfo,
          type: 'Unknown',
          securityAdvisories: x.externalRefs
            .filter((a) => a.referenceCategory == 'SECURITY' && a.referenceType == 'advisory')
            .map((a) => a.comment)
            .join(', '),
          referencedBy: '',
        };
      }),
    );
  }

  public render(): JSX.Element {
    if (!this.state?.packages) {
      return (
        <ZeroData
          iconProps={{ iconName: 'Cancel' }}
          primaryText="No Packages Found"
          secondaryText="No packages were found in the SPDX document."
          imageAltText=""
        />
      );
    }
    return (
      <Table
        role="table"
        className="table-example"
        containerClassName="h-scroll-auto"
        columns={packageTableColumns}
        itemProvider={this.getPackageTableItems()}
      />
    );
  }
}
