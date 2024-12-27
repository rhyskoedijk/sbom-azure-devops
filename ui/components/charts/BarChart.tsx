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
import { calculateMaxTextWidth } from './MeasureText';

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
  layout?: 'vertical' | 'horizontal';
  legend?: boolean;
  width?: number;
  height?: number;
}

interface State {
  isVertical: boolean;
  colors: string[];
  bars: ChartBar[];
  data: ChartSeries[];
  dataLabelMaxWidth: number;
  total: number;
}

export class BarChart extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = BarChart.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    return {
      isVertical: props.layout == 'vertical',
      colors: props.colors?.length ? props.colors : DEFAULT_COLORS,
      bars: props.bars,
      data: props.data,
      dataLabelMaxWidth: calculateMaxTextWidth(props.data.map((item) => item.name)),
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
      <div
        className={'bar-chart flex-column flex-center ' + (this.props.className || '')}
        style={{ minWidth: 500, minHeight: 250 }}
      >
        {this.props.title && <h3 className="title">{this.props.title}</h3>}
        <ResponsiveContainer width={this.props.width || '100%'} height={this.props.height || '100%'} debounce={200}>
          <ReBarChart
            data={this.state.data}
            margin={{
              top: 0,
              right: 0,
              bottom: 0,
              left: this.state.isVertical ? this.state.dataLabelMaxWidth : 0,
            }}
            layout={this.props.layout}
            reverseStackOrder={true}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={this.state.isVertical ? undefined : 'name'}
              type={this.state.isVertical ? 'number' : 'category'}
            />
            <YAxis
              dataKey={this.state.isVertical ? 'name' : undefined}
              type={this.state.isVertical ? 'category' : 'number'}
            />
            <Tooltip />
            {this.props.legend && (
              <Legend
                iconType="circle"
                layout="vertical"
                verticalAlign="bottom"
                iconSize={10}
                formatter={renderLegendText}
              />
            )}
            {this.state.bars.map((bar, index) => (
              <Bar
                key={`bar-${index}`}
                label={bar.name}
                dataKey={(series: ChartSeries) => series.values[bar.name] || 0}
                stackId={bar.stack}
                fill={bar.color || this.state.colors[index % this.state.colors.length]}
                orientation={bar.stack ? 'vertical' : 'horizontal'}
              />
            ))}
          </ReBarChart>
        </ResponsiveContainer>
      </div>
    );
  }
}

const renderLegendText = (value: string, entry: any) => {
  return (
    <span className="secondary-text padding-8" style={{ fontWeight: 500 }}>
      {value}
    </span>
  );
};
