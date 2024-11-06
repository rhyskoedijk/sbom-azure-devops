import * as React from 'react';

import { ObservableValue } from 'azure-devops-ui/Core/Observable';
import { Observer } from 'azure-devops-ui/Observer';
import { Tab, TabBar, TabSize } from 'azure-devops-ui/Tabs';
import { InlineKeywordFilterBarItem } from 'azure-devops-ui/TextFilterBarItem';
import { Filter, FILTER_CHANGE_EVENT, IFilter } from 'azure-devops-ui/Utilities/Filter';

import { ISpdx22Document } from '../models/Spdx22';
import { SpdxDependencyTableCard } from './SpdxDependencyTableCard';
import { SpdxGraphCard } from './SpdxGraphCard';
import { SpdxInventoryTableCard } from './SpdxInventoryTableCard';
import { SpdxSecurityTableCard } from './SpdxSecurityTableCard';
import { SpdxSummaryCard } from './SpdxSummaryCard';

interface Props {
  document: ISpdx22Document;
}

interface State {
  inventoryCount: number;
  dependencyCount: number;
  securityAdvisoryCount: number;
}

export class SpdxDocument extends React.Component<Props, State> {
  private selectedTabId: ObservableValue<string>;
  private filter: IFilter;

  constructor(props: Props) {
    super(props);
    this.state = SpdxDocument.getDerivedStateFromProps(props);
    this.selectedTabId = new ObservableValue('inventory');
    this.filter = new Filter();
    this.filter.subscribe(() => {
      alert('TODO: Implement keyword filter change event');
    }, FILTER_CHANGE_EVENT);
  }

  static getDerivedStateFromProps(props: Props): State {
    return {
      inventoryCount: props.document?.files?.length || 0,
      dependencyCount: props.document?.relationships?.filter((r) => r.relationshipType == 'DEPENDS_ON')?.length || 0,
      securityAdvisoryCount:
        props.document?.packages?.flatMap((p) =>
          p.externalRefs.filter((r) => r.referenceCategory == 'SECURITY' && r.referenceType == 'advisory'),
        )?.length || 0,
    };
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.document !== this.props.document) {
      this.setState(SpdxDocument.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    if (!this.props?.document || !this.state) {
      return <div />;
    }
    return (
      <div className="flex-grow">
        <SpdxSummaryCard document={this.props.document} />
        <TabBar
          onSelectedTabChanged={this.onSelectedTabChanged}
          selectedTabId={this.selectedTabId}
          tabSize={TabSize.Tall}
          renderAdditionalContent={this.onRenderFilterBar}
          className="margin-vertical-16 bolt-tabbar bolt-tabbar-grey"
        >
          <Tab name="Inventory" id="inventory" badgeCount={this.state.inventoryCount} />
          <Tab name="Dependencies" id="dependencies" badgeCount={this.state.dependencyCount} />
          <Tab name="Security Advisories" id="security" badgeCount={this.state.securityAdvisoryCount} />
          <Tab name="Graph View" id="graph" />
        </TabBar>
        <Observer selectedTabId={this.selectedTabId}>
          {(props: { selectedTabId: string }) => {
            switch (props.selectedTabId) {
              case 'inventory':
                return <SpdxInventoryTableCard document={this.props.document} filter={this.filter} />;
              case 'dependencies':
                return <SpdxDependencyTableCard document={this.props.document} filter={this.filter} />;
              case 'security':
                return <SpdxSecurityTableCard document={this.props.document} filter={this.filter} />;
              case 'graph':
                return <SpdxGraphCard document={this.props.document} />;
            }
          }}
        </Observer>
      </div>
    );
  }

  private onRenderFilterBar = () => {
    return <InlineKeywordFilterBarItem filter={this.filter} filterItemKey="keyword" />;
  };

  private onSelectedTabChanged = (newTabId: string) => {
    this.selectedTabId.value = newTabId;
  };
}
