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

import { ISbomBuildArtifact } from '../../../shared/models/ISbomBuildArtifact';
import { getCreatorOrganization, getCreatorTool } from '../../../shared/models/spdx/2.3/ICreationInfo';
import { convertSpdxToSvgAsync } from '../../../shared/spdx/convertSpdxToSvg';
import { convertSpdxToXlsxAsync } from '../../../shared/spdx/convertSpdxToXlsx';

interface Props {
  artifact: ISbomBuildArtifact;
  onLoadArtifact: (file: File) => void;
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
        isDebug ? props.onLoadArtifact : undefined,
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
    onLoadArtifact?: (file: File) => void,
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
          downloadFile(`${artifact.spdxDocument.name}.spdx.json`, `text/json`, async () =>
            new TextEncoder().encode(JSON.stringify(artifact.spdxDocument, null, 2)),
          ),
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
            async () =>
              artifact.xlsxDocument || (await convertSpdxToXlsxAsync(artifact.spdxDocument)) || new ArrayBuffer(0),
          ),
      },
      {
        id: 'exportSvg',
        text: 'Export to SVG',
        iconProps: {
          iconName: 'BranchFork2',
        },
        important: false,
        disabled: artifact.svgDocument === undefined,
        onActivate: () =>
          downloadFile(
            `${artifact.spdxDocument.name}.spdx.svg`,
            `image/svg+xml`,
            async () =>
              artifact.svgDocument || (await convertSpdxToSvgAsync(artifact.spdxDocument)) || new ArrayBuffer(0),
          ),
      },
      ...(onLoadArtifact
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
                    for (const file of files) {
                      onLoadArtifact(file);
                    }
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
