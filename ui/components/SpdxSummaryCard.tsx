import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { IHeaderCommandBarItem } from 'azure-devops-ui/HeaderCommandBar';
import { IconSize } from 'azure-devops-ui/Icon';

import { ISpdx22Document } from '../models/Spdx22';

interface Props {
  document: ISpdx22Document;
}

interface State {
  commandBarItems: IHeaderCommandBarItem[];
  documentName: string;
  documentSpdxVersion: string;
  documentDataLicense: string;
  documentCreatedOn: Date;
  documentCreatedByOrganisation: string | undefined;
  documentCreatedWithTool: string | undefined;
  documentProperties: { label: string; value: string | number }[];
}

export class SpdxSummaryCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = SpdxSummaryCard.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    const state: State = {
      commandBarItems: SpdxSummaryCard.getCommandBarItems(props.document),
      documentName: props.document.name,
      documentSpdxVersion: props.document.spdxVersion,
      documentDataLicense: props.document.dataLicense,
      documentCreatedOn: new Date(props.document.creationInfo.created),
      documentCreatedByOrganisation: props.document.creationInfo.creators
        .map((c) => c.match(/^Organization\:(.*)$/i)?.[1]?.trim())
        .filter((c) => c)?.[0],
      documentCreatedWithTool: props.document.creationInfo.creators
        .map((c) => c.match(/^Tool\:(.*)$/i)?.[1]?.trim())
        .filter((c) => c)?.[0],
      documentProperties: [],
    };

    state.documentProperties = [
      {
        label: 'Created',
        value: state.documentCreatedOn.toLocaleString(),
      },
      {
        label: 'Organization',
        value: state.documentCreatedByOrganisation || '',
      },
      {
        label: 'Tool',
        value: state.documentCreatedWithTool || '',
      },
      {
        label: 'Format',
        value: state.documentSpdxVersion,
      },
      {
        label: 'Data License',
        value: state.documentDataLicense,
      },
    ];

    return state;
  }

  static getCommandBarItems(document: ISpdx22Document): IHeaderCommandBarItem[] {
    return [
      {
        id: 'downloadSpdx',
        text: 'Download SPDX',
        iconProps: {
          iconName: 'Download',
        },
        important: true,
        onActivate: () => downloadFile(`${document.name}.spdx.json`, 'text/json', JSON.stringify(document, null, 2)),
      },
      {
        id: 'convertXlsx',
        text: 'Convert to XLSX',
        iconProps: {
          iconName: 'ExcelDocument',
        },
        important: false,
        onActivate: () => {
          alert('TODO: Convert to XLSX');
        },
      },
      {
        id: 'convertSvg',
        text: 'Convert to SVG',
        iconProps: {
          iconName: 'GitGraph',
        },
        important: false,
        onActivate: () => {
          alert('TODO: Convert to SVG');
        },
      },
    ];
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.document !== this.props.document) {
      this.setState(SpdxSummaryCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.props?.document) {
      return <div />;
    }
    return (
      <Card
        className="flex-grow bolt-card bolt-card-white"
        titleProps={{ text: this.props.document.name, className: 'margin-vertical-4', ariaLevel: 3 }}
        headerIconProps={{ iconName: 'Certificate', size: IconSize.large }}
        headerCommandBarItems={this.state.commandBarItems}
      >
        <div className="flex-grow flex-row flex-center summary-view body-m">
          {this.state.documentProperties.map((items, index) => (
            <div className="flex-grow flex-column summary-column" key={index}>
              <div className="flex-row secondary-text summary-line-non-link">{items.label}</div>
              <div className="flex-row summary-info flex-center">{items.value}</div>
            </div>
          ))}
        </div>
      </Card>
    );
  }
}

function downloadFile(name: string, type: string, data: string) {
  const blob = new Blob([data], { type: type });
  const elem = window.document.createElement('a');
  elem.href = window.URL.createObjectURL(blob);
  elem.download = name;
  document.body.appendChild(elem);
  elem.click();
  document.body.removeChild(elem);
}
