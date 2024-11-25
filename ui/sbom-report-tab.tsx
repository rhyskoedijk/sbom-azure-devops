import * as SDK from 'azure-devops-extension-sdk';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { CommonServiceIds, getClient, IProjectPageService } from 'azure-devops-extension-api';
import { BuildServiceIds, IBuildPageDataService } from 'azure-devops-extension-api/Build';
import { MessageCard, MessageCardSeverity } from 'azure-devops-ui/MessageCard';
import { Spinner } from 'azure-devops-ui/Spinner';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { SpdxDocumentPage } from './components/SpdxDocumentPage';
import { ISpdx22Document } from './models/Spdx22Document';
import { ISpdxBuildArtifact } from './models/SpdxBuildArtifact';

import { BuildRestClient } from './utils/BuildRestClient';
import './utils/StringExtensions';

import './sbom-report-tab.scss';

const SPDX_JSON_ATTACHMENT_TYPE = 'spdx.json';
const SPDX_XLSX_ATTACHMENT_TYPE = 'spdx.xlsx';
const SPDX_SVG_ATTACHMENT_TYPE = 'spdx.svg';

interface State {
  artifacts: ISpdxBuildArtifact[] | undefined;
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
          try {
            // Load the SPDX artifacts for the current build
            console.info('SDK is ready, loading SPDX artifacts...');
            const artifacts = await this.getSpdxArtifactAttachmentsForCurrentBuild();
            if (artifacts) {
              this.setState({ artifacts: artifacts, loadError: undefined });
              await SDK.notifyLoadSucceeded();
            } else {
              await SDK.notifyLoadFailed('Unable to load SPDX build artifacts');
            }
          } catch (error) {
            console.log(error);
            this.setState({ artifacts: undefined, loadError: error });
          }
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
   * Get all SPDX artifact attachments for the current build
   * @returns The SPDX build artifacts
   */
  private async getSpdxArtifactAttachmentsForCurrentBuild(): Promise<ISpdxBuildArtifact[]> {
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

    // Get the SPDX artifact attachments for the current build
    const buildClient = getClient(BuildRestClient);
    const spdxAttachments = await buildClient.getAttachments(projectId, buildId, SPDX_JSON_ATTACHMENT_TYPE);
    console.info(`Detected ${spdxAttachments.length} SPDX artifact attachment(s) for build ${buildId}`);

    // Download and process each SPDX artifact attachment
    const spdxArtifacts: ISpdxBuildArtifact[] = [];
    for (const spdxAttachment of spdxAttachments) {
      try {
        // Extract the attachment identifiers from the url
        // Format: `/{projectId}/_apis/build/builds/{buildId}/{timelineId}/{timelineRecordId}/attachments/{attachmentType}/{attachmentName}`
        // TODO: Change this if/when the DevOps API provides a better way to get the attachment stream
        const spdxUrl = spdxAttachment._links?.self?.href;
        if (!spdxUrl) {
          throw new Error(`Attachment url not found for '${spdxAttachment.name}'`);
        }
        const spdxUrlMatch = spdxUrl.match(
          /([a-f-0-9]*)\/_apis\/build\/builds\/([a-f-0-9]*)\/([a-f-0-9]*)\/([a-f-0-9]*)\/attachments\//i,
        );
        if (!spdxUrlMatch) {
          throw new Error(`Attachment url format not recognized for '${spdxAttachment.name}'`);
        }

        // Download the SPDX document
        const spdxStream = await buildClient.getAttachment(
          spdxUrlMatch[1],
          spdxUrlMatch[2],
          spdxUrlMatch[3],
          spdxUrlMatch[4],
          SPDX_JSON_ATTACHMENT_TYPE,
          spdxAttachment.name,
        );
        if (!spdxStream) {
          throw new Error(`Attachment stream '${spdxAttachment.name}' could not be retrieved`);
        }

        // Parse the SPDX document
        const spdxDocument = JSON.parse(new TextDecoder().decode(spdxStream)) as ISpdx22Document;
        if (!spdxDocument) {
          throw new Error(`Attachment stream '${spdxAttachment.name}' could not be parsed as JSON`);
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
            spdxAttachment.name.replace(SPDX_JSON_ATTACHMENT_TYPE, SPDX_XLSX_ATTACHMENT_TYPE),
          );
        } catch (error) {
          console.warn(`Unable find SPDX XLSX artifact for '${spdxAttachment.name}'. ${error}`);
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
            spdxAttachment.name.replace(SPDX_JSON_ATTACHMENT_TYPE, SPDX_SVG_ATTACHMENT_TYPE),
          );
        } catch (error) {
          console.warn(`Unable find SPDX SVG artifact for '${spdxAttachment.name}'. ${error}`);
        }

        spdxArtifacts.push({
          spdxDocument: spdxDocument,
          xlsxDocument: spdxXlsxDocumentStream,
          svgDocument: spdxSvgDocumentStream,
        });
      } catch (error) {
        throw new Error(`Unable to parse build attachment '${spdxAttachment.name}'. ${error}`.trim());
      }
    }

    console.info(`Loaded ${Object.keys(spdxArtifacts).length} SPDX artifact(s) for build ${buildId}`);
    return spdxArtifacts;
  }

  public render(): JSX.Element {
    return (
      <div className="flex-grow">
        {this.state.loadError ? (
          <MessageCard severity={MessageCardSeverity.Error}>
            {this.state.loadError.message || 'An error occurred while loading SPDX build artifacts.'}
          </MessageCard>
        ) : !this.state.artifacts ? (
          <Spinner label="Loading SPDX build artifacts..." />
        ) : !this.state.artifacts[0] ? (
          <ZeroData
            iconProps={{ iconName: 'Certificate' }}
            primaryText="Empty"
            secondaryText="Unable to find any SPDX artifacts for this build."
            imageAltText=""
          />
        ) : (
          // TODO: Add support for multiple artifacts in a single build?
          <SpdxDocumentPage artifact={this.state.artifacts[0]} />
        )}
      </div>
    );
  }
}

ReactDOM.render(<Root />, document.getElementById('root'));
