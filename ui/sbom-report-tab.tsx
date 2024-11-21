import * as SDK from 'azure-devops-extension-sdk';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { CommonServiceIds, getClient, IProjectPageService } from 'azure-devops-extension-api';
import { BuildServiceIds, IBuildPageDataService } from 'azure-devops-extension-api/Build';
import { Spinner } from 'azure-devops-ui/Spinner';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { SpdxDocumentPage } from './components/SpdxDocumentPage';
import { ISpdx22Document } from './models/Spdx22';

import { BuildRestClient } from './utils/BuildRestClient';
import './utils/StringExtensions';

import './sbom-report-tab.scss';

const SPDX_ATTACHMENT_TYPE = 'spdx.json';
const SPDX_GRAPH_ATTACHMENT_TYPE = 'spdx.svg';

interface State {
  documents: ISpdx22Document[] | undefined;
}

export class Root extends React.Component<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = { documents: undefined };
  }

  public componentDidMount() {
    try {
      console.info('Initializing SDK...');
      SDK.init();
      SDK.ready()
        .then(async () => {
          console.info('SDK is ready');

          // Load the SPDX documents for the current build
          const documents = await this.getSpdxDocumentAttachmentsForCurrentBuild();
          if (documents) {
            this.setState({ documents: documents });
            await SDK.notifyLoadSucceeded();
          } else {
            await SDK.notifyLoadFailed('Unable to load SPDX documents');
          }
        })
        .catch((error) => {
          console.error('SDK ready failed', error);
        });
    } catch (error) {
      console.error('Error during SDK initialization', error);
    }
  }

  /**
   * Get all SPDX document attachments for the current build
   * @returns The SPDX documents
   */
  private async getSpdxDocumentAttachmentsForCurrentBuild(): Promise<ISpdx22Document[]> {
    // Get the current page project data
    const projectPageDataService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
    const projectPageData = await projectPageDataService.getProject();
    const projectId = projectPageData?.id;
    if (!projectId) {
      throw new Error('No project data available');
    }

    // Get the current page build data
    const buildPageDataService = await SDK.getService<IBuildPageDataService>(BuildServiceIds.BuildPageDataService);
    const buildPageData = await buildPageDataService.getBuildPageData();
    const buildId = buildPageData?.build?.id;
    if (!buildId) {
      throw new Error('No build data available');
    }

    // Get the SPDX document attachments for the current build
    const buildClient = getClient(BuildRestClient);
    const spdxAttachments = await buildClient.getAttachments(projectId, buildId, SPDX_ATTACHMENT_TYPE);
    console.info(`Detected ${spdxAttachments.length} SPDX document attachment(s) for build ${buildId}`);

    // Download and process each SPDX document attachment
    const spdxDocuments: ISpdx22Document[] = [];
    for (const spdxAttachment of spdxAttachments) {
      try {
        // Extract the attachment identifiers from the url
        // Format: `/{projectId}/_apis/build/builds/{buildId}/{timelineId}/{timelineRecordId}/attachments/{attachmentType}/{attachmentName}`
        // TODO: Change this if/when the DevOps API provides a better way to get the attachment stream
        const spdxUrl = spdxAttachment._links?.self?.href;
        if (!spdxUrl) {
          throw new Error('Attachment url not found');
        }
        const spdxUrlMatch = spdxUrl.match(
          /([a-f-0-9]*)\/_apis\/build\/builds\/([a-f-0-9]*)\/([a-f-0-9]*)\/([a-f-0-9]*)\/attachments\//i,
        );
        if (!spdxUrlMatch) {
          throw new Error('Attachment url format not recognized');
        }

        // Download the SPDX document
        const spdxStream = await buildClient.getAttachment(
          spdxUrlMatch[1],
          spdxUrlMatch[2],
          spdxUrlMatch[3],
          spdxUrlMatch[4],
          SPDX_ATTACHMENT_TYPE,
          spdxAttachment.name,
        );
        if (!spdxStream) {
          throw new Error('Attachment stream could not be retrieved');
        }

        // Parse the SPDX document
        const spdxDocument = JSON.parse(new TextDecoder().decode(spdxStream)) as ISpdx22Document;
        if (!spdxDocument) {
          throw new Error('Attachment stream could not be parsed as JSON');
        }

        // Attempt to download the SPDX document graph SVG, if available
        const spdxGraphStream = await buildClient.getAttachment(
          spdxUrlMatch[1],
          spdxUrlMatch[2],
          spdxUrlMatch[3],
          spdxUrlMatch[4],
          SPDX_GRAPH_ATTACHMENT_TYPE,
          spdxAttachment.name.replace(SPDX_ATTACHMENT_TYPE, SPDX_GRAPH_ATTACHMENT_TYPE),
        );
        if (spdxGraphStream) {
          spdxDocument.documentGraphSvg = new TextDecoder().decode(spdxGraphStream);
        }

        spdxDocuments.push(spdxDocument);
      } catch (error) {
        console.error(`Failed to process attachment '${spdxAttachment.name}':`, error);
      }
    }

    console.info(`Loaded ${Object.keys(spdxDocuments).length} SPDX document(s) for build ${buildId}`);
    return spdxDocuments;
  }

  public render(): JSX.Element {
    return (
      <div className="flex-grow">
        {!this.state.documents ? (
          <Spinner label="Loading SPDX documents..." />
        ) : !this.state?.documents?.[0] ? (
          <ZeroData
            iconProps={{ iconName: 'Certificate' }}
            primaryText="Empty"
            secondaryText="Unable to locate any SPDX documents for this build."
            imageAltText=""
          />
        ) : (
          // TODO: Add support for viewing multiple documents in a single build?
          <SpdxDocumentPage document={this.state.documents[0]} />
        )}
      </div>
    );
  }
}

ReactDOM.render(<Root />, document.getElementById('root'));
