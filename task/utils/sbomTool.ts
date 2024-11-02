import { debug, getVariable, tool, which } from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import { section } from './azureDevOps/formattingCommands';

const GITHUB_RELEASES_URL = 'https://github.com/microsoft/sbom-tool/releases/';

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
  private toolsDirectory: string;
  private toolVersion?: string;
  private debug: boolean;

  constructor(version?: string) {
    this.toolsDirectory = getVariable('Agent.ToolsDirectory') || __dirname;
    this.toolVersion = version;
    this.debug = getVariable('System.Debug')?.toLocaleLowerCase() == 'true';
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

    debug('SBOM Tool install was not found, attempting to install now...');
    section('Installing SBOM Tool');
    const agentOperatingSystem = getVariable('Agent.OS');
    switch (agentOperatingSystem) {
      case 'Darwin':
      case 'Linux':
        await installToolLinux(this.toolsDirectory, this.toolVersion);
        break;
      case 'Windows_NT':
        await installToolWindows(this.toolsDirectory, this.toolVersion);
        break;
      default:
        throw new Error(`Unable to install SBOM Tool, unsupported agent OS '${agentOperatingSystem}'`);
    }

    return which('sbom-tool', true);
  }
}

/**
 * Install sbom-tool using Brew (if available), or manual download via Bash
 */
async function installToolLinux(directory: string, version?: string) {
  const brewToolPath = which('brew', false);
  if (brewToolPath) {
    await tool(brewToolPath)
      .arg(['install', version ? `sbom-tool@${version}` : 'sbom-tool'])
      .execAsync();
  } else {
    const toolPath = path.join(directory, 'sbom-tool');
    await tool(which('bash', true))
      .arg([
        '-c',
        `curl "${GITHUB_RELEASES_URL}/${version ? 'v' + version : 'latest'}/download/sbom-tool-linux-x64" -Lo "${toolPath}" && chmod +x "${toolPath}"`,
      ])
      .execAsync();
  }
}

/**
 * Install sbom-tool using WinGet (if available), or manual download via PowerShell
 */
async function installToolWindows(directory: string, version?: string) {
  const wingetToolPath = which('winget', false);
  if (wingetToolPath) {
    await tool(wingetToolPath)
      .arg(['install', 'Microsoft.SbomTool'].concat(version ? ['--version', version] : []))
      .execAsync();
  } else {
    const toolPath = path.join(directory, 'sbom-tool.exe');
    await tool(which('powershell', true))
      .arg([
        `-Command`,
        `Invoke-WebRequest -Uri "${GITHUB_RELEASES_URL}/${version ? 'v' + version : 'latest'}/sbom-tool-win-x64.exe" -OutFile "${toolPath}"`,
      ])
      .execAsync();
  }
}
