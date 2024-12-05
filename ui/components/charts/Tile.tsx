import * as React from 'react';

import { IColor } from 'azure-devops-extension-api';
import { rgbToHex } from 'azure-devops-ui/Utilities/Color';

import './Tile.scss';

interface Props {
  className?: string;
  color?: IColor;
  value: string;
  title?: string;
  header?: string;
  footer?: string;
  size?: number;
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
      <div
        className={
          'tile text-on-communication-background flex-column flex-center flex-grow flex-gap-4 padding-16 ' +
          (this.props.className || '')
        }
        style={{
          backgroundColor: this.props.color ? rgbToHex(this.props.color) : undefined,
          width: this.props.size,
          height: this.props.size,
        }}
      >
        {this.props.title && <h3 className="title">{this.props.title}</h3>}
        <div className="value flex-grow" style={{ fontSize: this.props.header || this.props.footer ? '3rem' : '5rem' }}>
          {this.props.value}
        </div>
        {this.props.header && <div className="header text-center">{this.props.header}</div>}
        {this.props.footer && <div className="footer text-center">{this.props.footer}</div>}
      </div>
    );
  }
}
