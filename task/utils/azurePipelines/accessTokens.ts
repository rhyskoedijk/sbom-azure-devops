import { getEndpointAuthorization, getInput, loc } from 'azure-pipelines-task-lib/task';

/**
 * Extract the GitHub access token from `gitHubAccessToken` or `gitHubConnection` inputs
 * @returns The GitHub access token
 */
export function getGithubAccessToken(): string | undefined {
  const gitHubAccessToken = getInput('gitHubAccessToken', false);
  if (gitHubAccessToken) {
    return gitHubAccessToken;
  }

  const githubEndpointId = getInput('gitHubConnection', false);
  if (githubEndpointId) {
    return getGithubEndPointToken(githubEndpointId);
  }

  return undefined;
}

/**
 * Extract the access token from Github endpoint
 * @param githubEndpoint The GitHub endpoint id
 * @returns The GitHub access token
 */
function getGithubEndPointToken(githubEndpoint: string): string {
  const githubEndpointObject = getEndpointAuthorization(githubEndpoint, false);
  let githubEndpointToken: string | undefined;
  if (!!githubEndpointObject) {
    if (githubEndpointObject.scheme === 'PersonalAccessToken') {
      githubEndpointToken = githubEndpointObject.parameters.accessToken;
    } else if (githubEndpointObject.scheme === 'OAuth') {
      githubEndpointToken = githubEndpointObject.parameters.AccessToken;
    } else if (githubEndpointObject.scheme === 'Token') {
      githubEndpointToken = githubEndpointObject.parameters.AccessToken;
    } else if (githubEndpointObject.scheme) {
      throw new Error(loc('InvalidEndpointAuthScheme', githubEndpointObject.scheme));
    }
  }
  if (!githubEndpointToken) {
    throw new Error(loc('InvalidGitHubEndpoint', githubEndpoint));
  }

  return githubEndpointToken;
}
