import * as React from 'react';

import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

import { MessageCard, MessageCardSeverity } from 'azure-devops-ui/MessageCard';
import { Spinner } from 'azure-devops-ui/Spinner';

import { IDocument } from '../../../shared/models/spdx/2.3/IDocument';

interface Props {
  document: IDocument;
  loadSvgDocumentAsync: () => Promise<ArrayBuffer>;
}

interface State {
  documentGraphSvgContainerRef?: React.Ref<HTMLDivElement>;
  documentGraphSvgMarkup?: string;
  loadError?: any;
}

export class SpdxRelationshipCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  static getDerivedStateFromProps(props: Props): State {
    return {
      documentGraphSvgContainerRef: React.createRef<HTMLDivElement>(),
    };
  }

  public componentDidMount() {
    this.props.loadSvgDocumentAsync().then(
      (documentSvgMarkup) => {
        this.setState({
          documentGraphSvgMarkup: new TextDecoder().decode(documentSvgMarkup),
        });
      },
      (error) => {
        this.setState({
          loadError: error,
        });
      },
    );
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (
      prevProps.document !== this.props.document ||
      prevProps.loadSvgDocumentAsync !== this.props.loadSvgDocumentAsync
    ) {
      this.setState(SpdxRelationshipCard.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    function setCursor(elementRef: React.Ref<HTMLElement> | undefined, cursorStyle: string) {
      if (elementRef && 'current' in elementRef && elementRef.current) {
        elementRef.current.style.cursor = cursorStyle;
      }
    }

    return this.state.loadError ? (
      <MessageCard severity={MessageCardSeverity.Error}>
        {this.state.loadError.message || 'An error occurred while loading the graph data.'}
      </MessageCard>
    ) : !this.state.documentGraphSvgMarkup ? (
      <Spinner className="margin-vertical-16" label="Loading graph data..." />
    ) : (
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
              dangerouslySetInnerHTML={{ __html: this.state.documentGraphSvgMarkup || '' }}
            />
          </TransformComponent>
        )}
      </TransformWrapper>
    );
  }
}
