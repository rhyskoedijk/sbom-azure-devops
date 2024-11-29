import * as React from 'react';

import { Pill, PillSize, PillVariant } from 'azure-devops-ui/Pill';

import { ISecurityVulnerability } from '../../shared/ghsa/ISecurityVulnerability';
import { ISeverity } from '../../shared/models/securityAdvisory/ISeverity';
import {
  DEFAULT_SECURITY_ADVISORY_SEVERITY,
  SECURITY_ADVISORY_SEVERITIES,
} from '../../shared/models/securityAdvisory/Severities';

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
      severitySummary: SECURITY_ADVISORY_SEVERITIES.filter((severity) => severity.id > 0).map((severity) => {
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
              <Pill
                className={`vulnerabilities-summary-badge`}
                size={PillSize.compact}
                variant={PillVariant.colored}
                color={
                  severitySummary.count > 0 ? severitySummary.severity.color : DEFAULT_SECURITY_ADVISORY_SEVERITY.color
                }
              >
                <span className="text-on-communication-background">
                  {severitySummary.count} <span className="font-weight-heavy ">{severitySummary.severity.prefix}</span>
                </span>
              </Pill>
            </div>
          ))}
      </div>
    );
  }
}
