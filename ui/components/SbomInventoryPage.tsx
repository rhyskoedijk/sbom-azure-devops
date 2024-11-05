import * as React from 'react';

import { Card } from 'azure-devops-ui/Card';
import { ObservableValue } from 'azure-devops-ui/Core/Observable';
import { DropdownFilterBarItem } from 'azure-devops-ui/Dropdown';
import { FilterBar } from 'azure-devops-ui/FilterBar';
import { IHeaderCommandBarItem } from 'azure-devops-ui/HeaderCommandBar';
import { KeywordFilterBarItem } from 'azure-devops-ui/TextFilterBarItem';
import { DropdownMultiSelection, DropdownSelection } from 'azure-devops-ui/Utilities/DropdownSelection';
import { Filter, FILTER_CHANGE_EVENT, FilterOperatorType } from 'azure-devops-ui/Utilities/Filter';

import { ISpdx22Document } from '../models/Spdx22';
import { SbomPackageTable } from './SbomPackageTable';

const commandBarItems: IHeaderCommandBarItem[] = [
  {
    id: 'downloadSpdx',
    text: 'Download SPDX',
    iconProps: {
      iconName: 'Download',
    },
    onActivate: () => {
      alert('TODO: Download SPDX');
    },
  },
  {
    id: 'convertXlsx',
    text: 'Convert to XLSX',
    iconProps: {
      iconName: 'Export',
    },
    important: false,
    onActivate: () => {
      alert('TODO: Convert to XLSX');
    },
  },
  {
    id: 'convertSvg',
    text: 'Convert to SVG',
    iconProps: {
      iconName: 'Export',
    },
    important: false,
    onActivate: () => {
      alert('TODO: Convert to SVG');
    },
  },
];

const projectListItems = ['Item 1', 'Item 2', 'Item 3'];

const repositoryListItems = ['Item 4', 'Item 5', 'Item 6'];

interface ISbomInventoryPageProps {
  document: ISpdx22Document;
}

export class SbomInventoryPage extends React.Component<ISbomInventoryPageProps, ISbomInventoryPageProps> {
  private filter: Filter;
  private filterState = new ObservableValue('');
  private selectedProject = new DropdownSelection();
  private selectedRepository = new DropdownMultiSelection();

  constructor(props: ISbomInventoryPageProps) {
    super(props);
    this.state = props;
    this.filter = new Filter();
    this.filter.setFilterItemState('listMulti', {
      value: [],
      operator: FilterOperatorType.and,
    });
    this.filter.subscribe(() => {
      this.filterState.value = JSON.stringify(this.filter.getState(), null, 4);
    }, FILTER_CHANGE_EVENT);
  }

  private getDocumentProperies(): { label: string; value: string | number }[] {
    return [
      {
        label: 'Name',
        value: this.state.document.name,
      },
      {
        label: 'Version',
        value: this.state.document.spdxVersion,
      },
      {
        label: 'Data License',
        value: this.state.document.dataLicense,
      },
      {
        label: 'Created',
        value: this.state.document.creationInfo.created,
      },
      {
        label: 'Creators',
        value: this.state.document.creationInfo.creators.join(', '),
      },
    ];
  }

  public render(): JSX.Element {
    return (
      <div>
        <Card
          className="flex-grow bolt-card bolt-card-white"
          titleProps={{ text: 'Software Bill of Materials (SBOM)', ariaLevel: 3 }}
          headerIconProps={{ iconName: 'Certificate' }}
          headerCommandBarItems={commandBarItems}
        >
          <div className="flex-row" style={{ flexWrap: 'wrap' }}>
            {this.getDocumentProperies().map((items, index) => (
              <div className="flex-column" style={{ minWidth: '120px' }} key={index}>
                <div className="body-m secondary-text">{items.label}</div>
                <div className="body-m primary-text">{items.value}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card
          className="flex-grow flex-column bolt-card bolt-table-card bolt-card-with-header bolt-card-white margin-top-16"
          titleProps={{ text: 'Inventory', ariaLevel: 3 }}
        >
          <div className="flex-grow flex-column">
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
            {this.state?.document?.packages && (
              <SbomPackageTable packages={this.state.document.packages}></SbomPackageTable>
            )}
          </div>
        </Card>
      </div>
    );
  }
}
