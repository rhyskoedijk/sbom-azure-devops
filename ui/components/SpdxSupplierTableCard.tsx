import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { IReadonlyObservableValue, ObservableArray, ObservableValue } from 'azure-devops-ui/Core/Observable';
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

import { IDocument } from '../../shared/models/spdx/2.3/IDocument';
import { getPackageSupplierOrganization } from '../../shared/models/spdx/2.3/IPackage';

interface ISupplierTableItem {
  id: string;
  name: string;
  packageCount: number;
  packages: string[];
}

interface Props {
  document: IDocument;
  suppliers: string[];
  filter: IFilter;
}

interface State {
  tableColumns: ITableColumn<ISupplierTableItem>[] | undefined;
  tableItems: ObservableArray<ISupplierTableItem | IReadonlyObservableValue<ISupplierTableItem | undefined>>;
  tableSorting: ColumnSorting<ISupplierTableItem> | undefined;
  filterTableItems?: (keywords: string) => void;
}

export class SpdxSupplierTableCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      tableColumns: undefined,
      tableItems: new ObservableArray<ISupplierTableItem | IReadonlyObservableValue<ISupplierTableItem | undefined>>(),
      tableSorting: undefined,
    };
    this.props.filter?.subscribe(() => {
      const keyword = this.props.filter.getFilterItemValue('keyword') as string;
      this.state.filterTableItems?.(keyword);
    }, FILTER_CHANGE_EVENT);
  }

  static getDerivedStateFromProps(props: Props): State {
    const rawTableItems: ISupplierTableItem[] =
      props.suppliers
        ?.orderBy((supplier: string) => supplier)
        ?.map((supplier: string) => {
          const packagesFromSupplier = props.document.packages
            ?.filter((p) => getPackageSupplierOrganization(p) == supplier)
            ?.map((p) => p.name || '')
            ?.distinct();
          return {
            id: supplier || '',
            name: supplier || '',
            packageCount: packagesFromSupplier.length,
            packages: packagesFromSupplier,
          };
        }) || [];

    const tableColumnResize = function onSize(
      event: MouseEvent | KeyboardEvent,
      columnIndex: number,
      width: number,
      column: ITableColumn<ISupplierTableItem>,
    ) {
      (column.width as ObservableValue<number>).value = width;
    };
    const tableColumns: ITableColumn<ISupplierTableItem>[] = [
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
        width: new ObservableValue(-25),
      },
      {
        id: 'packageCount',
        name: 'Count',
        readonly: true,
        renderCell: (rowIndex, columnIndex, tableColumn, tableItem) =>
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.packageCount.toString()),
        sortProps: {
          ariaLabelAscending: 'Sorted low to high',
          ariaLabelDescending: 'Sorted high to low',
        },
        width: new ObservableValue(-5),
      },
      {
        id: 'packages',
        name: 'Packages',
        readonly: true,
        renderCell: renderPackagesCell,
        width: new ObservableValue(-70),
      },
    ];

    const tableItems = new ObservableArray<
      ISupplierTableItem | IReadonlyObservableValue<ISupplierTableItem | undefined>
    >(rawTableItems.slice());

    const tableSorting = new ColumnSorting<ISupplierTableItem>(
      (
        columnIndex: number,
        proposedSortOrder: SortOrder,
        event: React.KeyboardEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
      ) => {
        tableItems.splice(
          0,
          tableItems.length,
          ...sortItems<ISupplierTableItem>(
            columnIndex,
            proposedSortOrder,
            [
              // Sort on name
              (item1: ISupplierTableItem, item2: ISupplierTableItem): number => {
                return item1.name!.localeCompare(item2.name!);
              },
              // Sort on package count
              (item1: ISupplierTableItem, item2: ISupplierTableItem): number => {
                return item1.packageCount - item2.packageCount;
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
        (item) => !keyword || item.name?.toLowerCase()?.includes(keyword.toLowerCase()),
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
    if (prevProps.document !== this.props.document || prevProps.suppliers !== this.props.suppliers) {
      this.setState(SpdxSupplierTableCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.state?.tableItems?.length) {
      return (
        <ZeroData
          iconProps={{ iconName: 'Info' }}
          primaryText={this.props.filter.getFilterItemValue('keyword') ? 'No Match' : 'No Suppliers'}
          secondaryText={
            this.props.filter.getFilterItemValue('keyword')
              ? 'Filter does not match any suppliers.'
              : 'Document does not contain any supplier information.'
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
        <Table<ISupplierTableItem>
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

function renderSimpleValueCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ISupplierTableItem>,
  tableItemValue: string,
): JSX.Element {
  return SimpleTableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: <span>{tableItemValue}</span>,
  });
}

function renderPackagesCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ISupplierTableItem>,
  tableItem: ISupplierTableItem,
): JSX.Element {
  return TableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    children: (
      <div className="bolt-table-cell-content flex-row flex-wrap flex-gap-4">
        {tableItem.packages.map((pkg, index) => (
          <span key={index}>{pkg}; </span>
        ))}
      </div>
    ),
  });
}
