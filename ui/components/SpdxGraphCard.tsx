import * as React from 'react';

import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

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
      <TransformWrapper
        initialScale={1}
        minScale={1}
        maxScale={30}
        centerOnInit={true}
        centerZoomedOut={true}
        wheel={{ activationKeys: ['Control', 'Shift'] }}
      >
        <TransformComponent>
          <div
            style={{ backgroundColor: 'white', width: '100vw', minHeight: '80vh' }}
            dangerouslySetInnerHTML={{ __html: this.props.document.documentGraphSvg || '' }}
          />
        </TransformComponent>
      </TransformWrapper>
    );
  }
}
