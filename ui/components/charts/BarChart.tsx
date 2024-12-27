import * as React from 'react';

import {
  Bar,
  CartesianGrid,
  Legend,
  BarChart as ReBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { DEFAULT_COLORS } from './Colours';

import './BarChart.scss';

export interface ChartSeries {
  name: string;
  values: Record<string, number>;
}

export interface ChartBar {
  name: string;
  color?: string;
  stack?: string;
}

interface Props {
  className?: string;
  colors?: string[];
  bars: ChartBar[];
  data: ChartSeries[];
  title?: string;
  width?: number;
  height?: number;
}

interface State {
  colors: string[];
  bars: ChartBar[];
  data: ChartSeries[];
  total: number;
}

export class BarChart extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = BarChart.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    console.log(props.bars, props.data);
    return {
      colors: props.colors?.length ? props.colors : DEFAULT_COLORS,
      bars: props.bars,
      data: props.data,
      total: props.data.reduce(
        (accX, itemX) => accX + Object.values(itemX.values).reduce((accY, itemY) => accY + itemY, 0),
        0,
      ),
    };
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.data !== this.props.data) {
      this.setState(BarChart.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    return !this.state.total ? (
      <div />
    ) : (
      <div className={'bar-chart flex-column flex-center ' + (this.props.className || '')}>
        {this.props.title && <h3 className="title">{this.props.title}</h3>}
        <ResponsiveContainer width={this.props.width || '100%'} height={this.props.height || '100%'} debounce={300}>
          <ReBarChart data={this.state.data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} reverseStackOrder={true}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            {this.state.bars.map((bar, index) => (
              <Bar
                key={`bar-${index}`}
                label={bar.name}
                dataKey={(series: ChartSeries) => series.values[bar.name] || 0}
                stackId={bar.stack}
                fill={bar.color || this.state.colors[index % this.state.colors.length]}
              />
            ))}
          </ReBarChart>
        </ResponsiveContainer>
      </div>
    );
  }
}
