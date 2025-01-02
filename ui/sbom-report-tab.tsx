import * as SDK from 'azure-devops-extension-sdk';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { CommonServiceIds, getClient, IProjectPageService } from 'azure-devops-extension-api';
import { BuildServiceIds, IBuildPageDataService } from 'azure-devops-extension-api/Build';
import { ObservableValue } from 'azure-devops-ui/Core/Observable';
import { MessageCard, MessageCardSeverity } from 'azure-devops-ui/MessageCard';
import { Observer } from 'azure-devops-ui/Observer';
import { Spinner } from 'azure-devops-ui/Spinner';
import { Tab, TabBar, TabContent, TabSize } from 'azure-devops-ui/Tabs';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import '../shared/extensions/ArrayExtensions';
import '../shared/extensions/NumberExtensions';
import '../shared/extensions/StringExtensions';

import { ISbomBuildArtifact } from '../shared/models/ISbomBuildArtifact';
import { getDisplayNameForDocument, IDocument } from '../shared/models/spdx/2.3/IDocument';
import { BuildRestClient } from './clients/BuildRestClient';
import { SbomDocumentPage } from './components/sbom/SbomDocumentPage';

import './sbom-report-tab.scss';

const SPDX_JSON_ATTACHMENT_TYPE = 'spdx.json';
const SPDX_SVG_ATTACHMENT_TYPE = 'spdx.svg';

interface State {
  artifacts: ISbomBuildArtifact[] | undefined;
  loadError: any | undefined;
}

export class Root extends React.Component<{}, State> {
  private selectedArtifactId: ObservableValue<string>;

  constructor(props: {}) {
    super(props);
    this.state = { artifacts: undefined, loadError: undefined };
    this.selectedArtifactId = new ObservableValue<string>('');
  }

  public componentDidMount() {
    try {
      SDK.init();
      SDK.ready()
        .then(async () => {
          // Load the SBOM artifacts for the current build
          await this.loadSbomArtifactsForCurrentBuild();
        })
        .catch((error) => {
          console.error('SDK ready failed', error);
          this.setState({ artifacts: undefined, loadError: error });
        });
    } catch (error) {
      console.error('Error during SDK initialization', error);
      this.setState({ artifacts: undefined, loadError: error });
    }
  }

  /**
   * Load all SBOM artifacts attached to the current build
   */
  private async loadSbomArtifactsForCurrentBuild(): Promise<void> {
    try {
      console.info('Loading SBOM artifacts for current build...');

      // Get the current page project data
      const projectPageDataService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
      const projectPageData = await projectPageDataService.getProject();
      const projectId = projectPageData?.id;
      if (!projectId) {
        throw new Error('Unable to access the current project data');
      }

      // Get the current page build data
      const buildPageDataService = await SDK.getService<IBuildPageDataService>(BuildServiceIds.BuildPageDataService);
      const buildPageData = await buildPageDataService.getBuildPageData();
      const buildId = buildPageData?.build?.id;
      if (!buildId) {
        throw new Error('Unable to access the current build data');
      }

      // Get all SPDX JSON artifact attachments for the current build
      const buildClient = getClient(BuildRestClient);
      const spdxJsonAttachments = await buildClient.getAttachments(projectId, buildId, SPDX_JSON_ATTACHMENT_TYPE);
      const spdxSvgAttachments = await buildClient.getAttachments(projectId, buildId, SPDX_SVG_ATTACHMENT_TYPE);
      console.info(`Detected ${spdxJsonAttachments.length} SBOM artifact attachment(s) for build ${buildId}`);

      // Download and process each SBOM artifact attachment
      const sbomArtifacts: ISbomBuildArtifact[] = [];
      for (const spdxJsonAttachment of spdxJsonAttachments) {
        try {
          // Extract the attachment identifiers from the url
          // Format: `/{projectId}/_apis/build/builds/{buildId}/{timelineId}/{timelineRecordId}/attachments/{attachmentType}/{attachmentName}`
          // TODO: Change this if/when the DevOps API provides a better way to get the attachment stream
          const spdxUrl = spdxJsonAttachment._links?.self?.href;
          if (!spdxUrl) {
            throw new Error(`Attachment url not found for '${spdxJsonAttachment.name}'`);
          }
          const spdxUrlMatch = spdxUrl.match(
            /([a-f-0-9]*)\/_apis\/build\/builds\/([a-f-0-9]*)\/([a-f-0-9]*)\/([a-f-0-9]*)\/attachments\//i,
          );
          if (!spdxUrlMatch) {
            throw new Error(`Attachment url format not recognized for '${spdxJsonAttachment.name}'`);
          }

          // Download the SPDX document
          const spdxJsonStream = await buildClient.getAttachment(
            spdxUrlMatch[1],
            spdxUrlMatch[2],
            spdxUrlMatch[3],
            spdxUrlMatch[4],
            SPDX_JSON_ATTACHMENT_TYPE,
            spdxJsonAttachment.name,
          );
          if (!spdxJsonStream) {
            throw new Error(`Attachment stream '${spdxJsonAttachment.name}' could not be retrieved`);
          }

          // Parse the SPDX document JSON
          const spdxDocument = JSON.parse(new TextDecoder().decode(spdxJsonStream)) as IDocument;
          if (!spdxDocument) {
            throw new Error(`Attachment stream '${spdxJsonAttachment.name}' could not be parsed as JSON`);
          }

          const hasSvgAttachment = spdxSvgAttachments.find(
            (a) => a.name === spdxJsonAttachment.name.replace(SPDX_JSON_ATTACHMENT_TYPE, SPDX_SVG_ATTACHMENT_TYPE),
          );
          sbomArtifacts.push({
            id: spdxDocument.documentNamespace,
            spdxDocument: spdxDocument,
            spdxJsonDocument: spdxJsonStream,
            loadSvgDocumentAsync: hasSvgAttachment
              ? async () => {
                  // Attempt to download the SPDX document SVG graph, if available
                  // TODO: Remove this once web browser SPDX to SVG generation is implemented
                  return await buildClient.getAttachment(
                    spdxUrlMatch[1],
                    spdxUrlMatch[2],
                    spdxUrlMatch[3],
                    spdxUrlMatch[4],
                    SPDX_SVG_ATTACHMENT_TYPE,
                    spdxJsonAttachment.name.replace(SPDX_JSON_ATTACHMENT_TYPE, SPDX_SVG_ATTACHMENT_TYPE),
                  );
                }
              : undefined,
          });
        } catch (error) {
          throw new Error(`Unable to parse build attachment '${spdxJsonAttachment.name}'. ${error}`.trim());
        }
      }

      console.info(`Loaded ${Object.keys(sbomArtifacts).length} SBOM artifact(s) for build ${buildId}`);
      this.selectedArtifactId.value = sbomArtifacts[0]?.spdxDocument?.documentNamespace || '';
      this.setState({ artifacts: sbomArtifacts, loadError: undefined });
    } catch (error) {
      console.error(error);
      this.setState({ artifacts: undefined, loadError: error });
    }
  }

  /**
   * Load an SBOM artifact uploaded by the user
   * @param file The SPDX JSON file to load
   */
  private async loadSbomArtifactFromFileUpload(file: File): Promise<void> {
    try {
      console.info(`Loading SBOM artifact from '${file.name}'...`);
      const spdxDocument = JSON.parse(new TextDecoder().decode(await file.arrayBuffer())) as IDocument;
      if (!spdxDocument) {
        throw new Error(`File '${file.name}' could not be parsed as JSON`);
      }

      console.info(`Loaded SBOM artifact from '${file.name}'`);
      const newArtifact: ISbomBuildArtifact = {
        id: spdxDocument.documentNamespace,
        spdxDocument: spdxDocument,
        spdxJsonDocument: await file.arrayBuffer(),
      };
      this.selectedArtifactId.value = newArtifact.id;
      this.setState({
        artifacts: [...(this.state.artifacts || []), newArtifact],
        loadError: undefined,
      });
    } catch (error) {
      console.error(error);
      this.setState({ artifacts: this.state.artifacts, loadError: error });
    }
  }

  private onSelectedArtifactTabChanged = (newSpdxId: string) => {
    this.selectedArtifactId.value = newSpdxId;
  };

  public render(): JSX.Element {
    return (
      <div className="flex-grow">
        {this.state.loadError ? (
          <MessageCard severity={MessageCardSeverity.Error}>
            {this.state.loadError.message || 'An error occurred while loading SBOM build artifacts.'}
          </MessageCard>
        ) : !this.state.artifacts ? (
          <Spinner label="Loading SBOM build artifacts..." />
        ) : this.state.artifacts.length == 0 ? (
          <ZeroData
            iconProps={{ iconName: 'Certificate' }}
            primaryText="Empty"
            secondaryText="Unable to find any SBOM artifacts for this build."
            imageAltText=""
          />
        ) : this.state.artifacts.length == 1 ? (
          <SbomDocumentPage
            artifact={this.state.artifacts[0]}
            onLoadArtifact={(file) => this.loadSbomArtifactFromFileUpload(file)}
          />
        ) : (
          <div className="flex flex-column">
            <TabBar
              onSelectedTabChanged={this.onSelectedArtifactTabChanged}
              selectedTabId={this.selectedArtifactId}
              tabSize={TabSize.Compact}
              className="bolt-tabbar-grey margin-bottom-16"
              tabsClassName="flex-wrap flex-shrink"
              disableSticky={true}
            >
              {this.state.artifacts.map((artifact, index) => (
                <Tab key={index} id={artifact.id} name={getDisplayNameForDocument(artifact.spdxDocument)} />
              ))}
            </TabBar>
            <TabContent>
              <Observer selectedArtifactId={this.selectedArtifactId}>
                {(props: { selectedArtifactId: string }) =>
                  props.selectedArtifactId &&
                  this.state.artifacts?.find((artifact) => artifact.id === props.selectedArtifactId) ? (
                    <SbomDocumentPage
                      artifact={this.state.artifacts?.find((artifact) => artifact.id === props.selectedArtifactId)!}
                      onLoadArtifact={(file) => this.loadSbomArtifactFromFileUpload(file)}
                    />
                  ) : (
                    <ZeroData
                      iconProps={{ iconName: 'Certificate' }}
                      primaryText="No document selected"
                      secondaryText="Please select an SBOM build artifact to view its details."
                      imageAltText=""
                    />
                  )
                }
              </Observer>
            </TabContent>
          </div>
        )}
      </div>
    );
  }
}

ReactDOM.render(<Root />, document.getElementById('root'));
