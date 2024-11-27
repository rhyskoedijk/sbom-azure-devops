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

import { ISbomBuildArtifact } from '../../shared/models/ISbomBuildArtifact';
import { ISeverity } from '../../shared/models/securityAdvisory/ISeverity';
import {
  DEFAULT_SECURITY_ADVISORY_SEVERITY,
  SECURITY_ADVISORY_SEVERITIES,
} from '../../shared/models/securityAdvisory/Severities';
import { ExternalRefCategory, ExternalRefSecurityType } from '../../shared/models/spdx/2.3/IExternalRef';
import { downloadSpdxAsJson } from '../../shared/utils/downloadSpdxAsJson';
import { downloadSpdxAsSvg } from '../../shared/utils/downloadSpdxAsSvg';
import { downloadSpdxAsXlsx } from '../../shared/utils/downloadSpdxAsXlsx';
import { parseSecurityAdvisoryFromSpdxExternalRef } from '../../shared/utils/parseSecurityAdvisoryFromSpdxExternalRef';

interface Props {
  artifact: ISbomBuildArtifact;
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

    const state: State = {
      commandBarItems: SbomDocumentHeader.getCommandBarItems(props.artifact),
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

  static getCommandBarItems(artifact: ISbomBuildArtifact): IHeaderCommandBarItem[] {
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
