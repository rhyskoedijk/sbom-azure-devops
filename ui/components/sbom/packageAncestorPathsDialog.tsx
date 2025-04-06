import * as React from 'react';

import { CustomDialog } from 'azure-devops-ui/Dialog';
import { CustomHeader, HeaderTitleArea } from 'azure-devops-ui/Header';
import { Icon, IconSize } from 'azure-devops-ui/Icon';
import { Link } from 'azure-devops-ui/Link';
import { PanelContent } from 'azure-devops-ui/Panel';

import { IPackageDependencyPath } from '../../../shared/spdx/models/2.3/document';
import { getExternalRefPackageManagerUrl } from '../../../shared/spdx/models/2.3/externalRef';
import { IPackage } from '../../../shared/spdx/models/2.3/package';

import { ExpandableList } from '../expandableList';

interface Props {
  packageName: string;
  packageVersion: string;
  packageDependencyPaths: IPackageDependencyPath[];
  onDismiss: () => void;
}

interface State {}

export class PackageAncestorPathsDialog extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = PackageAncestorPathsDialog.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    return {};
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps !== this.props) {
      this.setState(PackageAncestorPathsDialog.getDerivedStateFromProps(this.props));
    }
  }

  private renderPackageItem(item: IPackage, index: number): JSX.Element {
    return (
      <div key={index} className={'flex-row text-ellipsis ' + (index > 0 ? ' secondary-text' : undefined)}>
        {index > 0 ? <Icon size={IconSize.small} iconName="ChevronRightSmall" /> : null}
        <Link
          className={'bolt-table-link bolt-table-link-inline flex-row flex-center'}
          href={getExternalRefPackageManagerUrl(item.externalRefs)}
          target={'_blank'}
          excludeTabStop
        >
          <span>
            {item.name} <span className="secondary-text">{item.versionInfo}</span>
          </span>
        </Link>
      </div>
    );
  }

  public render(): JSX.Element {
    return (
      <CustomDialog onDismiss={this.props.onDismiss} modal={true}>
        <CustomHeader className="bolt-header-with-commandbar" separator>
          <HeaderTitleArea>
            <div className="title-m">
              <span>
                {this.props.packageName} {this.props.packageVersion}
              </span>
            </div>
            <div className="subtitle-s secondary-text">
              <span>Ancestor Package Paths</span>
            </div>
          </HeaderTitleArea>
        </CustomHeader>
        <PanelContent className="padding-vertical-20">
          <div className="flex-column rhythm-vertical-8">
            {this.props.packageDependencyPaths.map((ancestor, index) => (
              <ExpandableList key={index} max={1} items={ancestor.dependencyPath} renderItem={this.renderPackageItem} />
            ))}
          </div>
        </PanelContent>
      </CustomDialog>
    );
  }
}
