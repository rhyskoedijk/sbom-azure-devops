import * as React from 'react';

import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

import { ZeroData } from 'azure-devops-ui/ZeroData';

import { IDocument } from '../../shared/models/spdx/2.3/IDocument';

interface Props {
  document: IDocument;
  documentGraphSvg: ArrayBuffer | undefined;
}

interface State {
  documentGraphSvgContainerRef?: React.Ref<HTMLDivElement>;
  documentGraphSvg?: string;
}

export class SpdxGraphCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = SpdxGraphCard.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    return {
      documentGraphSvgContainerRef: React.createRef<HTMLDivElement>(),
      // TODO: Dynamically render the graph if documentGraphSvg is null?
      documentGraphSvg: props.documentGraphSvg ? new TextDecoder().decode(props.documentGraphSvg) : undefined,
    };
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.document !== this.props.document || prevProps.documentGraphSvg !== this.props.documentGraphSvg) {
      this.setState(SpdxGraphCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.state.documentGraphSvg) {
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
              dangerouslySetInnerHTML={{ __html: this.state.documentGraphSvg || '' }}
            />
          </TransformComponent>
        )}
      </TransformWrapper>
    );
  }
}
