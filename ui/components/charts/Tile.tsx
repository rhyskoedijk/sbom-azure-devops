import * as React from 'react';

import { IColor } from 'azure-devops-extension-api';
import { Tooltip } from 'azure-devops-ui/TooltipEx';
import { rgbToHex } from 'azure-devops-ui/Utilities/Color';

import './Tile.scss';

interface Props {
  className?: string;
  color?: IColor;
  size?: number;
  value: string;
  title?: string;
  subtitle?: string;
}

interface State {}

export class Tile extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = Tile.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    return {};
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.value !== this.props.value) {
      this.setState(Tile.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    return (
      <Tooltip text={`${this.props.title}: ${this.props.value}`}>
        <div
          className={
            'tile text-on-communication-background flex-column flex-center padding-8 ' + (this.props.className || '')
          }
          style={{
            backgroundColor: this.props.color ? rgbToHex(this.props.color) : undefined,
            width: this.props.size || 160,
            height: this.props.size || 160,
          }}
        >
          {this.props.title && <h2 className="title text-ellipsis">{this.props.title}</h2>}
          <div className="flex-column flex-center flex-grow">
            <div className="value">{this.props.value.substring(0, 5)}</div>
          </div>
          {this.props.subtitle && <div className="subtitle text-ellipsis">{this.props.subtitle}</div>}
        </div>
      </Tooltip>
    );
  }
}
