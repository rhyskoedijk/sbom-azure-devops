import * as React from 'react';

import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

import { ObservableValue } from 'azure-devops-ui/Core/Observable';
import { Observer } from 'azure-devops-ui/Observer';
import { Spinner } from 'azure-devops-ui/Spinner';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { IDocument } from '../../../shared/models/spdx/2.3/IDocument';

interface Props {
  document: IDocument;
  loadSvgDocumentAsync: () => Promise<ArrayBuffer>;
}

interface State {
  documentGraphSvgContainerRef?: React.Ref<HTMLDivElement>;
  documentSvgMarkup: ObservableValue<string | undefined>;
  documentIsLoading: ObservableValue<boolean>;
  loadDocumentAsync: () => Promise<void>;
}

export class SpdxRelationshipCard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = SpdxRelationshipCard.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    const state: State = {
      documentGraphSvgContainerRef: React.createRef<HTMLDivElement>(),
      // TODO: Dynamically render the graph if documentGraphSvg is null?
      documentSvgMarkup: new ObservableValue<string | undefined>(undefined),
      documentIsLoading: new ObservableValue(true),
      loadDocumentAsync: () => {
        return props.loadSvgDocumentAsync().then(
          (documentSvgMarkup) => {
            state.documentSvgMarkup.value = new TextDecoder().decode(documentSvgMarkup);
          },
          (error) => {
            state.documentSvgMarkup.value = undefined;
          },
        );
      },
    };

    state.loadDocumentAsync().finally(() => {
      state.documentIsLoading.value = false;
    });

    return state;
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

    return (
      <Observer documentIsLoading={this.state.documentIsLoading} documentSvgMarkup={this.state.documentSvgMarkup}>
        {(props: { documentIsLoading: boolean; documentSvgMarkup: string | undefined }) =>
          props.documentIsLoading ? (
            <Spinner label="Loading graph data..." />
          ) : !this.state.documentSvgMarkup ? (
            <ZeroData
              iconProps={{ iconName: 'BranchFork2' }}
              primaryText="Graph Data Missing"
              secondaryText="Document does not contain graph data."
              imageAltText=""
              className="page-content margin-vertical-20"
            />
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
                    dangerouslySetInnerHTML={{ __html: props.documentSvgMarkup || '' }}
                  />
                </TransformComponent>
              )}
            </TransformWrapper>
          )
        }
      </Observer>
    );
  }
}
