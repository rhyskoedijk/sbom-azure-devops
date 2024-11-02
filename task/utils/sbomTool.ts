import { debug, error, tool, which } from 'azure-pipelines-task-lib/task';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import { section } from './azureDevOps/formattingCommands';

export class SbomTool {
  private debug: boolean;

  constructor(debug: boolean) {
    this.debug = debug;
  }

  // Run `sbom-tool generate` command
  public async generate(args: {}): Promise<void> {
    // Find the sbom-tool path, or install it if missing
    const sbomToolPath = await this.getToolPath();

    // Build sbom-tool arguments
    // See: https://github.com/microsoft/sbom-tool?tab=readme-ov-file#sbom-generation
    let sbomToolArguments = ['generate'];
    if (this.debug) {
      sbomToolArguments.push('--verbose');
    }

    // Run sbom-tool
    section(`Running 'sbom-tool generate'`);
    const sbomTool = tool(sbomToolPath).arg(sbomToolArguments);
    const sbomToolResultCode = await sbomTool.execAsync({
      failOnStdErr: false,
      ignoreReturnCode: true,
    });
    if (sbomToolResultCode != 0) {
      error(`SBOM Tool failed with exit code ${sbomToolResultCode}`);
    }
  }

  // Get sbom-tool path, install if missing
  public async getToolPath(installIfMissing: boolean = true): Promise<string> {
    const toolPath = which('sbom-tool', false);
    if (toolPath) {
      return toolPath;
    }
    if (!installIfMissing) {
      throw new Error('SBOM Tool install not found');
    }

    let installRunner: ToolRunner | undefined = undefined;
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
