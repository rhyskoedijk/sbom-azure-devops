import * as React from 'react';

import {
  CustomHeader,
  HeaderDescription,
  HeaderIcon,
  HeaderTitle,
  HeaderTitleArea,
  HeaderTitleRow,
  TitleSize,
} from 'azure-devops-ui/Header';
import { HeaderCommandBar, IHeaderCommandBarItem } from 'azure-devops-ui/HeaderCommandBar';

import { ISpdx22Document } from '../models/Spdx22';
import { downloadSpdxAsJson } from '../utils/SpdxToJson';
import { downloadSpdxAsSvg } from '../utils/SpdxToSvg';
import { downloadSpdxAsXlsx } from '../utils/SpdxToXlsx';

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

export class SpdxDocumentHeader extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = SpdxDocumentHeader.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    const state: State = {
      commandBarItems: SpdxDocumentHeader.getCommandBarItems(props.document),
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
        onActivate: () => downloadSpdxAsJson(document),
      },
      {
        id: 'exportXlsx',
        text: 'Export to XLSX',
        iconProps: {
          iconName: 'Export',
        },
        important: false,
        onActivate: () => downloadSpdxAsXlsx(document),
      },
      {
        id: 'exportSvg',
        text: 'Export to SVG',
        iconProps: {
          iconName: 'Export',
        },
        important: false,
        onActivate: () => downloadSpdxAsSvg(document),
      },
    ];
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.document !== this.props.document) {
      this.setState(SpdxDocumentHeader.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.props?.document) {
      return <div />;
    }
    return (
      <CustomHeader className="bolt-header-with-commandbar">
        <HeaderIcon iconProps={{ iconName: 'Certificate', className: 'font-size-xxl' }} />
        <HeaderTitleArea>
          <HeaderTitleRow>
            <HeaderTitle ariaLevel={3} className="text-ellipsis" titleSize={TitleSize.Large}>
              {this.state.documentName}
            </HeaderTitle>
          </HeaderTitleRow>
          <HeaderDescription className="secondary-text">
            Created by {this.state.documentCreatedByOrganisation} on {this.state.documentCreatedOn.toLocaleString()}{' '}
            using {this.state.documentCreatedWithTool} ({this.state.documentSpdxVersion})
          </HeaderDescription>
        </HeaderTitleArea>
        <HeaderCommandBar items={this.state.commandBarItems} />
      </CustomHeader>
    );
  }
}
