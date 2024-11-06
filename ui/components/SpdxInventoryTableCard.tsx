import * as Path from 'path';
import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { IReadonlyObservableValue, ObservableArray, ObservableValue } from 'azure-devops-ui/Core/Observable';
import { ISimpleTableCell, renderSimpleCell, Table } from 'azure-devops-ui/Table';
import { IFilter } from 'azure-devops-ui/Utilities/Filter';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { ISpdx22Document } from '../models/Spdx22';

interface IInventoryTableItem extends ISimpleTableCell {
  id: string;
  name: string;
  checksum: string;
}

const inventoryTableColumns = [
  {
    id: 'name',
    name: 'File',
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-50),
  },
  {
    id: 'checksum',
    name: 'Checksum (SHA256)',
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-50),
  },
];

interface Props {
  document: ISpdx22Document;
  keywordFilter: IFilter;
}

interface State {
  tableItems: ObservableArray<IInventoryTableItem | IReadonlyObservableValue<IInventoryTableItem | undefined>>;
}

export class SpdxInventoryTableCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      tableItems: new ObservableArray<IInventoryTableItem | IReadonlyObservableValue<IInventoryTableItem | undefined>>(
        new Array(10).fill(new ObservableValue<IInventoryTableItem | undefined>(undefined)),
      ),
    };
  }

  static getDerivedStateFromProps(props: Props): State {
    return {
      tableItems: new ObservableArray<IInventoryTableItem | IReadonlyObservableValue<IInventoryTableItem | undefined>>(
        props.document?.files?.map((x) => {
          return {
            id: x.SPDXID,
            name: Path.normalize(x.fileName),
            checksum: x.checksums.find((c) => c.algorithm === 'SHA256')?.checksumValue || '',
          };
        }),
      ),
    };
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.document !== this.props.document) {
      this.setState(SpdxInventoryTableCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.state?.tableItems?.length) {
      return (
        <ZeroData
          iconProps={{ iconName: 'Cancel' }}
          primaryText="Empty"
          secondaryText="Document contains no packages or files."
          imageAltText=""
        />
      );
    }
    return (
      <Card
        className="flex-grow flex-column bolt-card bolt-table-card bolt-card-white"
        contentProps={{ contentPadding: false }}
      >
        <Table<IInventoryTableItem>
          role="table"
          containerClassName="h-scroll-auto"
          columns={inventoryTableColumns}
          itemProvider={this.state.tableItems}
        />
      </Card>
    );
  }
}
