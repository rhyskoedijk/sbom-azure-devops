import { getVariable, tool, which } from 'azure-pipelines-task-lib/task';
import { existsSync as fileExistsSync } from 'fs';
import * as fs from 'fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'path';
import { section } from '../azureDevOps/formattingCommands';
import { spdxGraphToSvgAsync } from './spdxGraphToSvg';
import { spdxAddPackageSecurityAdvisoryExternalRefsAsync } from './spdxPackageSecurityAdvisories';

const GITHUB_RELEASES_URL = 'https://github.com/microsoft/sbom-tool/releases';
const MANIFEST_DIR_NAME = '_manifest';
const MANIFEST_FORMAT = 'spdx';
const MANIFEST_VERSION = '2.2';

export interface SbomGenerateArgs {
  buildSourcePath: string;
  buildArtifactPath: string;
  buildFileList?: string;
  manifestOutputPath?: string;
  enableManifestGraphGeneration?: boolean;
  enablePackageMetadataParsing?: boolean;
  fetchLicenseInformation?: boolean;
  fetchSecurityAdvisories?: boolean;
  gitHubAccessToken?: string;
  packageName: string;
  packageVersion: string;
  packageSupplier: string;
  packageNamespaceUriBase?: string;
  packageNamespaceUriUniquePart?: string;
  dockerImagesToScan?: string;
  additionalComponentDetectorArgs?: string;
  externalDocumentReferenceListFile?: string;
}

export class SbomTool {
  private toolsDirectory: string;
  private toolArchitecture: string;
  private toolVersion?: string;
  private debug: boolean;

  constructor(version?: string) {
    this.toolsDirectory = getVariable('Agent.ToolsDirectory') || __dirname;
    this.toolArchitecture = getVariable('Agent.OSArchitecture') || 'x64';
    this.toolVersion = version;
    this.debug = getVariable('System.Debug')?.toLocaleLowerCase() == 'true';
  }

  // Run `sbom-tool generate` command
  // https://github.com/microsoft/sbom-tool?tab=readme-ov-file#sbom-generation
  public async generateAsync(args: SbomGenerateArgs): Promise<void> {
    // Find the sbom-tool path, or install it if missing
    const sbomToolPath = await this.getToolPathAsync();

    // Build sbom-tool arguments
    // See: https://github.com/microsoft/sbom-tool/blob/main/docs/sbom-tool-arguments.md
    let sbomToolArguments = ['generate'];
    sbomToolArguments.push('-bc', args.buildSourcePath);
    sbomToolArguments.push('-b', args.buildArtifactPath);
    if (args.buildFileList) {
      sbomToolArguments.push('-bl', await createTemporaryFileAsync('build-file-list', args.buildFileList));
    }
    if (args.manifestOutputPath) {
      sbomToolArguments.push('-m', args.manifestOutputPath);
    }
    sbomToolArguments.push('-D', 'true');
    if (args.enablePackageMetadataParsing) {
      sbomToolArguments.push('-pm', 'true');
    }
    if (args.fetchLicenseInformation) {
      sbomToolArguments.push('-li', 'true');
    }
    sbomToolArguments.push('-pn', args.packageName);
    sbomToolArguments.push('-pv', args.packageVersion);
    sbomToolArguments.push('-ps', args.packageSupplier);
    if (args.packageNamespaceUriBase) {
      sbomToolArguments.push('-nsb', args.packageNamespaceUriBase);
    } else {
      sbomToolArguments.push('-nsb', `https://${args.packageSupplier.toLowerCase()}.com`);
    }
    if (args.packageNamespaceUriUniquePart) {
      sbomToolArguments.push('-nsu', args.packageNamespaceUriUniquePart);
    }
    if (args.dockerImagesToScan) {
      sbomToolArguments.push('-di', args.dockerImagesToScan);
    }
    if (args.additionalComponentDetectorArgs) {
      sbomToolArguments.push('-cd', args.additionalComponentDetectorArgs);
    }
    if (args.externalDocumentReferenceListFile) {
      sbomToolArguments.push(
        '-er',
        await createTemporaryFileAsync('external-doc-refs-list', args.externalDocumentReferenceListFile),
      );
    }
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
    const sbomPath = path.join(
      args.manifestOutputPath || args.buildArtifactPath || __dirname,
      MANIFEST_DIR_NAME,
      `${MANIFEST_FORMAT}_${MANIFEST_VERSION}`,
      `manifest.${MANIFEST_FORMAT}.json`,
    );
    if (!fileExistsSync(sbomPath)) {
      throw new Error(`SBOM Tool did not generate SPDX file: '${sbomPath}'`);
    }

    // Check packages for security advisories
    if (args.fetchSecurityAdvisories && args.gitHubAccessToken) {
      section('Checking package security advisories');
      await spdxAddPackageSecurityAdvisoryExternalRefsAsync(sbomPath, args.gitHubAccessToken);
    }

    // Generate a user-friendly graph diagram of the SPDX file
    if (args.enableManifestGraphGeneration) {
      section(`Generating graph diagram`);
      await spdxGraphToSvgAsync(sbomPath);
    }
  }

  // Get sbom-tool path, install if missing
  private async getToolPathAsync(installIfMissing: boolean = true): Promise<string> {
    let toolPath: string | undefined = which('sbom-tool', false);
    if (toolPath) {
      return toolPath;
    }
    if (!installIfMissing) {
      throw new Error('SBOM Tool install not found');
    }

    console.info('SBOM Tool install was not found, attempting to install now...');
    section("Installing 'sbom-tool'");
    switch (getVariable('Agent.OS')) {
      case 'Darwin':
      case 'Linux':
        toolPath = await installToolLinuxAsync(this.toolsDirectory, this.toolArchitecture, this.toolVersion);
        break;
      case 'Windows_NT':
        toolPath = await installToolWindowsAsync(this.toolsDirectory, this.toolArchitecture, this.toolVersion);
        break;
      default:
        throw new Error(`Unable to install SBOM Tool, unsupported agent OS '${getVariable('Agent.OS')}'`);
    }

    return toolPath || which('sbom-tool', true);
  }
}

/**
 * Install sbom-tool using Brew (if available), or manual download via Bash
 */
async function installToolLinuxAsync(
  directory: string,
  architecture?: string,
  version?: string,
): Promise<string | undefined> {
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
        `curl "${GITHUB_RELEASES_URL}/${version ? 'v' + version : 'latest'}/download/sbom-tool-linux-${architecture}" -Lo "${toolPath}" && chmod +x "${toolPath}"`,
      ])
      .execAsync();
    return toolPath;
  }
}

/**
 * Install sbom-tool using WinGet (if available), or manual download via PowerShell
 */
async function installToolWindowsAsync(
  directory: string,
  architecture?: string,
  version?: string,
): Promise<string | undefined> {
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
        `Invoke-WebRequest -Uri "${GITHUB_RELEASES_URL}/${version ? 'v' + version : 'latest'}/download/sbom-tool-win-${architecture}.exe" -OutFile "${toolPath}"`,
      ])
      .execAsync();
    return toolPath;
  }
}

/**
 * Create a unique file within the OS temp directory
 * @param fileName The name of the file
 * @param content The content of the file
 * @returns The path to the temporary file
 */
async function createTemporaryFileAsync(fileName: string, content: string): Promise<string> {
  const tmpFilePath = path.join(await fs.mkdtemp(path.join(tmpdir(), 'sbom-tool-')), fileName);
  await fs.writeFile(tmpFilePath, content);
  return tmpFilePath;
}
