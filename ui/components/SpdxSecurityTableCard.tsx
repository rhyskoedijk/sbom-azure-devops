import * as React from 'react';

import { IColor } from 'azure-devops-extension-api';
import { Card } from 'azure-devops-ui/Card';
import { IReadonlyObservableValue, ObservableArray, ObservableValue } from 'azure-devops-ui/Core/Observable';
import { Pill, PillSize, PillVariant } from 'azure-devops-ui/Pill';
import { ITableColumn, Table, TwoLineTableCell } from 'azure-devops-ui/Table';
import { IFilter } from 'azure-devops-ui/Utilities/Filter';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { ISpdx22Document } from '../models/Spdx22';

interface ISecurityAdvisoryTableItem {
  id: string;
  severity: string;
  summary: string;
  url: string;
  package: { name: string; version: string };
}

const securityAdvisoryTableColumns: ITableColumn<ISecurityAdvisoryTableItem>[] = [
  {
    id: 'advisory',
    name: 'Advisory',
    readonly: true,
    renderCell: renderAdvisorySummaryCell,
    sortProps: {
      ariaLabelAscending: 'Sorted low to high',
      ariaLabelDescending: 'Sorted high to low',
    },
    width: new ObservableValue(-65),
  },
  {
    id: 'introducedThrough',
    name: 'Introduced Through',
    readonly: true,
    renderCell: renderAdvisoryIntroducedThroughCell,
    sortProps: {
      ariaLabelAscending: 'Sorted A to Z',
      ariaLabelDescending: 'Sorted Z to A',
    },
    width: new ObservableValue(-30),
  },
];

interface Props {
  document: ISpdx22Document;
  filter: IFilter;
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
          const url = x.referenceLocator;
          return {
            id: cveId || ghsaId || '',
            severity: severity || '',
            summary: summary || '',
            url: url,
            package: { name: pkg?.name || '', version: pkg?.versionInfo || '' },
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
    line1: <div className="primary-text font-weight-heavy">{tableItem.summary}</div>,
    line2: (
      <div className="flex-row rhythm-horizontal-8">
        <Pill
          size={PillSize.compact}
          variant={PillVariant.colored}
          color={getAdvisorySeverityColour(tableItem.severity)}
        >
          {tableItem.severity}
        </Pill>
        <div className="secondary-text">{tableItem.id}</div>
      </div>
    ),
  });
}

function renderAdvisoryIntroducedThroughCell(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ISecurityAdvisoryTableItem>,
  tableItem: ISecurityAdvisoryTableItem,
): JSX.Element {
  return TwoLineTableCell({
    ariaRowIndex: rowIndex,
    columnIndex: columnIndex,
    tableColumn: tableColumn,
    line1: <div className="primary-text">{tableItem.package.name}</div>,
    line2: <div className="secondary-text">{tableItem.package.version}</div>,
  });
}

function getAdvisorySeverityColour(severity: string): IColor {
  switch (severity) {
    case 'Critical':
      return { red: 205, green: 74, blue: 69 };
    case 'High':
      return { red: 205, green: 74, blue: 69 };
    case 'Moderate':
      return { red: 214, green: 127, blue: 60 };
    case 'Low':
      return { red: 0, green: 120, blue: 212 };
    default:
      return { red: 0, green: 120, blue: 212 };
  }
}
