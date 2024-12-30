import fs from 'fs';
import path from 'path';

import {
  error,
  getBoolInput,
  getInput,
  getInputRequired,
  getVariable,
  setResult,
  TaskResult,
} from 'azure-pipelines-task-lib/task';

import { getGithubAccessToken } from './utils/azureDevOps/getGithubAccessToken';
import { getFilesMatchingPathGlobs, resolvePathGlobs } from './utils/globs';
import { SbomToolRunner } from './utils/sbomToolRunner';

async function run() {
  let taskResult: TaskResult = TaskResult.Succeeded;
  let lastError: any;
  try {
    const sbomTool = new SbomToolRunner(getInput('version', false));
    const sbomCommand = getInput('command', true);
    switch (sbomCommand) {
      // Generate SBOM manifest(s)
      case 'generate':
        const packageSourcePaths = resolvePathGlobs(getInputRequired('buildSourcePath')).map((p) =>
          fs.lstatSync(p).isDirectory() ? p : path.dirname(p),
        );
        for (var i = 0; i < packageSourcePaths.length; i++) {
          const packageName = path.basename(packageSourcePaths[i]);
          const packageSourcePath = packageSourcePaths[i];
          const packageArtifactPaths = resolvePathGlobs(getInputRequired('buildArtifactPath'), packageSourcePath).map(
            (p) => (fs.lstatSync(p).isDirectory() ? p : path.dirname(p)),
          );
          try {
            await sbomTool.generateAsync({
              buildSourcePath: packageSourcePath,
              buildArtifactPath: packageArtifactPaths[0] || packageSourcePath,
              buildFileList: getFilesMatchingPathGlobs(packageArtifactPaths, packageSourcePath),
              buildDockerImagesToScan: getInput('buildDockerImagesToScan', false),
              manifestOutputPath: getInput('manifestOutputPath', false),
              manifestFileNamePrefix:
                getInput('manifestOutputPath', false) && packageSourcePaths.length > 1 ? `${packageName}.` : undefined,
              enableManifestSpreadsheetGeneration: getBoolInput('enableManifestSpreadsheetGeneration', false),
              enableManifestGraphGeneration: getBoolInput('enableManifestGraphGeneration', false),
              enablePackageMetadataParsing: getBoolInput('enablePackageMetadataParsing', false),
              fetchLicenseInformation: getBoolInput('fetchLicenseInformation', false),
              fetchSecurityAdvisories: getBoolInput('fetchSecurityAdvisories', false),
              gitHubAccessToken: getGithubAccessToken(),
              packageName:
                (packageSourcePaths.length == 1
                  ? getInput('packageName', false) || getVariable('Build.Repository.Name')
                  : packageName) || packageName,
              packageVersion: getInput('packageVersion', false) || getVariable('Build.BuildNumber') || '0.0.0',
              packageSupplier: getInput('packageSupplier', false) || getVariable('System.CollectionId') || 'Unknown',
              packageNamespaceUriBase: getInput('packageNamespaceUriBase', false),
              packageNamespaceUriUniquePart: getInput('packageNamespaceUriUniquePart', false),
              additionalComponentDetectorArgs: getInput('additionalComponentDetectorArgs', false),
              externalDocumentReferenceListFile: getInput('externalDocumentReferenceListFile', false),
            });
          } catch (e) {
            lastError = e;
            console.debug(e); // Dump the stack trace, helps with debugging
            error(`SBOM generation failed for '${packageSourcePath}'. ${e}`);
            taskResult = TaskResult.SucceededWithIssues;
          }
        }
        break;

      // Validate SBOM manifest(s)
      case 'validate':
        throw new Error('Not implemented');

      // Redact SBOM manifest(s)
      case 'redact':
        throw new Error('Not implemented');

      // Unknown command
      default:
        throw new Error(`Invalid command: ${sbomCommand}`);
    }

    setResult(taskResult, lastError?.message || '', true);
  } catch (e: any) {
    console.debug(e); // Dump the stack trace, helps with debugging
    error(`SBOM task failed. ${e}`);
    setResult(TaskResult.Failed, e?.message, true);
  }
}

run();
