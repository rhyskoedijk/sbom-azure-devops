import { Card } from 'azure-devops-ui/Card';
import { ObservableValue } from 'azure-devops-ui/Core/Observable';
import { DropdownFilterBarItem } from 'azure-devops-ui/Dropdown';
import { FilterBar } from 'azure-devops-ui/FilterBar';
import { Header, TitleSize } from 'azure-devops-ui/Header';
import { IHeaderCommandBarItem } from 'azure-devops-ui/HeaderCommandBar';
import { Page } from 'azure-devops-ui/Page';
import { KeywordFilterBarItem } from 'azure-devops-ui/TextFilterBarItem';
import { DropdownMultiSelection, DropdownSelection } from 'azure-devops-ui/Utilities/DropdownSelection';
import { Filter, FILTER_CHANGE_EVENT, FilterOperatorType } from 'azure-devops-ui/Utilities/Filter';
import * as React from 'react';

import { SbomPackageTable } from './SbomPackageTable';

const commandBarItems: IHeaderCommandBarItem[] = [
  {
    id: 'downloadSpdx',
    important: true,
    isPrimary: true,
    iconProps: {
      iconName: 'Download',
    },
    onActivate: () => {
      alert('TODO: Download SPDX');
    },
    text: 'Download SPDX',
  },
  {
    id: 'exportXlsx',
    text: 'Export to XLSX',
    iconProps: {
      iconName: 'Export',
    },
    important: false,
    onActivate: () => {
      alert('TODO: Export to XLSX');
    },
  },
  {
    id: 'exportSvg',
    text: 'Export to SVG',
    iconProps: {
      iconName: 'Export',
    },
    important: false,
    onActivate: () => {
      alert('TODO: Export to SVG');
    },
  },
];

const projectListItems = ['Item 1', 'Item 2', 'Item 3'];

const repositoryListItems = ['Item 4', 'Item 5', 'Item 6'];

export class SbomInventoryPage extends React.Component<{}, {}> {
  private filter: Filter;
  private filterState = new ObservableValue('');
  private selectedProject = new DropdownSelection();
  private selectedRepository = new DropdownMultiSelection();

  constructor(props: {}) {
    super(props);
    this.state = { projectContext: undefined };
    this.filter = new Filter();
    this.filter.setFilterItemState('listMulti', {
      value: [],
      operator: FilterOperatorType.and,
    });
    this.filter.subscribe(() => {
      this.filterState.value = JSON.stringify(this.filter.getState(), null, 4);
    }, FILTER_CHANGE_EVENT);
  }

  public render(): JSX.Element {
    return (
      <Page className="sbom-inventory-page flex-grow">
        <Header
          title={'Software Bill of Materials (SBOM) - Inventory'}
          commandBarItems={commandBarItems}
          titleSize={TitleSize.Medium}
          titleIconProps={{ iconName: 'Certificate' }}
          titleAriaLevel={3}
        />
        <div className="page-content page-content-top">
          <div className="flex-grow">
            <FilterBar filter={this.filter}>
              <KeywordFilterBarItem filterItemKey="filter" />
              <DropdownFilterBarItem
                filterItemKey="project"
                filter={this.filter}
                items={projectListItems.map((i) => {
                  return {
                    id: i,
                    text: i,
                    iconProps: { iconName: 'ProjectCollection' },
                  };
                })}
                selection={this.selectedProject}
                placeholder="Project"
              />
              <DropdownFilterBarItem
                filterItemKey="repository"
                filter={this.filter}
                items={repositoryListItems.map((i) => {
                  return {
                    id: i,
                    text: i,
                    iconProps: { iconName: 'FileCode' },
                  };
                })}
                selection={this.selectedRepository}
                placeholder="Repository"
              />
            </FilterBar>
          </div>
          <Card className="flex-grow">
            <SbomPackageTable></SbomPackageTable>
          </Card>
        </div>
      </Page>
    );
  }
}
