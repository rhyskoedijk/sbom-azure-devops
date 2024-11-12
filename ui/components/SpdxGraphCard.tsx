import * as React from 'react';

import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

import { ZeroData } from 'azure-devops-ui/ZeroData';

import { ISpdx22Document } from '../models/Spdx22';

interface Props {
  document: ISpdx22Document;
}

interface State {
  documentGraphSvgContainerRef?: React.Ref<HTMLDivElement>;
}

export class SpdxGraphCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = SpdxGraphCard.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    return {
      documentGraphSvgContainerRef: React.createRef<HTMLDivElement>(),
    };
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
          iconProps={{ iconName: 'BranchFork2' }}
          primaryText="Graph Data Missing"
          secondaryText="Document does not contain graph data."
          imageAltText=""
          className="page-content margin-vertical-20"
        />
      );
    }

    function setCursor(elementRef: React.Ref<HTMLElement> | undefined, cursorStyle: string) {
      if (elementRef && 'current' in elementRef && elementRef.current) {
        elementRef.current.style.cursor = cursorStyle;
      }
    }

    return (
      <TransformWrapper
        initialScale={1}
        minScale={1}
        maxScale={100}
        centerOnInit={true}
        centerZoomedOut={true}
        wheel={{ activationKeys: ['Control', 'Shift'] }}
        onPanningStart={() => {
          setCursor(this.state.documentGraphSvgContainerRef, 'grabbing');
        }}
        onPanningStop={() => {
          setCursor(this.state.documentGraphSvgContainerRef, 'grab');
        }}
      >
        {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
          <TransformComponent>
            <div
              ref={this.state.documentGraphSvgContainerRef}
              style={{ backgroundColor: 'white', width: '100vw', minHeight: '80vh', cursor: 'grab' }}
              dangerouslySetInnerHTML={{ __html: this.props.document.documentGraphSvg || '' }}
            />
          </TransformComponent>
        )}
      </TransformWrapper>
    );
  }
}
