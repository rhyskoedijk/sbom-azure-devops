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
import { Pill, PillSize, PillVariant } from 'azure-devops-ui/Pill';
import { PillGroup, PillGroupOverflow } from 'azure-devops-ui/PillGroup';

import { ISbomBuildArtifact } from '../../shared/models/ISbomBuildArtifact';
import { ISeverity } from '../../shared/models/securityAdvisory/ISeverity';
import {
  DEFAULT_SECURITY_ADVISORY_SEVERITY,
  SECURITY_ADVISORY_SEVERITIES,
} from '../../shared/models/securityAdvisory/Severities';
import { ExternalRefCategory, ExternalRefSecurityType } from '../../shared/models/spdx/2.3/IExternalRef';
import { convertSpdxToSvgAsync } from '../../shared/spdx/convertSpdxToSvg';
import { convertSpdxToXlsxAsync } from '../../shared/spdx/convertSpdxToXlsx';
import { parseSecurityAdvisoryFromSpdxExternalRef } from '../../shared/spdx/parseSecurityAdvisoryFromSpdxExternalRef';

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
  documentProperties: { label: string; value: string | number }[];
  documentSecurityAdvisoryCountsBySeverity: { severity: ISeverity; count: number }[];
}

export class SbomDocumentHeader extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = SbomDocumentHeader.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    const securityAdvisoryCountsBySeverityName: Record<string, number> = {};
    props.artifact.spdxDocument.packages
      .flatMap((p) =>
        p.externalRefs.filter(
          (r) =>
            r.referenceCategory === ExternalRefCategory.Security &&
            r.referenceType === ExternalRefSecurityType.Advisory,
        ),
      )
      .map((x) => parseSecurityAdvisoryFromSpdxExternalRef(x)?.severity)
      .reduce((acc, severity) => {
        if (severity !== undefined) {
          acc[severity.name] = (acc[severity.name] || 0) + 1;
        }
        return acc;
      }, securityAdvisoryCountsBySeverityName);

    const isDebug = window.location.hostname === 'localhost';
    const state: State = {
      commandBarItems: SbomDocumentHeader.getCommandBarItems(
        props.artifact,
        isDebug ? props.onLoadArtifact : undefined,
      ),
      documentName: props.artifact.spdxDocument.name,
      documentSpdxVersion: props.artifact.spdxDocument.spdxVersion,
      documentDataLicense: props.artifact.spdxDocument.dataLicense,
      documentCreatedOn: new Date(props.artifact.spdxDocument.creationInfo.created),
      documentCreatedByOrganisation: props.artifact.spdxDocument.creationInfo.creators
        .map((c) => c.match(/^Organization\:(.*)$/i)?.[1]?.trim())
        .filter((c) => c)?.[0],
      documentCreatedWithTool: props.artifact.spdxDocument.creationInfo.creators
        .map((c) => c.match(/^Tool\:(.*)$/i)?.[1]?.trim())
        .filter((c) => c)?.[0],
      documentProperties: [],
      documentSecurityAdvisoryCountsBySeverity: Object.keys(securityAdvisoryCountsBySeverityName).map(
        (severityName) => {
          return {
            severity:
              SECURITY_ADVISORY_SEVERITIES.find((s) => s.name === severityName) || DEFAULT_SECURITY_ADVISORY_SEVERITY,
            count: securityAdvisoryCountsBySeverityName[severityName],
          };
        },
      ),
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
                uploadFile('.spdx.json').then((file) => {
                  if (file) {
                    onLoadArtifact(file);
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
              Created by {this.state.documentCreatedByOrganisation} on {this.state.documentCreatedOn.toLocaleString()}{' '}
              using {this.state.documentCreatedWithTool} ({this.state.documentSpdxVersion})
            </div>
            {this.state.documentSecurityAdvisoryCountsBySeverity.length > 0 && (
              <PillGroup className="flex-row margin-top-8" overflow={PillGroupOverflow.wrap}>
                {this.state.documentSecurityAdvisoryCountsBySeverity
                  .sort((a, b) => b.severity.id - a.severity.id)
                  .map((securityAdvisoryGroup) => (
                    <Pill
                      className="margin-right-8"
                      key={securityAdvisoryGroup.severity.id}
                      size={PillSize.compact}
                      variant={PillVariant.colored}
                      color={securityAdvisoryGroup.severity.color}
                    >
                      <span className="font-weight-heavy text-on-communication-background">
                        {securityAdvisoryGroup.severity.name} ({securityAdvisoryGroup.count})
                      </span>
                    </Pill>
                  ))}
              </PillGroup>
            )}
          </HeaderDescription>
        </HeaderTitleArea>
        <HeaderCommandBar items={this.state.commandBarItems} />
      </CustomHeader>
    );
  }
}

function uploadFile(type: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = false;
    input.accept = type;
    input.onchange = () => {
      debugger;
      const files = input.files ? Array.from(input.files) : [];
      resolve(files[0]);
    };
    input.oncancel = () => {
      debugger;
      resolve(undefined);
    };
    input.click();
  });
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
