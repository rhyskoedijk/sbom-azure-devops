import * as React from 'react';

import { Button } from 'azure-devops-ui/Button';
import { Card } from 'azure-devops-ui/Card';
import { IReadonlyObservableValue, ObservableArray, ObservableValue } from 'azure-devops-ui/Core/Observable';
import { Link } from 'azure-devops-ui/Link';
import { Observer } from 'azure-devops-ui/Observer';
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

import { IDocument } from '../../../shared/models/spdx/2.3/IDocument';
import { getExternalRefPackageManagerUrl } from '../../../shared/models/spdx/2.3/IExternalRef';
import { getPackageSupplierOrganization } from '../../../shared/models/spdx/2.3/IPackage';

const MAX_PACKAGES_VISIBLE = 3;

interface ISupplierTableItem {
  id: string;
  name: string;
  packagesTotal: number;
  packagesVisible: ObservableValue<number>;
  packages: {
    name: string;
    version: string;
    url?: string;
  }[];
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
            ?.map((p) => {
              return {
                name: p.name || '',
                version: p.versionInfo || '',
                url: getExternalRefPackageManagerUrl(p.externalRefs),
              };
            });
          return {
            id: supplier || '',
            name: supplier || '',
            packagesTotal: packagesFromSupplier.length,
            packagesVisible: new ObservableValue<number>(MAX_PACKAGES_VISIBLE),
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
          renderSimpleValueCell(rowIndex, columnIndex, tableColumn, tableItem.packagesTotal.toString()),
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
                return item1.packagesTotal - item2.packagesTotal;
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
          item.packages?.some((p) => p.name.toLowerCase().includes(keyword.toLowerCase())),
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
      <Observer packagesVisible={tableItem.packagesVisible}>
        {(props: { packagesVisible: number }) => (
          <div className="bolt-table-cell-content flex-row flex-wrap flex-gap-4">
            {tableItem.packages.slice(0, props.packagesVisible).map((pkg, index) => (
              <Link
                key={index}
                className="bolt-table-link bolt-table-link-inline flex-row flex-center"
                href={pkg.url}
                target={pkg.url ? '_blank' : undefined}
                excludeTabStop
              >
                <span>
                  {pkg.name} <span className="secondary-text">{pkg.version}</span>
                </span>
              </Link>
            ))}
            {tableItem.packagesTotal > MAX_PACKAGES_VISIBLE && (
              <Button
                onClick={(e) => {
                  tableItem.packagesVisible.value =
                    props.packagesVisible !== tableItem.packagesTotal ? tableItem.packagesTotal : MAX_PACKAGES_VISIBLE;
                  e.stopPropagation();
                }}
                iconProps={{
                  iconName: props.packagesVisible !== tableItem.packagesTotal ? 'ChevronRight' : 'ChevronLeft',
                }}
                tooltipProps={{
                  text: props.packagesVisible !== tableItem.packagesTotal ? 'Show more packages' : 'Show less packages',
                }}
                text={props.packagesVisible !== tableItem.packagesTotal ? 'More' : 'Less'}
              />
            )}
          </div>
        )}
      </Observer>
    ),
  });
}
