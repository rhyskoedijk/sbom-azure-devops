import * as SDK from 'azure-devops-extension-sdk';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { CommonServiceIds, getClient, IProjectPageService } from 'azure-devops-extension-api';
import { Attachment, BuildServiceIds, IBuildPageDataService } from 'azure-devops-extension-api/Build';
import { ObservableValue } from 'azure-devops-ui/Core/Observable';
import { MessageCard, MessageCardSeverity } from 'azure-devops-ui/MessageCard';
import { Observer } from 'azure-devops-ui/Observer';
import { Spinner } from 'azure-devops-ui/Spinner';
import { Tab, TabContent, TabList, TabSize } from 'azure-devops-ui/Tabs';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { ISbomBuildArtifact } from '../shared/models/sbomBuildArtifact';
import { mergeSpdxDocuments } from '../shared/spdx/mergeSpdxDocuments';
import { getDisplayNameForDocument, IDocument } from '../shared/spdx/models/2.3/document';
import { BuildRestClient } from './clients/azureDevOpsWebApi/build';
import { SbomDocumentPage } from './components/sbom/documentPage';

import '../shared/extensions/array';
import '../shared/extensions/number';
import '../shared/extensions/string';

import './sbom-report-tab.scss';

const SPDX_JSON_ATTACHMENT_TYPE = 'spdx.json';
const SPDX_SVG_ATTACHMENT_TYPE = 'spdx.svg';

interface State {
  build?: {
    id: number;
    name?: string;
    number?: string;
  };
  artifacts?: ISbomBuildArtifact[];
  summaryArtifact?: ISbomBuildArtifact;
  loadingMessage?: string;
  loadError?: any;
}

export class Root extends React.Component<{}, State> {
  private selectedArtifactId: ObservableValue<string>;

  constructor(props: {}) {
    super(props);
    this.state = {};
    this.selectedArtifactId = new ObservableValue<string>('');
  }

  public componentDidMount() {
    try {
      SDK.init();
      SDK.ready().then(
        async () => {
          // Load the SBOM artifacts for the current build
          await this.loadSbomArtifactsFromCurrentBuild();
        },
        (error) => {
          console.error('SDK ready failed', error);
          this.setState({ loadError: error });
        },
      );
    } catch (error) {
      console.error('Error during SDK initialization', error);
      this.setState({ loadError: error });
    }
  }

  /**
   * Load SBOM artifacts attached to the current build
   */
  private async loadSbomArtifactsFromCurrentBuild(): Promise<void> {
    try {
      this.setState({ loadingMessage: 'Finding SBOM artifacts for current build...' });

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
      this.setState({
        build: {
          id: buildId,
          name: (buildPageData.build as any)?.name || buildPageData.definition?.name,
          number: (buildPageData.build as any)?.number || buildPageData.build?.buildNumber,
        },
      });

      // Get all SPDX JSON artifact attached to the current build
      const buildClient = getClient(BuildRestClient);
      const spdxJsonAttachments = await buildClient.getAttachments(projectId, buildId, SPDX_JSON_ATTACHMENT_TYPE);
      const spdxSvgAttachments = await buildClient.getAttachments(projectId, buildId, SPDX_SVG_ATTACHMENT_TYPE);
      console.info(`Found ${spdxJsonAttachments.length} SBOM artifact attachment(s) for build ${buildId}`);

      // Load and parse each artifact
      const sbomArtifacts: ISbomBuildArtifact[] = [];
      const loadedSpdxJsonAttachments = await Promise.all(
        spdxJsonAttachments.map((attachment) => this.getBuildAttachment(buildClient, attachment)),
      );
      for (const spdxJsonAttachment of loadedSpdxJsonAttachments) {
        try {
          this.setState({
            loadingMessage: `Parsing '${spdxJsonAttachment.name}' (${loadedSpdxJsonAttachments.indexOf(spdxJsonAttachment) + 1}/${loadedSpdxJsonAttachments.length})...`,
          });

          // Parse the SPDX document JSON
          const spdxDocument = JSON.parse(new TextDecoder().decode(spdxJsonAttachment.stream)) as IDocument;
          if (!spdxDocument) {
            throw new Error(`Attachment stream '${spdxJsonAttachment.name}' could not be parsed as JSON`);
          }

          // TODO: Remove SVG loading once web browser SPDX to SVG generation is implemented
          const spdxSvgAttachment = spdxSvgAttachments.find(
            (a) => a.name === spdxJsonAttachment.name.replace(SPDX_JSON_ATTACHMENT_TYPE, SPDX_SVG_ATTACHMENT_TYPE),
          );
          const loadSvgDocumentAsync = spdxSvgAttachment
            ? async () => {
                return (await this.getBuildAttachment(buildClient, spdxSvgAttachment))?.stream;
              }
            : undefined;

          // Add the parsed artifact to the list
          sbomArtifacts.push({
            id: spdxDocument.documentNamespace,
            spdxDocument: spdxDocument,
            spdxJsonDocument: spdxJsonAttachment.stream,
            loadSvgDocumentAsync: loadSvgDocumentAsync,
          });
        } catch (error) {
          throw new Error(`Unable to parse build attachment '${spdxJsonAttachment.name}'. ${error}`.trim());
        }
      }

      // Update the state with the loaded SBOM artifacts
      console.info(`Loaded ${Object.keys(sbomArtifacts).length} SBOM artifact(s) for build ${buildId}`);
      this.setState({
        artifacts: sbomArtifacts.orderBy((a) => a.spdxDocument.name),
        loadingMessage: undefined,
        loadError: undefined,
      });

      // Generate a summary SBOM artifact if multiple artifacts were loaded
      this.generateSbomSummaryArtifact();

      // Set the selected artifact to either the summary artifact (if present) or the first manifest artifact
      this.selectedArtifactId.value = this.state?.summaryArtifact
        ? this.state.summaryArtifact.spdxDocument?.documentNamespace || ''
        : sbomArtifacts[0]?.spdxDocument?.documentNamespace || '';
    } catch (error) {
      console.error(error);
      this.setState({ loadError: error });
    }
  }

  /**
   * Load SBOM artifacts uploaded by the user
   * @param files The SPDX JSON files to load
   */
  private async loadSbomArtifactsFromFileUpload(files: File[]): Promise<void> {
    for (const file of files) {
      try {
        // Parse the SPDX JSON file
        console.info(`Parsing SBOM artifact from file upload '${file.name}'...`);
        const spdxJsonStream = await file.arrayBuffer();
        const spdxJsonDocument = JSON.parse(new TextDecoder().decode(spdxJsonStream)) as IDocument;
        if (!spdxJsonDocument) {
          throw new Error(`File '${file.name}' could not be parsed as JSON`);
        }

        console.info(`Loaded SBOM artifact from '${file.name}'`);
        const newArtifact: ISbomBuildArtifact = {
          id: spdxJsonDocument.documentNamespace,
          spdxDocument: spdxJsonDocument,
          spdxJsonDocument: spdxJsonStream,
        };

        // Update the state with the new SBOM artifact
        this.selectedArtifactId.value = newArtifact.id;
        this.setState({
          artifacts: [...(this.state.artifacts || []), newArtifact].orderBy((a) => a.spdxDocument.name),
          loadingMessage: undefined,
          loadError: undefined,
        });

        // Regenerate the summary SBOM artifact, if multiple artifacts are now loaded
        this.generateSbomSummaryArtifact();
      } catch (error) {
        console.error(error);
        this.setState({ loadError: error });
        return;
      }
    }
  }

  /**
   * Download the byte stream of a build attachment
   * @param client The build client
   * @param attachment The attachment to download
   * @returns The name and byte stream of the attachment
   */
  private async getBuildAttachment(
    client: BuildRestClient,
    attachment: Attachment,
  ): Promise<{ name: string; stream: ArrayBuffer }> {
    const attachmentUrl = attachment._links?.self?.href;
    if (!attachmentUrl) {
      throw new Error(`Attachment url not found for '${attachment.name}'`);
    }

    // Extract the attachment identifiers from the url
    // Format: `/{projectId}/_apis/build/builds/{buildId}/{timelineId}/{timelineRecordId}/attachments/{attachmentType}/{attachmentName}`
    // TODO: Change this if/when the DevOps API provides a better way to get the attachment stream
    const attachmentUrlParts = attachmentUrl.match(
      /([a-f-0-9]*)\/_apis\/build\/builds\/([a-f-0-9]*)\/([a-f-0-9]*)\/([a-f-0-9]*)\/attachments\/([^\/]*)\/(.*)/i,
    );
    if (!attachmentUrlParts) {
      throw new Error(`Attachment url format not recognized for '${attachment.name}'`);
    }

    // Download the attachment
    const attachmentStream = await client.getAttachment(
      attachmentUrlParts[1],
      attachmentUrlParts[2],
      attachmentUrlParts[3],
      attachmentUrlParts[4],
      attachmentUrlParts[5],
      attachmentUrlParts[6] || attachment.name,
    );
    if (!attachmentStream) {
      throw new Error(`Attachment stream '${attachment.name}' could not be retrieved`);
    }

    return {
      name: attachment.name,
      stream: attachmentStream,
    };
  }

  /**
   * Merges all SBOM artifacts into a single "summary artifact" document;
   * This allows the user to view all information across all artifacts from a single view
   */
  private generateSbomSummaryArtifact() {
    if (this.state?.artifacts) {
      if (this.state.artifacts.length > 1) {
        const summarisedSpdxDocument = mergeSpdxDocuments(
          this.state.build?.name,
          this.state.build?.number,
          this.state.artifacts.map((a) => a.spdxDocument),
        );
        this.setState({
          summaryArtifact: {
            id: summarisedSpdxDocument.documentNamespace,
            spdxDocument: summarisedSpdxDocument,
            spdxJsonDocument: new TextEncoder().encode(JSON.stringify(summarisedSpdxDocument, null, 2)).buffer,
          },
        });
      }
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
        ) : this.state.loadingMessage ? (
          <Spinner
            className="margin-vertical-32"
            label={this.state.loadingMessage || 'Loading SBOM build artifacts...'}
          />
        ) : (
          this.state.artifacts &&
          (this.state.artifacts.length == 0 ? (
            <ZeroData
              className="margin-vertical-32"
              iconProps={{ iconName: 'Certificate' }}
              primaryText="No artifacts found"
              secondaryText="Unable to find any SBOM artifacts for this build."
              imageAltText=""
            />
          ) : this.state.artifacts.length == 1 ? (
            <SbomDocumentPage
              artifact={this.state.artifacts[0]}
              onLoadArtifacts={(file) => this.loadSbomArtifactsFromFileUpload(file)}
            />
          ) : (
            <div className="flex flex-row">
              <TabList
                onSelectedTabChanged={this.onSelectedArtifactTabChanged}
                selectedTabId={this.selectedArtifactId}
                tabSize={TabSize.Compact}
                className="bolt-tabbar-grey bolt-tabbar-compact flex-shrink"
                tabGroups={[{ id: 'manifests', name: 'Manifests' }]}
              >
                {this.state.summaryArtifact && (
                  <Tab
                    id={this.state.summaryArtifact.id}
                    name="Summary"
                    iconProps={{ iconName: 'ViewDashboard', className: 'margin-right-4' }}
                  />
                )}
                {this.state.artifacts.map((artifact, index) => (
                  <Tab
                    key={index}
                    id={artifact.id}
                    groupId="manifests"
                    name={getDisplayNameForDocument(artifact.spdxDocument)}
                    iconProps={{ iconName: 'Certificate', className: 'margin-right-4' }}
                  />
                ))}
              </TabList>
              <TabContent>
                <Observer selectedArtifactId={this.selectedArtifactId}>
                  {(props: { selectedArtifactId: string }) =>
                    props.selectedArtifactId && this.state.summaryArtifact?.id === props.selectedArtifactId ? (
                      <SbomDocumentPage
                        artifact={this.state.summaryArtifact}
                        onLoadArtifacts={(files) => this.loadSbomArtifactsFromFileUpload(files)}
                      />
                    ) : this.state.artifacts?.find((artifact) => artifact.id === props.selectedArtifactId) ? (
                      <SbomDocumentPage
                        artifact={this.state.artifacts?.find((artifact) => artifact.id === props.selectedArtifactId)!}
                        onLoadArtifacts={(files) => this.loadSbomArtifactsFromFileUpload(files)}
                      />
                    ) : (
                      <ZeroData
                        className="flex-grow margin-vertical-32"
                        iconProps={{ iconName: 'Certificate' }}
                        primaryText="Artifact not found"
                        secondaryText="Unable to find the selected SBOM artifact."
                        imageAltText=""
                      />
                    )
                  }
                </Observer>
              </TabContent>
            </div>
          ))
        )}
      </div>
    );
  }
}

ReactDOM.render(<Root />, document.getElementById('root'));
