import * as React from 'react';

import { ObservableValue } from 'azure-devops-ui/Core/Observable';
import { Observer } from 'azure-devops-ui/Observer';
import { Orientation, Page } from 'azure-devops-ui/Page';
import { Tab, TabBar, TabContent, TabSize } from 'azure-devops-ui/Tabs';
import { InlineKeywordFilterBarItem } from 'azure-devops-ui/TextFilterBarItem';
import { Filter, IFilter } from 'azure-devops-ui/Utilities/Filter';

import { ISpdxBuildArtifact } from '../models/SpdxBuildArtifact';
import { SpdxDocumentHeader } from './SpdxDocumentHeader';
import { SpdxFileTableCard } from './SpdxFileTableCard';
import { SpdxGraphCard } from './SpdxGraphCard';
import { SpdxPackageTableCard } from './SpdxPackageTableCard';
import { SpdxSecurityTableCard } from './SpdxSecurityTableCard';

interface Props {
  artifact: ISpdxBuildArtifact;
}

interface State {
  fileCount: number;
  packageCount: number;
  securityAdvisoryCount: number;
  supplierCount: number;
  licenseCount: number;
}

export class SpdxDocumentPage extends React.Component<Props, State> {
  private selectedTabId: ObservableValue<string>;
  private filter: IFilter;

  constructor(props: Props) {
    super(props);
    this.state = SpdxDocumentPage.getDerivedStateFromProps(props);
    this.selectedTabId = new ObservableValue('files');
    this.filter = new Filter();
  }

  static getDerivedStateFromProps(props: Props): State {
    return {
      fileCount: props.artifact.spdxDocument?.files?.length || 0,
      packageCount:
        props.artifact.spdxDocument?.relationships?.filter((r) => r.relationshipType == 'DEPENDS_ON')?.length || 0,
      securityAdvisoryCount:
        props.artifact.spdxDocument?.packages?.flatMap((p) =>
          p.externalRefs.filter((r) => r.referenceCategory == 'SECURITY' && r.referenceType == 'advisory'),
        )?.length || 0,
      supplierCount: new Set(props.artifact.spdxDocument?.packages?.map((p) => p.supplier)).size,
      licenseCount: new Set(
        props.artifact.spdxDocument?.packages?.map((p) => p.licenseConcluded || p.licenseDeclared || ''),
      ).size,
    };
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.artifact !== this.props.artifact) {
      this.setState(SpdxDocumentPage.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.props?.artifact || !this.state) {
      return <div />;
    }
    // TODO: Use page providers; https://developer.microsoft.com/en-us/azure-devops/components/page#page-with-providers
    return (
      <Page orientation={Orientation.Vertical}>
        <SpdxDocumentHeader artifact={this.props.artifact} />
        <TabBar
          onSelectedTabChanged={this.onSelectedTabChanged}
          selectedTabId={this.selectedTabId}
          tabSize={TabSize.Tall}
          renderAdditionalContent={this.onRenderFilterBar}
          className="margin-vertical-16"
        >
          <Tab name="Files" id="files" badgeCount={this.state.fileCount} />
          <Tab name="Packages" id="packages" badgeCount={this.state.packageCount} />
          <Tab name="Security Advisories" id="securityAdvisories" badgeCount={this.state.securityAdvisoryCount} />
          <Tab name="Suppliers" id="suppliers" badgeCount={this.state.supplierCount} />
          <Tab name="Licenses" id="licenses" badgeCount={this.state.licenseCount} />
          {this.props.artifact.svgDocument ? (
            <Tab name="Graph Viewer" id="graph" iconProps={{ iconName: 'BranchFork2', className: 'margin-right-4' }} />
          ) : null}
        </TabBar>
        <TabContent>
          <Observer selectedTabId={this.selectedTabId}>
            {(props: { selectedTabId: string }) => {
              switch (props.selectedTabId) {
                case 'files':
                  return (
                    <div className="page-content">
                      <SpdxFileTableCard document={this.props.artifact.spdxDocument} filter={this.filter} />
                    </div>
                  );
                case 'packages':
                  return (
                    <div className="page-content">
                      <SpdxPackageTableCard document={this.props.artifact.spdxDocument} filter={this.filter} />
                    </div>
                  );
                case 'securityAdvisories':
                  return (
                    <div className="page-content">
                      <SpdxSecurityTableCard document={this.props.artifact.spdxDocument} filter={this.filter} />
                    </div>
                  );
                case 'suppliers':
                  return (
                    <div className="page-content">
                      <p>TODO: Suppliers...</p>
                    </div>
                  );
                case 'licenses':
                  return (
                    <div className="page-content">
                      <p>TODO: Licenses...</p>
                    </div>
                  );
                case 'graph':
                  return (
                    <SpdxGraphCard
                      document={this.props.artifact.spdxDocument}
                      documentGraphSvg={this.props.artifact.svgDocument}
                    />
                  );
              }
            }}
          </Observer>
        </TabContent>
      </Page>
    );
  }

  private onRenderFilterBar = () => {
    return <InlineKeywordFilterBarItem filter={this.filter} filterItemKey="keyword" />;
  };

  private onSelectedTabChanged = (newTabId: string) => {
    this.selectedTabId.value = newTabId;
  };
}
