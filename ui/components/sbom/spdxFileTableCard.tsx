import * as Path from 'path';
import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { IReadonlyObservableValue, ObservableArray, ObservableValue } from 'azure-devops-ui/Core/Observable';
import {
  ColumnSorting,
  ISimpleTableCell,
  ITableColumn,
  renderSimpleCell,
  sortItems,
  SortOrder,
  Table,
} from 'azure-devops-ui/Table';
import { FILTER_CHANGE_EVENT, IFilter } from 'azure-devops-ui/Utilities/Filter';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { ChecksumAlgorithm, getChecksum } from '../../../shared/spdx/models/2.3/checksum';
import { IDocument } from '../../../shared/spdx/models/2.3/document';
import { IFile } from '../../../shared/spdx/models/2.3/file';

interface IFileTableItem extends ISimpleTableCell {
  id: string;
  name: string;
  checksum: string;
  package: string;
}

interface Props {
  document: IDocument;
  files: IFile[];
  filter: IFilter;
}

interface State {
  tableColumns: ITableColumn<IFileTableItem>[] | undefined;
  tableItems: ObservableArray<IFileTableItem | IReadonlyObservableValue<IFileTableItem | undefined>>;
  tableSorting: ColumnSorting<IFileTableItem> | undefined;
  filterTableItems?: (keywords: string) => void;
}

export class SpdxFileTableCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      tableColumns: undefined,
      tableItems: new ObservableArray<IFileTableItem | IReadonlyObservableValue<IFileTableItem | undefined>>(),
      tableSorting: undefined,
    };
    this.props.filter?.subscribe(() => {
      const keyword = this.props.filter.getFilterItemValue('keyword') as string;
      this.state.filterTableItems?.(keyword);
    }, FILTER_CHANGE_EVENT);
  }

  static getDerivedStateFromProps(props: Props): State {
    const rawTableItems: IFileTableItem[] =
      props.files
        ?.orderBy((file: IFile) => file.SPDXID)
        ?.map((x) => {
          return {
            id: x.SPDXID,
            name: Path.normalize(x.fileName),
            checksum: getChecksum(x.checksums, ChecksumAlgorithm.SHA256) || '',
            package: props.document.packages?.find((p) => p.hasFiles?.includes(x.SPDXID))?.name || '',
          };
        }) || [];

    const tableColumnResize = function onSize(
      event: MouseEvent | KeyboardEvent,
      columnIndex: number,
      width: number,
      column: ITableColumn<IFileTableItem>,
    ) {
      (column.width as ObservableValue<number>).value = width;
    };

    const hasMultipleRootPackages = props.document.documentDescribes.length > 1;
    const tableColumns: ITableColumn<IFileTableItem>[] = [
      ...(hasMultipleRootPackages
        ? [
            {
              id: 'package',
              name: 'Package',
              onSize: tableColumnResize,
              readonly: true,
              renderCell: renderSimpleCell,
              sortProps: {
                ariaLabelAscending: 'Sorted A to Z',
                ariaLabelDescending: 'Sorted Z to A',
              },
              width: new ObservableValue(-15),
            },
          ]
        : []),
      {
        id: 'name',
        name: 'File Name',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: renderSimpleCell,
        sortProps: {
          ariaLabelAscending: 'Sorted A to Z',
          ariaLabelDescending: 'Sorted Z to A',
        },
        width: new ObservableValue(-60),
      },
      {
        id: 'checksum',
        name: 'Checksum (SHA256)',
        onSize: tableColumnResize,
        readonly: true,
        renderCell: renderSimpleCell,
        width: new ObservableValue(-25),
      },
    ];

    const tableItems = new ObservableArray<IFileTableItem | IReadonlyObservableValue<IFileTableItem | undefined>>(
      rawTableItems.slice(),
    );

    const tableSorting = new ColumnSorting<IFileTableItem>(
      (
        columnIndex: number,
        proposedSortOrder: SortOrder,
        event: React.KeyboardEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
      ) => {
        tableItems.splice(
          0,
          tableItems.length,
          ...sortItems<IFileTableItem>(
            columnIndex,
            proposedSortOrder,
            [
              // Sort on package name
              ...(hasMultipleRootPackages
                ? [
                    (item1: IFileTableItem, item2: IFileTableItem): number => {
                      return (item1.package + item1.name).localeCompare(item2.package + item2.name);
                    },
                  ]
                : []),
              // Sort on file name
              (item1: IFileTableItem, item2: IFileTableItem): number => {
                return item1.name!.localeCompare(item2.name!);
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
        (item) =>
          !keyword ||
          item.name?.toLowerCase()?.includes(keyword.toLowerCase()) ||
          item.checksum?.toLowerCase()?.includes(keyword.toLowerCase()),
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
    if (prevProps.document !== this.props.document || prevProps.files !== this.props.files) {
      this.setState(SpdxFileTableCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.state?.tableItems?.length) {
      return (
        <ZeroData
          className="margin-vertical-32"
          iconProps={{ iconName: 'TextDocument' }}
          primaryText={this.props.filter.getFilterItemValue('keyword') ? 'No Match' : 'No Files'}
          secondaryText={
            this.props.filter.getFilterItemValue('keyword')
              ? 'Filter does not match any files.'
              : 'Document does not contain any files.'
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
        <Table<IFileTableItem>
          role="table"
          containerClassName="h-scroll-auto"
          columns={this.state.tableColumns}
          itemProvider={this.state.tableItems}
          virtualize={true}
          behaviors={this.state.tableSorting ? [this.state.tableSorting] : undefined}
        />
      </Card>
    );
  }
}
