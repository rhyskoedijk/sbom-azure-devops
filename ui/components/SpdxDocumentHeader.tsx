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
import { Pill, PillSize, PillVariant } from 'azure-devops-ui/Pill';
import { PillGroup, PillGroupOverflow } from 'azure-devops-ui/PillGroup';

import {
  defaultSecurityAdvisorySeverity,
  ISecurityAdvisorySeverity,
  parseSecurityAdvisory,
  securityAdvisorySeverities,
} from '../models/SecurityAdvisory';
import { ISpdxBuildArtifact } from '../models/SpdxBuildArtifact';
import { downloadSpdxAsJson } from '../utils/SpdxToJson';
import { downloadSpdxAsSvg } from '../utils/SpdxToSvg';
import { downloadSpdxAsXlsx } from '../utils/SpdxToXlsx';

interface Props {
  artifact: ISpdxBuildArtifact;
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
  documentSecurityAdvisoryCountsBySeverity: { severity: ISecurityAdvisorySeverity; count: number }[];
}

export class SpdxDocumentHeader extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = SpdxDocumentHeader.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    const securityAdvisoryCountsBySeverityName: Record<string, number> = {};
    props.artifact.spdxDocument.packages
      .flatMap((p) =>
        p.externalRefs.filter((r) => r.referenceCategory === 'SECURITY' && r.referenceType === 'advisory'),
      )
      .map((x) => parseSecurityAdvisory(x)?.severity)
      .reduce((acc, severity) => {
        if (severity !== undefined) {
          acc[severity.name] = (acc[severity.name] || 0) + 1;
        }
        return acc;
      }, securityAdvisoryCountsBySeverityName);

    const state: State = {
      commandBarItems: SpdxDocumentHeader.getCommandBarItems(props.artifact),
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
              securityAdvisorySeverities.find((s) => s.name === severityName) || defaultSecurityAdvisorySeverity,
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

  static getCommandBarItems(artifact: ISpdxBuildArtifact): IHeaderCommandBarItem[] {
    return [
      {
        id: 'downloadSpdx',
        text: 'Download SPDX',
        iconProps: {
          iconName: 'Download',
        },
        important: true,
        onActivate: () => downloadSpdxAsJson(artifact.spdxDocument),
      },
      {
        id: 'exportXlsx',
        text: 'Export to XLSX',
        iconProps: {
          iconName: 'ExcelDocument',
        },
        important: false,
        onActivate: () => downloadSpdxAsXlsx(artifact.spdxDocument),
      },
      {
        id: 'exportSvg',
        text: 'Export to SVG',
        iconProps: {
          iconName: 'BranchFork2',
        },
        important: false,
        disabled: artifact.svgDocument === undefined,
        onActivate: () => downloadSpdxAsSvg(artifact.spdxDocument, artifact.svgDocument || new ArrayBuffer(0)),
      },
    ];
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.artifact !== this.props.artifact) {
      this.setState(SpdxDocumentHeader.getDerivedStateFromProps(this.props));
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
