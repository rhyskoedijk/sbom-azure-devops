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
import { MenuItemType } from 'azure-devops-ui/Menu';

import { ISbomBuildArtifact } from '../../../shared/models/sbomBuildArtifact';
import { convertSpdxToSvgAsync } from '../../../shared/spdx/convertSpdxToSvg';
import { convertSpdxToXlsxAsync } from '../../../shared/spdx/convertSpdxToXlsx';
import { getCreatorOrganization, getCreatorTool } from '../../../shared/spdx/models/2.3/creationInfo';

interface Props {
  artifact: ISbomBuildArtifact;
  onLoadArtifacts: (files: File[]) => void;
}

interface State {
  commandBarItems: IHeaderCommandBarItem[];
  documentName: string;
  documentSpdxVersion: string;
  documentDataLicense: string;
  documentCreatedOn: Date;
  documentCreatedByOrganisation: string | undefined;
  documentCreatedWithTool: string | undefined;
}

export class SbomDocumentHeader extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = SbomDocumentHeader.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    const isDebug = window.location.hostname === 'localhost';
    return {
      commandBarItems: SbomDocumentHeader.getCommandBarItems(
        props.artifact,
        isDebug ? props.onLoadArtifacts : undefined,
      ),
      documentName: props.artifact.spdxDocument.name,
      documentSpdxVersion: props.artifact.spdxDocument.spdxVersion,
      documentDataLicense: props.artifact.spdxDocument.dataLicense,
      documentCreatedOn: new Date(props.artifact.spdxDocument.creationInfo.created),
      documentCreatedByOrganisation: getCreatorOrganization(props.artifact.spdxDocument.creationInfo),
      documentCreatedWithTool: getCreatorTool(props.artifact.spdxDocument.creationInfo),
    };
  }

  static getCommandBarItems(
    artifact: ISbomBuildArtifact,
    onLoadArtifacts?: (files: File[]) => void,
  ): IHeaderCommandBarItem[] {
    return [
      {
        id: 'downloadSpdx',
        text: 'Download SPDX',
        iconProps: {
          iconName: 'Download',
        },
        important: true,
        onActivate: () =>
          downloadFile(`${artifact.spdxDocument.name}.spdx.json`, `text/json`, async () => artifact.spdxJsonDocument),
      },
      {
        id: 'exportXlsx',
        text: 'Export to XLSX',
        iconProps: {
          iconName: 'ExcelDocument',
        },
        important: false,
        onActivate: () =>
          downloadFile(
            `${artifact.spdxDocument.name}.spdx.xlsx`,
            `application/octet-stream`,
            async () => await convertSpdxToXlsxAsync(artifact.spdxDocument),
          ),
      },
      {
        id: 'exportSvg',
        text: 'Export to SVG',
        iconProps: {
          iconName: 'FlowChart',
        },
        important: false,
        disabled: artifact.loadSvgDocumentAsync === undefined,
        onActivate: () =>
          downloadFile(
            `${artifact.spdxDocument.name}.spdx.svg`,
            `image/svg+xml`,
            async () =>
              (artifact.loadSvgDocumentAsync && (await artifact.loadSvgDocumentAsync())) ||
              (await convertSpdxToSvgAsync(artifact.spdxDocument)),
          ),
      },
      ...(onLoadArtifacts
        ? [
            {
              id: 'separator',
              itemType: MenuItemType.Divider,
            },
            {
              id: 'uploadSpdx',
              text: 'Upload SPDX',
              iconProps: {
                iconName: 'Upload',
              },
              important: false,
              onActivate: () => {
                uploadFile('.spdx.json').then((files) => {
                  if (files) {
                    onLoadArtifacts(files);
                  }
                });
              },
            },
          ]
        : []),
    ];
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.artifact !== this.props.artifact) {
      this.setState(SbomDocumentHeader.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.props?.artifact) {
      return <div />;
    }
    return (
      <CustomHeader className="bolt-header-with-commandbar">
        <HeaderIcon titleSize={TitleSize.Small} iconProps={{ iconName: 'Certificate', className: 'font-size-xxl' }} />
        <HeaderTitleArea>
          <HeaderTitleRow>
            <HeaderTitle ariaLevel={3} className="text-ellipsis" titleSize={TitleSize.Large}>
              {this.state.documentName}
            </HeaderTitle>
          </HeaderTitleRow>
          <HeaderDescription className="flex-column summary-line summary-line-non-link">
            <div className="secondary-text">
              Created on {this.state.documentCreatedOn.toLocaleString()} by {this.state.documentCreatedByOrganisation}{' '}
              using {this.state.documentCreatedWithTool} ({this.state.documentSpdxVersion})
            </div>
          </HeaderDescription>
        </HeaderTitleArea>
        <HeaderCommandBar items={this.state.commandBarItems} />
      </CustomHeader>
    );
  }
}

function downloadFile(name: string, type: string, dataBuilder: () => Promise<ArrayBuffer>): void {
  dataBuilder().then((data) => {
    const blob = new Blob([data], { type: type });
    const elem = window.document.createElement('a');
    try {
      elem.href = window.URL.createObjectURL(blob);
      elem.download = name;
      document.body.appendChild(elem);
      elem.click();
    } finally {
      document.body.removeChild(elem);
    }
  });
}

function uploadFile(type: string): Promise<File[] | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = type;
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      resolve(files);
    };
    input.oncancel = () => {
      resolve(undefined);
    };
    input.click();
  });
}
