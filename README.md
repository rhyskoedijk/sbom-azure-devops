# SBOM Tool Azure DevOps Extension

Unofficial Azure DevOps extension for [microsoft/sbom-tool](https://github.com/microsoft/sbom-tool). Sbom-tool runs locally on your pipeline agent without the need for subscriptions, account sign-ups, or shipping your data to a third-party service; All generated manifest files are published directly to your build artifacts and can be viewed in a human-friendly format from the "SBOM" build result tab.

Check referenced packages for known vulnerabilities against the [GitHub Advisory Database](https://github.com/advisories).

![example.build.tab.security.png](images/example.build.tab.security.png)

View referenced packages, including the package manager, type, dependency hierarchy, license, supplier, and vulnerability counts:

![example.build.tab.packages.png](images/example.build.tab.packages.png)

View manifest relationships as a network graph or export to SVG.

![example.manifest.spdx.svg.png](images/example.manifest.spdx.svg.png)

Export manifest objects to XLSX workbook.

![example.manifest.spdx.xlsx.png](images/example.manifest.spdx.xlsx.png)

## Install

Install the extension from the [Visual Studio marketplace](https://marketplace.visualstudio.com/items?itemName=rhyskoedijk.sbom-tool).

## Usage

In YAML pipelines:

```yaml
jobs:
  - job: publish
    steps:
      - task: DotNetCoreCLI@2
        displayName: 'Publish project'
        inputs:
          command: 'publish'
          publishWebProjects: true
          arguments: '--output "$(Build.ArtifactStagingDirectory)"'

      - task: sbom-tool@1
        displayName: 'Generate project SBOM manifest'
        inputs:
          command: 'generate'
          buildSourcePath: '$(Build.SourcesDirectory)'
          buildArtifactPath: '$(Build.ArtifactStagingDirectory)'
          enableManifestSpreadsheetGeneration: true
          enableManifestGraphGeneration: true
          enablePackageMetadataParsing: true
          fetchLicenseInformation: true
          fetchSecurityAdvisories: true
          gitHubConnection: 'GitHub Advisory Database Connection'
          packageSupplier: 'MyOrganisation'
          packageName: 'MyPackage'
          packageVersion: '$(Build.BuildNumber)'

      - task: PublishBuildArtifacts@1
        displayName: 'Publish artifacts'
        inputs:
          PathtoPublish: '$(Build.ArtifactStagingDirectory)'
          ArtifactName: 'drop'
          publishLocation: 'Container'
```

The SBOM manifest files will be uploaded to the build artifacts, under the `_manifest` folder.

![example.build.artifacts.png](images/example.build.artifacts.png)

## Advanced

- [`rhyskoedijk/sbom-azure-devops` GitHub project](https://github.com/rhyskoedijk/sbom-azure-devops)
- [`microsoft/sbom-tool` GitHub project](https://github.com/microsoft/sbom-tool)
- [SPDX Online Tool](https://tools.spdx.org/app/)
