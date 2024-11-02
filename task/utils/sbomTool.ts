import { debug, tool, which } from 'azure-pipelines-task-lib/task';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import { section } from './azureDevOps/formattingCommands';

export interface SbomGenerateArgs {
  buildDropPath?: string;
  buildComponentPath?: string;
  buildListFile?: string;
  manifestDirPath?: string;
  packageName?: string;
  packageVersion?: string;
  packageSupplier?: string;
  dockerImagesToScan?: string;
  additionalComponentDetectorArgs?: string;
  externalDocumentReferenceListFile?: string;
  namespaceUriUniquePart?: string;
  namespaceUriBase?: string;
  fetchLicenseInformation?: boolean;
  enablePackageMetadataParsing?: boolean;
}

export class SbomTool {
  private debug: boolean;

  constructor(debug: boolean) {
    this.debug = debug;
  }

  // Run `sbom-tool generate` command
  // https://github.com/microsoft/sbom-tool?tab=readme-ov-file#sbom-generation
  public async generate(args: SbomGenerateArgs): Promise<void> {
    // Find the sbom-tool path, or install it if missing
    const sbomToolPath = await this.getToolPath();

    // Build sbom-tool arguments
    // See: https://github.com/microsoft/sbom-tool/blob/main/docs/sbom-tool-arguments.md
    let sbomToolArguments = ['generate'];
    if (args.buildDropPath) {
      sbomToolArguments.push('-b', args.buildDropPath);
    }
    if (args.buildComponentPath) {
      sbomToolArguments.push('-bc', args.buildComponentPath);
    }
    if (args.buildListFile) {
      sbomToolArguments.push('-bl', args.buildListFile);
    }
    if (args.manifestDirPath) {
      sbomToolArguments.push('-m', args.manifestDirPath);
    }
    if (args.packageName) {
      sbomToolArguments.push('-pn', args.packageName);
    }
    if (args.packageVersion) {
      sbomToolArguments.push('-pv', args.packageVersion);
    }
    if (args.packageSupplier) {
      sbomToolArguments.push('-ps', args.packageSupplier);
    }
    if (args.dockerImagesToScan) {
      sbomToolArguments.push('-di', args.dockerImagesToScan);
    }
    if (args.additionalComponentDetectorArgs) {
      sbomToolArguments.push('-cd', args.additionalComponentDetectorArgs);
    }
    if (args.externalDocumentReferenceListFile) {
      sbomToolArguments.push('-er', args.externalDocumentReferenceListFile);
    }
    if (args.namespaceUriUniquePart) {
      sbomToolArguments.push('-nsu', args.namespaceUriUniquePart);
    }
    if (args.namespaceUriBase) {
      sbomToolArguments.push('-nsb', args.namespaceUriBase);
    }
    if (args.fetchLicenseInformation) {
      sbomToolArguments.push('-li', 'true');
    }
    if (args.enablePackageMetadataParsing) {
      sbomToolArguments.push('-pm', 'true');
    }
    sbomToolArguments.push('-D', 'true');
    sbomToolArguments.push('-V', this.debug ? 'Debug' : 'Information');

    // Run sbom-tool
    section(`Running 'sbom-tool generate'`);
    const sbomTool = tool(sbomToolPath).arg(sbomToolArguments);
    const sbomToolResultCode = await sbomTool.execAsync({
      failOnStdErr: false,
      ignoreReturnCode: true,
    });
    if (sbomToolResultCode != 0) {
      throw new Error(`SBOM Tool failed with exit code ${sbomToolResultCode}`);
    }
  }

  // Get sbom-tool path, install if missing
  private async getToolPath(installIfMissing: boolean = true): Promise<string> {
    const toolPath = which('sbom-tool', false);
    if (toolPath) {
      return toolPath;
    }
    if (!installIfMissing) {
      throw new Error('SBOM Tool install not found');
    }

    let installRunner: ToolRunner;
    const wingetToolPath = which('winget', true);
    const brewToolPath = which('brew', true);
    if (wingetToolPath) {
      installRunner = tool(wingetToolPath).arg(['install', 'Microsoft.SbomTool']);
    } else if (brewToolPath) {
      installRunner = tool(brewToolPath).arg(['install', 'sbom-tool']);
    } else {
      throw new Error(
        'No package manager found tht can install SBOM Tool. Please install `sbom-tool` or a supported package manager (`winget`, `brew`), then try again.',
      );
    }

    debug('SBOM Tool install was not found, attempting to install now...');
    section('Installing SBOM Tool');
    await installRunner.execAsync();
    return which('sbom-tool', true);
  }
}
