import { getBoolInput } from 'azure-pipelines-task-lib';
import { getInput, setResult, TaskResult } from 'azure-pipelines-task-lib/task';
import { SbomTool } from './utils/sbomTool';

async function run() {
  try {
    const sbomTool = new SbomTool(true);
    const sbomCommand = getInput('sbomCommand', true);
    switch (sbomCommand) {
      case 'generate':
        await sbomTool.generate({
          buildDropPath: getInput('buildDropPath', true),
          buildComponentPath: getInput('buildComponentPath', true),
          buildListFile: getInput('buildListFile', false),
          manifestDirPath: getInput('manifestDirPath', false),
          packageName: getInput('packageName', true),
          packageVersion: getInput('packageVersion', true),
          packageSupplier: getInput('packageSupplier', true),
          dockerImagesToScan: getInput('dockerImagesToScan', false),
          additionalComponentDetectorArgs: getInput('additionalComponentDetectorArgs', false),
          externalDocumentReferenceListFile: getInput('externalDocumentReferenceListFile', false),
          namespaceUriUniquePart: getInput('namespaceUriUniquePart', false),
          namespaceUriBase: getInput('namespaceUriBase', true),
          fetchLicenseInformation: getBoolInput('fetchLicenseInformation', false),
          enablePackageMetadataParsing: getBoolInput('enablePackageMetadataParsing', false),
        });
        break;
      default:
        throw new Error(`Invalid comand: ${sbomCommand}`);
    }

    setResult(TaskResult.Succeeded, 'Success');
  } catch (e: any) {
    setResult(TaskResult.Failed, e?.message);
    console.debug(e); // Dump the stack trace, helps with debugging
  }
}

run();
