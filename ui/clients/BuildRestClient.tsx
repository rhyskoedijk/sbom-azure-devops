import { IVssRestClientOptions } from 'azure-devops-extension-api/Common';
import { RestClientBase } from 'azure-devops-extension-api/Common/RestClientBase';

import * as Build from 'azure-devops-extension-api/Build';

export class BuildRestClient extends RestClientBase {
  constructor(options: IVssRestClientOptions) {
    super(options);
  }

  public static readonly API_VERSION = '5.0';

  /**
   * Gets the list of attachments of a specific type that are associated with a build.
   *
   * @param project - Project ID or project name
   * @param buildId - The ID of the build.
   * @param type - The type of attachment.
   */
  public async getAttachments(project: string, buildId: number, type: string): Promise<Build.Attachment[]> {
    return this.beginRequest<Build.Attachment[]>({
      apiVersion: BuildRestClient.API_VERSION,
      routeTemplate: '{project}/_apis/build/builds/{buildId}/attachments/{type}',
      routeValues: {
        project: project,
        buildId: buildId,
        type: type,
      },
    });
  }

  /**
   * Gets a specific attachment.
   *
   * @param project - Project ID or project name
   * @param buildId - The ID of the build.
   * @param timelineId - The ID of the timeline.
   * @param recordId - The ID of the timeline record.
   * @param type - The type of the attachment.
   * @param name - The name of the attachment.
   */
  public async getAttachment(
    project: string,
    buildId: number,
    timelineId: string,
    recordId: string,
    type: string,
    name: string,
  ): Promise<ArrayBuffer> {
    return this.beginRequest<ArrayBuffer>({
      apiVersion: BuildRestClient.API_VERSION,
      httpResponseType: 'application/octet-stream',
      routeTemplate: '{project}/_apis/build/builds/{buildId}/{timelineId}/{recordId}/attachments/{type}/{name}',
      routeValues: {
        project: project,
        buildId: buildId,
        timelineId: timelineId,
        recordId: recordId,
        type: type,
        name: name,
      },
    });
  }
}
