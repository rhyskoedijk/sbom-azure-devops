<h1>
    <picture>
        <img src="https://raw.githubusercontent.com/rhyskoedijk/sbom-azure-devops/main/images/icon.png" alt="SBOM Tool" width="30" height="30" />
    </picture>
    <span>SBOM Tool Azure DevOps Extension</span>
</h1>

Unoffical Azure DevOps extension for [microsoft/sbom-tool](https://github.com/microsoft/sbom-tool); Generate SPDX 2.2 compatible SBOMs from Azure DevOps repository artifacts. 

## Install

Install the extension from the [Visual Studio marketplace](https://marketplace.visualstudio.com/items?itemName=rhyskoedijk.sbom-tool).

## Usage
In YAML pipelines:

```yaml
jobs:
- job: sbom-tool
  steps:
  - task: sbom-tool@1
```
