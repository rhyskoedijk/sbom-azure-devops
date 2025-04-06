import * as React from 'react';

import { ObservableValue } from 'azure-devops-ui/Core/Observable';
import { Observer } from 'azure-devops-ui/Observer';
import { Orientation, Page } from 'azure-devops-ui/Page';
import { Tab, TabBar, TabContent, TabSize } from 'azure-devops-ui/Tabs';
import { InlineKeywordFilterBarItem } from 'azure-devops-ui/TextFilterBarItem';
import { Filter, IFilter } from 'azure-devops-ui/Utilities/Filter';

import { ISecurityVulnerability } from '../../../shared/ghsa/models/securityVulnerability';
import { ISbomBuildArtifact } from '../../../shared/models/sbomBuildArtifact';
import { isPackageRootLevel } from '../../../shared/spdx/models/2.3/document';
import {
  ExternalRefCategory,
  ExternalRefSecurityType,
  parseExternalRefsAs,
} from '../../../shared/spdx/models/2.3/externalRef';
import { IFile } from '../../../shared/spdx/models/2.3/file';
import { getLicensesFromExpression, ILicense } from '../../../shared/spdx/models/2.3/license';
import {
  getPackageLicenseExpression,
  getPackageSupplierOrganization,
  IPackage,
} from '../../../shared/spdx/models/2.3/package';
import { parseSpdxLegacySecurityAdvisories } from '../../../shared/spdx/parseSpdxLegacySecurityAdvisories';

import { SbomDocumentHeader } from './documentHeader';
import { SpdxFileTableCard } from './spdxFileTableCard';
import { SpdxLicenseTableCard } from './spdxLicenseTableCard';
import { SpdxPackageTableCard } from './spdxPackageTableCard';
import { SpdxRelationshipCard } from './spdxRelationshipCard';
import { SpdxSecurityTableCard } from './spdxSecurityTableCard';
import { SpdxSummaryCard } from './spdxSummaryCard';
import { SpdxSupplierTableCard } from './spdxSupplierTableCard';

interface Props {
  artifact: ISbomBuildArtifact;
  onLoadArtifacts: (files: File[]) => void;
}

interface State {
  files: IFile[];
  packages: IPackage[];
  securityAdvisories: ISecurityVulnerability[];
  licenses: ILicense[];
  suppliers: string[];
}

export class SbomDocumentPage extends React.Component<Props, State> {
  private selectedTabId: ObservableValue<string>;
  private filter: IFilter;

  constructor(props: Props) {
    super(props);
    this.state = SbomDocumentPage.getDerivedStateFromProps(props);
    this.selectedTabId = new ObservableValue('summary');
    this.filter = new Filter();
  }

  static getDerivedStateFromProps(props: Props): State {
    const spdx = props.artifact.spdxDocument;
    const files = spdx.files || [];
    const packages = (spdx.packages || []).filter((p) => {
      return !isPackageRootLevel(spdx, p.SPDXID);
    });
    const securityAdvisories = packages
      .flatMap(
        (pkg: IPackage) =>
          parseExternalRefsAs<ISecurityVulnerability>(
            pkg.externalRefs || [],
            ExternalRefCategory.Security,
            ExternalRefSecurityType.Url,
          ) ||
          parseSpdxLegacySecurityAdvisories(pkg) ||
          [],
      )
      .filter((vuln): vuln is ISecurityVulnerability => !!vuln && !!vuln.package && !!vuln.advisory)
      .distinctBy((vuln: ISecurityVulnerability) => vuln.advisory.permalink);
    const licenses = packages
      .map((pkg) => getPackageLicenseExpression(pkg))
      .distinct()
      .filter((licenseExpression): licenseExpression is string => !!licenseExpression)
      .flatMap((licenseExpression: string) => getLicensesFromExpression(licenseExpression))
      .filter((license): license is ILicense => !!license)
      .distinctBy((license: ILicense) => license.id);
    const suppliers = packages
      .map((pkg) => getPackageSupplierOrganization(pkg))
      .filter((supplier): supplier is string => !!supplier)
      .distinct();

    return {
      files,
      packages,
      securityAdvisories,
      licenses,
      suppliers,
    };
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.artifact !== this.props.artifact) {
      this.setState(SbomDocumentPage.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.props?.artifact || !this.state) {
      return <div />;
    }
    // TODO: Use page providers; https://developer.microsoft.com/en-us/azure-devops/components/page#page-with-providers
    return (
      <Page orientation={Orientation.Vertical} className="flex-grow full-view-height ">
        <SbomDocumentHeader artifact={this.props.artifact} onLoadArtifacts={this.props.onLoadArtifacts} />
        <TabBar
          onSelectedTabChanged={this.onSelectedTabChanged}
          selectedTabId={this.selectedTabId}
          tabSize={TabSize.Tall}
          renderAdditionalContent={this.onRenderFilterBar}
          className="margin-vertical-16"
        >
          <Tab id="summary" name="Summary" />
          <Tab id="files" name="Files" badgeCount={this.state.files.length} />
          {this.state.packages.length ? (
            <Tab id="packages" name="Packages" badgeCount={this.state.packages.length} />
          ) : null}
          {this.state.licenses.length ? (
            <Tab id="licenses" name="Licenses" badgeCount={this.state.licenses.length} />
          ) : null}
          {this.state.suppliers.length ? (
            <Tab id="suppliers" name="Suppliers" badgeCount={this.state.suppliers.length} />
          ) : null}
          {this.state.securityAdvisories.length ? (
            <Tab id="securityAdvisories" name="Security Advisories" badgeCount={this.state.securityAdvisories.length} />
          ) : null}
          {this.props.artifact.loadSvgDocumentAsync ? (
            <Tab
              id="relationships"
              name="Relationship View"
              iconProps={{ iconName: 'FlowChart', className: 'margin-right-4' }}
            />
          ) : null}
        </TabBar>
        <TabContent>
          <Observer selectedTabId={this.selectedTabId}>
            {(props: { selectedTabId: string }) => {
              switch (props.selectedTabId) {
                case 'summary':
                  return (
                    <div className="page-content flex-grow">
                      <SpdxSummaryCard
                        document={this.props.artifact.spdxDocument}
                        files={this.state.files}
                        packages={this.state.packages}
                        securityAdvisories={this.state.securityAdvisories}
                        licenses={this.state.licenses}
                        suppliers={this.state.suppliers}
                      />
                    </div>
                  );
                case 'files':
                  return (
                    <div className="page-content flex-grow">
                      <SpdxFileTableCard
                        document={this.props.artifact.spdxDocument}
                        files={this.state.files}
                        filter={this.filter}
                      />
                    </div>
                  );
                case 'packages':
                  return (
                    <div className="page-content flex-grow">
                      <SpdxPackageTableCard
                        document={this.props.artifact.spdxDocument}
                        packages={this.state.packages}
                        filter={this.filter}
                      />
                    </div>
                  );
                case 'licenses':
                  return (
                    <div className="page-content flex-grow">
                      <SpdxLicenseTableCard
                        document={this.props.artifact.spdxDocument}
                        licenses={this.state.licenses}
                        filter={this.filter}
                      />
                    </div>
                  );
                case 'suppliers':
                  return (
                    <div className="page-content flex-grow">
                      <SpdxSupplierTableCard
                        document={this.props.artifact.spdxDocument}
                        suppliers={this.state.suppliers}
                        filter={this.filter}
                      />
                    </div>
                  );
                case 'securityAdvisories':
                  return (
                    <div className="page-content flex-grow">
                      <SpdxSecurityTableCard
                        document={this.props.artifact.spdxDocument}
                        securityAdvisories={this.state.securityAdvisories}
                        filter={this.filter}
                      />
                    </div>
                  );
                case 'relationships':
                  return (
                    <SpdxRelationshipCard
                      document={this.props.artifact.spdxDocument}
                      loadSvgDocumentAsync={this.props.artifact.loadSvgDocumentAsync}
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
