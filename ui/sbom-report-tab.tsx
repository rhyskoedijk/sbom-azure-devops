import * as SDK from 'azure-devops-extension-sdk';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { CommonServiceIds, getClient, IProjectPageService } from 'azure-devops-extension-api';
import { BuildServiceIds, IBuildPageDataService } from 'azure-devops-extension-api/Build';
import { MessageCard, MessageCardSeverity } from 'azure-devops-ui/MessageCard';
import { Spinner } from 'azure-devops-ui/Spinner';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import '../shared/extensions/ArrayExtensions';
import '../shared/extensions/StringExtensions';

import { ISbomBuildArtifact } from '../shared/models/ISbomBuildArtifact';
import { IDocument } from '../shared/models/spdx/2.3/IDocument';
import { BuildRestClient } from './clients/BuildRestClient';
import { SbomDocumentPage } from './components/SbomDocumentPage';

import './sbom-report-tab.scss';

const SPDX_JSON_ATTACHMENT_TYPE = 'spdx.json';
const SPDX_XLSX_ATTACHMENT_TYPE = 'spdx.xlsx';
const SPDX_SVG_ATTACHMENT_TYPE = 'spdx.svg';

interface State {
  artifacts: ISbomBuildArtifact[] | undefined;
  loadError: any | undefined;
}

export class Root extends React.Component<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = { artifacts: undefined, loadError: undefined };
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

      // Get the SBOM artifact attachments for the current build
      const buildClient = getClient(BuildRestClient);
      const sbomAttachments = await buildClient.getAttachments(projectId, buildId, SPDX_JSON_ATTACHMENT_TYPE);
      console.info(`Detected ${sbomAttachments.length} SBOM artifact attachment(s) for build ${buildId}`);

      // Download and process each SBOM artifact attachment
      const sbomArtifacts: ISbomBuildArtifact[] = [];
      for (const sbomAttachment of sbomAttachments) {
        try {
          // Extract the attachment identifiers from the url
          // Format: `/{projectId}/_apis/build/builds/{buildId}/{timelineId}/{timelineRecordId}/attachments/{attachmentType}/{attachmentName}`
          // TODO: Change this if/when the DevOps API provides a better way to get the attachment stream
          const spdxUrl = sbomAttachment._links?.self?.href;
          if (!spdxUrl) {
            throw new Error(`Attachment url not found for '${sbomAttachment.name}'`);
          }
          const spdxUrlMatch = spdxUrl.match(
            /([a-f-0-9]*)\/_apis\/build\/builds\/([a-f-0-9]*)\/([a-f-0-9]*)\/([a-f-0-9]*)\/attachments\//i,
          );
          if (!spdxUrlMatch) {
            throw new Error(`Attachment url format not recognized for '${sbomAttachment.name}'`);
          }

          // Download the SPDX document
          const spdxStream = await buildClient.getAttachment(
            spdxUrlMatch[1],
            spdxUrlMatch[2],
            spdxUrlMatch[3],
            spdxUrlMatch[4],
            SPDX_JSON_ATTACHMENT_TYPE,
            sbomAttachment.name,
          );
          if (!spdxStream) {
            throw new Error(`Attachment stream '${sbomAttachment.name}' could not be retrieved`);
          }

          // Parse the SPDX document JSON
          const spdxDocument = JSON.parse(new TextDecoder().decode(spdxStream)) as IDocument;
          if (!spdxDocument) {
            throw new Error(`Attachment stream '${sbomAttachment.name}' could not be parsed as JSON`);
          }

          // Attempt to download the SPDX document XLSX spreadsheet, if available
          let spdxXlsxDocumentStream: ArrayBuffer | undefined;
          try {
            spdxXlsxDocumentStream = await buildClient.getAttachment(
              spdxUrlMatch[1],
              spdxUrlMatch[2],
              spdxUrlMatch[3],
              spdxUrlMatch[4],
              SPDX_XLSX_ATTACHMENT_TYPE,
              sbomAttachment.name.replace(SPDX_JSON_ATTACHMENT_TYPE, SPDX_XLSX_ATTACHMENT_TYPE),
            );
          } catch (error) {
            console.warn(`Unable find SPDX XLSX artifact for '${sbomAttachment.name}'. ${error}`);
          }

          // Attempt to download the SPDX document SVG graph, if available
          let spdxSvgDocumentStream: ArrayBuffer | undefined;
          try {
            spdxSvgDocumentStream = await buildClient.getAttachment(
              spdxUrlMatch[1],
              spdxUrlMatch[2],
              spdxUrlMatch[3],
              spdxUrlMatch[4],
              SPDX_SVG_ATTACHMENT_TYPE,
              sbomAttachment.name.replace(SPDX_JSON_ATTACHMENT_TYPE, SPDX_SVG_ATTACHMENT_TYPE),
            );
          } catch (error) {
            console.warn(`Unable find SPDX SVG artifact for '${sbomAttachment.name}'. ${error}`);
          }

          sbomArtifacts.push({
            spdxDocument: spdxDocument,
            xlsxDocument: spdxXlsxDocumentStream,
            svgDocument: spdxSvgDocumentStream,
          });
        } catch (error) {
          throw new Error(`Unable to parse build attachment '${sbomAttachment.name}'. ${error}`.trim());
        }
      }

      console.info(`Loaded ${Object.keys(sbomArtifacts).length} SBOM artifact(s) for build ${buildId}`);
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
      this.setState({ artifacts: [{ spdxDocument: spdxDocument }], loadError: undefined });
    } catch (error) {
      console.error(error);
      this.setState({ artifacts: undefined, loadError: error });
    }
  }

  public render(): JSX.Element {
    return (
      <div className="flex-grow">
        {this.state.loadError ? (
          <MessageCard severity={MessageCardSeverity.Error}>
            {this.state.loadError.message || 'An error occurred while loading SBOM build artifacts.'}
          </MessageCard>
        ) : !this.state.artifacts ? (
          <Spinner label="Loading SBOM build artifacts..." />
        ) : !this.state.artifacts[0] ? (
          <ZeroData
            iconProps={{ iconName: 'Certificate' }}
            primaryText="Empty"
            secondaryText="Unable to find any SBOM artifacts for this build."
            imageAltText=""
          />
        ) : (
          // TODO: Add support for viewing multiple artifacts in a single build?
          <SbomDocumentPage
            artifact={this.state.artifacts[0]}
            onLoadArtifact={(file) => this.loadSbomArtifactFromFileUpload(file)}
          />
        )}
      </div>
    );
  }
}

ReactDOM.render(<Root />, document.getElementById('root'));
