import * as React from 'react';

import { ZeroData } from 'azure-devops-ui/ZeroData';

import { ISpdx22Document } from '../models/Spdx22';

interface Props {
  document: ISpdx22Document;
}

interface State {}

export class SpdxGraphCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  static getDerivedStateFromProps(props: Props): State {
    return {};
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.document !== this.props.document) {
      this.setState(SpdxGraphCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.props?.document?.documentGraphSvg) {
      return (
        <ZeroData
          iconProps={{ iconName: 'GitGraph' }}
          primaryText="Generating Graph"
          secondaryText="Please wait while the graph is generated..."
          imageAltText=""
          className="margin-vertical-20"
        />
      );
    }
    return (
      // TODO Use SVG viewer, https://github.com/chrvadala/react-svg-pan-zoom/tree/main
      <div
        className="flex-grow"
        style={{ backgroundColor: 'white' }}
        dangerouslySetInnerHTML={{ __html: this.props.document.documentGraphSvg }}
      />
    );
  }
}
