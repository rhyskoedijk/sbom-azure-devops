import * as React from 'react';

import { Pill, PillSize, PillVariant } from 'azure-devops-ui/Pill';
import { Tooltip } from 'azure-devops-ui/TooltipEx';

import { ISecurityVulnerability } from '../../shared/ghsa/ISecurityVulnerability';
import { ISeverity } from '../../shared/models/severity/ISeverity';
import { DEFAULT_SEVERITY, SEVERITIES } from '../../shared/models/severity/Severities';

import './VulnerabilitiesSummaryBadge.scss';

interface Props {
  vulnerabilities: ISecurityVulnerability[];
}

interface State {
  severitySummary: {
    severity: ISeverity;
    count: number;
  }[];
}

export class VulnerabilitiesSummaryBadge extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = VulnerabilitiesSummaryBadge.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    return {
      severitySummary: SEVERITIES.filter((severity) => severity.id > 0).map((severity) => {
        return {
          severity,
          count:
            props.vulnerabilities
              .map((x: ISecurityVulnerability) => x.advisory.severity.toUpperCase())
              .filter((x: string) => x === severity.name.toUpperCase()).length || 0,
        };
      }),
    };
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.vulnerabilities !== this.props.vulnerabilities) {
      this.setState(VulnerabilitiesSummaryBadge.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    return (
      <div className="flex-row flex-wrap flex-gap-4">
        {this.state.severitySummary
          .sort((a, b) => b.severity.id - a.severity.id)
          .map((severitySummary, index) => (
            <div key={index}>
              <Tooltip
                text={`${severitySummary.count} ${severitySummary.severity.name.toLowerCase()} severity ${severitySummary.count == 1 ? 'vulnerability' : 'vulnerabilities'}`}
              >
                <Pill
                  className={`vulnerabilities-summary-badge`}
                  size={PillSize.compact}
                  variant={PillVariant.colored}
                  color={severitySummary.count > 0 ? severitySummary.severity.color : DEFAULT_SEVERITY.color}
                >
                  <span className="text-on-communication-background">
                    {severitySummary.count}{' '}
                    <span className="font-weight-heavy ">{severitySummary.severity.prefix}</span>
                  </span>
                </Pill>
              </Tooltip>
            </div>
          ))}
      </div>
    );
  }
}
