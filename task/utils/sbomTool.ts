import * as crypto from 'crypto';
import { existsSync as fileExistsSync } from 'fs';
import * as fs from 'fs/promises';
import { tmpdir } from 'node:os';
import { EOL } from 'os';
import * as path from 'path';

import { addAttachment, getVariable, tool, which } from 'azure-pipelines-task-lib/task';

import { endgroup, group, section } from './azurePipelines/commands';

import { IDocument } from '../../shared/spdx/models/2.3/document';

import { convertSpdxToXlsxAsync } from '../../shared/spdx/convertSpdxToXlsx';
import { addSpdxPackageSecurityAdvisoryExternalRefsAsync } from './spdx/addSpdxPackageSecurityAdvisories';
import { convertSpdxToSvgAsync } from './spdx/convertSpdxToSvg';

const GITHUB_RELEASES_URL = 'https://github.com/microsoft/sbom-tool/releases';
const MANIFEST_DIR_NAME = '_manifest';
const MANIFEST_FORMAT = 'spdx';
const MANIFEST_VERSION = '2.2';

export interface SbomToolGenerateArgs {
  buildSourcePath: string;
  buildArtifactPath?: string;
  buildFileList?: string[];
  buildDockerImagesToScan?: string;
  manifestOutputPath?: string;
  manifestFileNamePrefix?: string;
  enableManifestSpreadsheetGeneration?: boolean;
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
  additionalComponentDetectorArgs?: string;
  externalDocumentReferenceListFile?: string;
}

export class SbomTool {
  private agentOperatingSystem: string;
  private agentArchitecture: string;
  private agentToolsDirectory: string;
  private toolPath?: string;
  private toolVersion?: string;
  private debug: boolean;

  constructor(version?: string) {
    this.agentOperatingSystem = getVariable('Agent.OS') || 'Linux';
    this.agentArchitecture = getVariable('Agent.OSArchitecture') || 'x64';
    this.agentToolsDirectory = getVariable('Agent.ToolsDirectory') || __dirname;
    this.toolVersion = version;
    this.debug = getVariable('System.Debug')?.toLocaleLowerCase() == 'true';
  }

  // Run `sbom-tool generate` command
  // https://github.com/microsoft/sbom-tool?tab=readme-ov-file#sbom-generation
  public async generateAsync(args: SbomToolGenerateArgs): Promise<void> {
    // Find the sbom-tool path, or install it if missing
    const sbomToolPath = await this.getToolPathAsync();

    group(`Generate SBOM for '${args.packageName}' in ${args.buildSourcePath}`);
    try {
      // Sanity check
      if (!args.buildArtifactPath && !args.buildFileList) {
        throw new Error('Either `buildArtifactPath` or `buildFileList` must be provided');
      }

      // Build sbom-tool arguments
      // See: https://github.com/microsoft/sbom-tool/blob/main/docs/sbom-tool-arguments.md
      let sbomToolArguments = ['generate'];
      sbomToolArguments.push('-bc', args.buildSourcePath);
      if (args.buildArtifactPath) {
        sbomToolArguments.push('-b', args.buildArtifactPath);
      }
      if (args.buildFileList) {
        sbomToolArguments.push('-bl', await createTemporaryFileAsync('build-file-list', args.buildFileList.join(EOL)));
        if (this.debug) {
          console.debug(`Using build file list (-bl):`, args.buildFileList);
        }
      }
      if (args.buildDockerImagesToScan) {
        sbomToolArguments.push('-di', args.buildDockerImagesToScan);
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
        // No base namespace provided, so generate one from the supplier name
        // To get a valid URI hostname, replace spaces with dashes, strip all other special characters, convert to lowercase
        const supplierHostname = args.packageSupplier
          .replace(/\s+/g, '-')
          .replace(/[^a-zA-Z0-9 ]/g, '')
          .toLowerCase();
        sbomToolArguments.push('-nsb', `https://${supplierHostname}.com`);
      }
      if (args.packageNamespaceUriUniquePart) {
        sbomToolArguments.push('-nsu', args.packageNamespaceUriUniquePart);
      }
      if (args.additionalComponentDetectorArgs) {
        sbomToolArguments.push('-cd', args.additionalComponentDetectorArgs);
      }
      if (args.externalDocumentReferenceListFile) {
        sbomToolArguments.push(
          '-er',
          await createTemporaryFileAsync('external-doc-refs-list', args.externalDocumentReferenceListFile),
        );
        if (this.debug) {
          console.debug(`Using external doc refs list (-er):`, args.externalDocumentReferenceListFile);
        }
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

      const manifestOutputPath = path.join(
        args.manifestOutputPath || args.buildArtifactPath || __dirname,
        MANIFEST_DIR_NAME,
        `${MANIFEST_FORMAT}_${MANIFEST_VERSION}`,
      );

      // Rename all SPDX files in the manifest directory if a file name prefix is provided
      if (args.manifestFileNamePrefix) {
        const manifestFiles = await fs.readdir(manifestOutputPath);
        if (manifestFiles) {
          for (const manifestFileName of manifestFiles) {
            if (manifestFileName.startsWith('manifest')) {
              const newManifestFileName = args.manifestFileNamePrefix + manifestFileName;
              await fs.rename(
                path.join(manifestOutputPath, manifestFileName),
                path.join(manifestOutputPath, newManifestFileName),
              );
            }
          }
        }
      }

      // Check for the generated SPDX json file
      const spdxJsonPath = path.join(
        manifestOutputPath,
        `${args.manifestFileNamePrefix || ''}manifest.${MANIFEST_FORMAT}.json`,
      );
      if (!fileExistsSync(spdxJsonPath)) {
        throw new Error(`SBOM Tool did not generate SPDX file: '${spdxJsonPath}'`);
      }

      // Add security advisories to the SPDX file, if configured
      if (args.fetchSecurityAdvisories && args.gitHubAccessToken) {
        section('Checking packages for security advisories');
        await addSpdxPackageSecurityAdvisoryExternalRefsAsync(spdxJsonPath, args.gitHubAccessToken);
      }

      // Attach the SPDX file to the build timeline so we can view it in the SBOM build result tab.
      const spdxJsonContent = await fs.readFile(spdxJsonPath, 'utf8');
      addAttachment(`${MANIFEST_FORMAT}.json`, path.basename(spdxJsonPath), spdxJsonPath);

      // Regenerate the SHA-256 hash of the SPDX file, in case it was modified
      section('Generating SHA-256 hash file');
      await writeSha256HashFileAsync(spdxJsonPath);

      // Generate a XLSX spreadsheet of the SPDX file, if configured
      if (args.enableManifestSpreadsheetGeneration && spdxJsonContent) {
        section(`Generating XLSX spreadsheet`);
        const xlsx = await convertSpdxToXlsxAsync(JSON.parse(spdxJsonContent) as IDocument);
        if (xlsx) {
          const xlsxPath = path.format({ ...path.parse(spdxJsonPath), base: '', ext: '.xlsx' });
          await fs.writeFile(xlsxPath, xlsx);
          await writeSha256HashFileAsync(xlsxPath);
        }
      }

      // Generate a SVG graph diagram of the SPDX file
      // TODO: Remove SVG graph generation once web browser SPDX to SVG generation is implemented
      if (args.enableManifestGraphGeneration && spdxJsonContent) {
        section(`Generating SVG graph diagram`);
        const svg = await convertSpdxToSvgAsync(JSON.parse(spdxJsonContent) as IDocument);
        if (svg) {
          const svgPath = path.format({ ...path.parse(spdxJsonPath), base: '', ext: '.svg' });
          await fs.writeFile(svgPath, svg);
          await writeSha256HashFileAsync(svgPath);
          addAttachment(`${MANIFEST_FORMAT}.svg`, path.basename(svgPath), svgPath);
        }
      }
    } finally {
      endgroup();
    }
  }

  // Get sbom-tool path, install if missing
  private async getToolPathAsync(installIfMissing: boolean = true): Promise<string> {
    if (this.toolPath) {
      return this.toolPath;
    }

    // Check if sbom-tool is already installed to the path environment
    const envToolPath = which('sbom-tool', false);
    if (envToolPath) {
      this.toolPath = envToolPath;
      return this.toolPath;
    }

    // Check if sbom-tool is already installed to the agent tools directory
    let agentToolPath: string | undefined;
    switch (this.agentOperatingSystem) {
      case 'Darwin':
      case 'Linux':
        agentToolPath = path.join(this.agentToolsDirectory, 'sbom-tool');
        break;
      case 'Windows_NT':
        agentToolPath = path.join(this.agentToolsDirectory, 'sbom-tool.exe');
        break;
    }
    if (agentToolPath && fileExistsSync(agentToolPath)) {
      this.toolPath = agentToolPath;
      return this.toolPath;
    }

    // We can't find sbom-tool, check if we are allowed to install it
    if (!installIfMissing) {
      throw new Error('SBOM Tool install not found');
    }

    // Install sbom-tool
    console.info('SBOM Tool install was not found, attempting to install now...');
    section("Installing 'sbom-tool'");
    switch (this.agentOperatingSystem) {
      case 'Darwin':
      case 'Linux':
        this.toolPath = await installToolLinuxAsync(this.agentToolsDirectory, this.agentArchitecture, this.toolVersion);
        break;
      case 'Windows_NT':
        this.toolPath = await installToolWindowsAsync(
          this.agentToolsDirectory,
          this.agentArchitecture,
          this.toolVersion,
        );
        break;
      default:
        throw new Error(`Unable to install SBOM Tool, unsupported agent OS '${this.agentOperatingSystem}'`);
    }

    return this.toolPath;
  }
}

/**
 * Install sbom-tool using Brew (if available), or manual download via Bash
 */
async function installToolLinuxAsync(directory: string, architecture?: string, version?: string): Promise<string> {
  const brewToolPath = which('brew', false);
  if (brewToolPath) {
    await tool(brewToolPath)
      .arg(['install', version ? `sbom-tool@${version}` : 'sbom-tool'])
      .execAsync();
    return which('sbom-tool', true);
  } else {
    const toolPath = path.join(directory, 'sbom-tool');
    await tool(which('bash', true))
      .arg([
        '-c',
        `curl "${GITHUB_RELEASES_URL}/${version ? 'download/v' + version : 'latest/download'}/sbom-tool-linux-${architecture}" -Lo "${toolPath}" && chmod +x "${toolPath}"`,
      ])
      .execAsync();
    return toolPath;
  }
}

/**
 * Install sbom-tool using WinGet (if available), or manual download via PowerShell
 */
async function installToolWindowsAsync(directory: string, architecture?: string, version?: string): Promise<string> {
  const wingetToolPath = which('winget', false);
  if (wingetToolPath) {
    await tool(wingetToolPath)
      .arg(['install', 'Microsoft.SbomTool'].concat(version ? ['--version', version] : []))
      .execAsync();
    return which('sbom-tool', true);
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

/**
 * Write a SHA-256 hash file for the given file
 * @param filePath The path to the file
 */
async function writeSha256HashFileAsync(filePath: string): Promise<void> {
  await fs.writeFile(
    `${filePath}.sha256`,
    crypto
      .createHash('sha256')
      .update(await fs.readFile(filePath))
      .digest('hex'),
  );
}
