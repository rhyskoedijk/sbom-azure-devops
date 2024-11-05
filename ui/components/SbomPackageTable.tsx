import { ObservableValue } from 'azure-devops-ui/Core/Observable';
import { ISimpleTableCell, renderSimpleCell, Table, TableColumnLayout } from 'azure-devops-ui/Table';
import { ArrayItemProvider } from 'azure-devops-ui/Utilities/Provider';
import * as React from 'react';

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

const packageList = {
  packages: [
    {
      'name': 'Microsoft.Extensions.Configuration.Binder',
      'requirements': [],
      'version': '8.0.0',
      'security-advisories': [],
    },
    {
      'name': 'Microsoft.Extensions.DependencyModel',
      'requirements': [],
      'version': '8.0.0',
      'security-advisories': [],
    },
    {
      'name': 'Microsoft.Extensions.Logging.Abstractions',
      'requirements': [],
      'version': '8.0.0',
      'security-advisories': [],
    },
    {
      'name': 'Microsoft.Extensions.Options',
      'requirements': [],
      'version': '8.0.0',
      'security-advisories': [],
    },
    {
      'name': 'Serilog',
      'requirements': [],
      'version': '3.1.1',
      'security-advisories': [],
    },
    {
      'name': 'Serilog.AspNetCore',
      'requirements': [
        {
          file: '/WebApplicationNetCore/WebApplicationNetCore.csproj',
          groups: ['dependencies'],
          requirement: '8.0.1',
          source: null,
        },
      ],
      'version': '8.0.1',
      'security-advisories': [],
    },
    {
      'name': 'Serilog.Extensions.Hosting',
      'requirements': [],
      'version': '8.0.0',
      'security-advisories': [],
    },
    {
      'name': 'Serilog.Extensions.Logging',
      'requirements': [],
      'version': '8.0.0',
      'security-advisories': [],
    },
    {
      'name': 'Serilog.Formatting.Compact',
      'requirements': [],
      'version': '2.0.0',
      'security-advisories': [],
    },
    {
      'name': 'Serilog.Settings.Configuration',
      'requirements': [],
      'version': '8.0.0',
      'security-advisories': [],
    },
    {
      'name': 'Serilog.Sinks.Console',
      'requirements': [],
      'version': '5.0.0',
      'security-advisories': [],
    },
    {
      'name': 'Serilog.Sinks.Debug',
      'requirements': [],
      'version': '2.0.0',
      'security-advisories': [],
    },
    {
      'name': 'Serilog.Sinks.File',
      'requirements': [],
      'version': '5.0.0',
      'security-advisories': [],
    },
    {
      'name': 'System.Text.Json',
      'requirements': [],
      'version': '8.0.0',
      'security-advisories': [
        {
          id: 'CVE-2021-40444',
          description:
            'System.Text.Json could allow a remote attacker to execute arbitrary code on the system, caused by improper handling of objects in memory. By persuading a victim to open a specially-crafted file, an attacker could exploit this vulnerability to execute arbitrary code on the system.',
        },
      ],
    },
  ],
  files: ['/WebApplicationNetCore/WebApplicationNetCore.csproj', '/WebApplicationNetCore/nuget.config'],
};

const packageTableItems = new ArrayItemProvider<ITableItem>(
  packageList.packages.map((x) => {
    return {
      name: x.name,
      version: x.version,
      type: x.requirements.length > 0 ? 'Top-Level' : 'Transitive',
      securityAdvisories: x['security-advisories'] ? x['security-advisories'].map((a) => a.id).join(', ') : '-',
      referencedBy: x.requirements?.map((r) => r?.file).join(', '),
    };
  }),
);

export class SbomPackageTable extends React.Component<{}, {}> {
  constructor(props: {}) {
    super(props);
  }

  public render(): JSX.Element {
    return (
      <Table
        role="table"
        className="table-example"
        containerClassName="h-scroll-auto"
        columns={packageTableColumns}
        itemProvider={packageTableItems}
      />
    );
  }
}
