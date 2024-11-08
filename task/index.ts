import { getBoolInput, getInput, getInputRequired, setResult, TaskResult } from 'azure-pipelines-task-lib/task';
import getGithubAccessToken from './utils/github/accessToken';
import { SbomTool } from './utils/spdx/sbomTool';

async function run() {
  try {
    const sbomTool = new SbomTool(getInput('version', false));
    const sbomCommand = getInput('command', true);
    switch (sbomCommand) {
      case 'generate':
        await sbomTool.generateAsync({
          buildSourcePath: getInputRequired('buildSourcePath'),
          buildArtifactPath: getInputRequired('buildArtifactPath'),
          buildFileList: getInput('buildFileList', false),
          buildDockerImagesToScan: getInput('buildDockerImagesToScan', false),
          manifestOutputPath: getInput('manifestOutputPath', false),
          enableManifestGraphGeneration: getBoolInput('enableManifestGraphGeneration', false),
          enablePackageMetadataParsing: getBoolInput('enablePackageMetadataParsing', false),
          fetchLicenseInformation: getBoolInput('fetchLicenseInformation', false),
          fetchSecurityAdvisories: getBoolInput('fetchSecurityAdvisories', false),
          gitHubAccessToken: getGithubAccessToken(),
          packageName: getInputRequired('packageName'),
          packageVersion: getInputRequired('packageVersion'),
          packageSupplier: getInputRequired('packageSupplier'),
          packageNamespaceUriBase: getInput('packageNamespaceUriBase', false),
          packageNamespaceUriUniquePart: getInput('packageNamespaceUriUniquePart', false),
          additionalComponentDetectorArgs: getInput('additionalComponentDetectorArgs', false),
          externalDocumentReferenceListFile: getInput('externalDocumentReferenceListFile', false),
        });
        break;
      case 'validate':
        throw new Error('Not implemented');
      case 'redact':
        throw new Error('Not implemented');
      default:
        throw new Error(`Invalid command: ${sbomCommand}`);
    }

    setResult(TaskResult.Succeeded, 'Success');
  } catch (e: any) {
    setResult(TaskResult.Failed, e?.message);
    console.debug(e); // Dump the stack trace, helps with debugging
  }
}

run();
