import * as React from 'react';

import { ObservableValue } from 'azure-devops-ui/Core/Observable';
import { Observer } from 'azure-devops-ui/Observer';
import { Orientation, Page } from 'azure-devops-ui/Page';
import { Tab, TabBar, TabContent, TabSize } from 'azure-devops-ui/Tabs';
import { InlineKeywordFilterBarItem } from 'azure-devops-ui/TextFilterBarItem';
import { Filter, IFilter } from 'azure-devops-ui/Utilities/Filter';

import { ISecurityVulnerability } from '../../../shared/ghsa/ISecurityVulnerability';
import { ISbomBuildArtifact } from '../../../shared/models/ISbomBuildArtifact';
import { isPackageRootLevel } from '../../../shared/models/spdx/2.3/IDocument';
import {
  ExternalRefCategory,
  ExternalRefSecurityType,
  parseExternalRefsAs,
} from '../../../shared/models/spdx/2.3/IExternalRef';
import { IFile } from '../../../shared/models/spdx/2.3/IFile';
import { getLicensesFromExpression, ILicense } from '../../../shared/models/spdx/2.3/ILicense';
import {
  getPackageLicenseExpression,
  getPackageSupplierOrganization,
  IPackage,
} from '../../../shared/models/spdx/2.3/IPackage';
import { parseSpdxSecurityAdvisoriesLegacy } from '../../../shared/spdx/parseSpdxSecurityAdvisoriesLegacy';

import { SbomDocumentHeader } from './SbomDocumentHeader';
import { SpdxFileTableCard } from './SpdxFileTableCard';
import { SpdxLicenseTableCard } from './SpdxLicenseTableCard';
import { SpdxPackageTableCard } from './SpdxPackageTableCard';
import { SpdxRelationshipCard } from './SpdxRelationshipCard';
import { SpdxSecurityTableCard } from './SpdxSecurityTableCard';
import { SpdxSummaryCard } from './SpdxSummaryCard';
import { SpdxSupplierTableCard } from './SpdxSupplierTableCard';

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
          parseSpdxSecurityAdvisoriesLegacy(pkg) ||
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
      <Page orientation={Orientation.Vertical} className="flex-grow">
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
          {this.state.securityAdvisories.length ? (
            <Tab id="securityAdvisories" name="Security Advisories" badgeCount={this.state.securityAdvisories.length} />
          ) : null}
          {this.state.licenses.length ? (
            <Tab id="licenses" name="Licenses" badgeCount={this.state.licenses.length} />
          ) : null}
          {this.state.suppliers.length ? (
            <Tab id="suppliers" name="Suppliers" badgeCount={this.state.suppliers.length} />
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
                    <div className="page-content">
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
                    <div className="page-content">
                      <SpdxFileTableCard
                        document={this.props.artifact.spdxDocument}
                        files={this.state.files}
                        filter={this.filter}
                      />
                    </div>
                  );
                case 'packages':
                  return (
                    <div className="page-content">
                      <SpdxPackageTableCard
                        document={this.props.artifact.spdxDocument}
                        packages={this.state.packages}
                        filter={this.filter}
                      />
                    </div>
                  );
                case 'securityAdvisories':
                  return (
                    <div className="page-content">
                      <SpdxSecurityTableCard
                        document={this.props.artifact.spdxDocument}
                        securityAdvisories={this.state.securityAdvisories}
                        filter={this.filter}
                      />
                    </div>
                  );
                case 'licenses':
                  return (
                    <div className="page-content">
                      <SpdxLicenseTableCard
                        document={this.props.artifact.spdxDocument}
                        licenses={this.state.licenses}
                        filter={this.filter}
                      />
                    </div>
                  );
                case 'suppliers':
                  return (
                    <div className="page-content">
                      <SpdxSupplierTableCard
                        document={this.props.artifact.spdxDocument}
                        suppliers={this.state.suppliers}
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
