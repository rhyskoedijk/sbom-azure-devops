import * as SDK from 'azure-devops-extension-sdk';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { CommonServiceIds, getClient, IProjectPageService } from 'azure-devops-extension-api';
import { BuildRestClient, BuildServiceIds, IBuildPageDataService } from 'azure-devops-extension-api/Build';
import { ZeroData } from 'azure-devops-ui/ZeroData';

import { SpdxDocument } from './components/SpdxDocument';
import { ISpdx22Document } from './models/Spdx22';

import './utils/StringExtensions';

import './sbom-report-tab.scss';

const SPDX_ATTACHMENT_TYPE = 'spdx';

interface State {
  documents: ISpdx22Document[];
}

export class Root extends React.Component<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = { documents: [] };
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
    const attachments = await buildClient.getAttachments(projectId, buildId, SPDX_ATTACHMENT_TYPE);
    console.info(`Detected ${attachments.length} SPDX document attachment(s) for build ${buildId}`);

    // Download and process each SPDX document attachment
    const spdxDocuments: ISpdx22Document[] = [];
    for (const attachment of attachments) {
      try {
        // Extract the attachment identifiers from the url
        // Format: `/{projectId}/_apis/build/builds/{buildId}/{timelineId}/{timelineRecordId}/attachments/{attachmentType}/{attachmentName}`
        // TODO: Change this if/when the DevOps API provides a better way to get the attachment stream
        const attachmentUrl = attachment._links?.self?.href;
        if (!attachmentUrl) {
          throw new Error('Attachment url not found');
        }
        const attachmentUrlMatch = attachmentUrl.match(
          /([a-f-0-9]*)\/_apis\/build\/builds\/([a-f-0-9]*)\/([a-f-0-9]*)\/([a-f-0-9]*)\/attachments\//i,
        );
        if (!attachmentUrlMatch) {
          throw new Error('Attachment url format not recognized');
        }
        const attachmentStream = await buildClient.getAttachment(
          attachmentUrlMatch[1],
          attachmentUrlMatch[2],
          attachmentUrlMatch[3],
          attachmentUrlMatch[4],
          SPDX_ATTACHMENT_TYPE,
          attachment.name,
        );
        if (!attachmentStream) {
          throw new Error('Attachment stream could not be retrieved');
        }
        const attachmentText = new TextDecoder().decode(attachmentStream);
        const spdxDocument = JSON.parse(attachmentText) as ISpdx22Document;
        if (!spdxDocument) {
          throw new Error('Attachment stream could not be parsed as JSON');
        }
        spdxDocuments.push(spdxDocument);
      } catch (error) {
        console.error(`Failed to process attachment '${attachment.name}':`, error);
      }
    }

    console.info(`Loaded ${Object.keys(spdxDocuments).length} SPDX document(s) for build ${buildId}`);
    return spdxDocuments;
  }

  public render(): JSX.Element {
    return (
      <div className="flex-grow">
        {!this.state?.documents?.length ? (
          <ZeroData
            iconProps={{ iconName: 'CloudDownload' }}
            primaryText="Loading SBOM..."
            secondaryText="Please wait while the build data is loaded and parsed."
            imageAltText=""
          />
        ) : (
          // TODO: Add support for viewing multiple documents in a single build?
          <SpdxDocument document={this.state.documents[0]} />
        )}
      </div>
    );
  }
}

ReactDOM.render(<Root />, document.getElementById('root'));
