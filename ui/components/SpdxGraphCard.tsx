import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { ISpdx22Document } from '../models/Spdx22';

interface Props {
  document: ISpdx22Document;
}

interface State {
  documentSvg: string | undefined;
}

export class SpdxGraphCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      documentSvg: undefined,
    };
  }

  static getDerivedStateFromProps(props: Props): State {
    alert('TODO: Implement SVG generation');
    return {
      documentSvg: undefined,
    };
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.document !== this.props.document) {
      this.setState(SpdxGraphCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.state?.documentSvg) {
      return (
        <ZeroData
          iconProps={{ iconName: 'GitGraph' }}
          primaryText="Generating Graph"
          secondaryText="Please wait while the graph is generated..."
          imageAltText=""
        />
      );
    }
    return (
      <Card
        className="flex-grow flex-column bolt-card bolt-table-card bolt-card-white"
        contentProps={{ contentPadding: false }}
      >
        <svg>{this.state.documentSvg}</svg>
      </Card>
    );
  }
}