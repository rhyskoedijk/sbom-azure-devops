import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { IReadonlyObservableValue, ObservableArray, ObservableValue } from 'azure-devops-ui/Core/Observable';
import { ISimpleTableCell, renderSimpleCell, Table } from 'azure-devops-ui/Table';
import { IFilter } from 'azure-devops-ui/Utilities/Filter';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { ISpdx22Document } from '../models/Spdx22';

interface ISecurityAdvisoryTableItem extends ISimpleTableCell {
  id: string;
  severity: string;
  summary: string;
  permalink: string;
  introducedThrough: string;
}

const securityAdvisoryTableColumns = [
  {
    id: 'id',
    name: 'ID',
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-10),
  },
  {
    id: 'severity',
    name: 'Severity',
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-5),
  },
  {
    id: 'summary',
    name: 'Summary',
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-55),
  },
  {
    id: 'introducedThrough',
    name: 'Introduced Through',
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-20),
  },
  {
    id: 'permalink',
    name: 'Details',
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-20),
  },
];

interface Props {
  document: ISpdx22Document;
  keywordFilter: IFilter;
}

interface State {
  tableItems: ObservableArray<
    ISecurityAdvisoryTableItem | IReadonlyObservableValue<ISecurityAdvisoryTableItem | undefined>
  >;
}

export class SpdxSecurityTableCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      tableItems: new ObservableArray<
        ISecurityAdvisoryTableItem | IReadonlyObservableValue<ISecurityAdvisoryTableItem | undefined>
      >(new Array(10).fill(new ObservableValue<ISecurityAdvisoryTableItem | undefined>(undefined))),
    };
  }

  static getDerivedStateFromProps(props: Props): State {
    const packages = props.document?.packages || [];
    const securityAdvisories = packages.flatMap((p) => {
      return p.externalRefs.filter((r) => r.referenceCategory == 'SECURITY' && r.referenceType == 'advisory') || [];
    });

    return {
      tableItems: new ObservableArray<
        ISecurityAdvisoryTableItem | IReadonlyObservableValue<ISecurityAdvisoryTableItem | undefined>
      >(
        securityAdvisories.map((x) => {
          const pkg = packages.find((p) => p.externalRefs.includes(x));
          const ghsaId = x.referenceLocator?.match(/GHSA-[0-9a-z-]+/i)?.[0];
          const cveId = x.comment?.match(/CVE-[0-9-]+/i)?.[0];
          const severity = x.comment?.match(/^\[(\w+)\]/)?.[1]?.toPascalCase();
          const summary = x.comment?.match(/^\[(\w+)\](.*);/)?.[2]?.trim();
          const permalink = x.referenceLocator;
          return {
            id: cveId || ghsaId || '',
            severity: severity || '',
            summary: summary || '',
            introducedThrough: pkg ? `${pkg.name} v${pkg.versionInfo}` : '',
            permalink: permalink,
          };
        }),
      ),
    };
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
          iconProps={{ iconName: 'Cancel' }}
          primaryText="Empty"
          secondaryText="Document contains no security advisories."
          imageAltText=""
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
          columns={securityAdvisoryTableColumns}
          itemProvider={this.state.tableItems}
        />
      </Card>
    );
  }
}
