import * as React from 'react';

import { Button } from 'azure-devops-ui/Button';
import { ObservableValue } from 'azure-devops-ui/Core/Observable';
import { Observer } from 'azure-devops-ui/Observer';

const MAX_ITEMS_VISIBLE = 3;

interface Props<T> {
  className?: string;
  max?: number;
  items: T[];
  renderItem: (item: T, index: number) => JSX.Element;
  showMoreCount?: boolean;
}

interface State<T> {
  items: T[];
  itemsVisible: ObservableValue<number>;
  itemsTotal: number;
}

export class ExpandableList<T> extends React.Component<Props<T>, State<T>> {
  constructor(props: Props<T>) {
    super(props);
    this.state = ExpandableList.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props<any>): State<any> {
    return {
      items: props.items,
      itemsVisible: new ObservableValue<number>(props.max || MAX_ITEMS_VISIBLE),
      itemsTotal: props.items.length,
    };
  }

  public componentDidUpdate(prevProps: Readonly<Props<T>>): void {
    if (prevProps.items !== this.props.items) {
      this.setState(ExpandableList.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    return (
      <Observer itemsVisible={this.state.itemsVisible}>
        {(props: { itemsVisible: number }) => (
          <div className={'flex-row flex-wrap flex-gap-4 ' + (this.props.className || '')}>
            {this.state.items.slice(0, props.itemsVisible).map((item, index) => this.props.renderItem(item, index))}
            {this.state.itemsTotal > (this.props.max || MAX_ITEMS_VISIBLE) && (
              <Button
                onClick={(e) => {
                  this.state.itemsVisible.value =
                    props.itemsVisible !== this.state.itemsTotal
                      ? this.state.itemsTotal
                      : this.props.max || MAX_ITEMS_VISIBLE;
                  e.stopPropagation();
                }}
                iconProps={{
                  iconName: props.itemsVisible !== this.state.itemsTotal ? 'ChevronRight' : 'ChevronLeft',
                }}
                tooltipProps={{
                  text: props.itemsVisible !== this.state.itemsTotal ? 'Show more' : 'Show less',
                }}
                text={
                  props.itemsVisible !== this.state.itemsTotal
                    ? this.props.showMoreCount
                      ? `+${this.state.itemsTotal - props.itemsVisible} More`
                      : 'More'
                    : 'Less'
                }
              />
            )}
          </div>
        )}
      </Observer>
    );
  }
}
