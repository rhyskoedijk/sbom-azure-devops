import * as React from 'react';

import { Cell, Legend, Pie, PieChart as RePieChart, ResponsiveContainer } from 'recharts';

import { DEFAULT_COLORS } from './Colours';

import './PieChart.scss';

export interface ChartSlice {
  name: string;
  value: number;
}

interface Props {
  className?: string;
  colors?: string[];
  data: ChartSlice[];
  title?: string;
  width?: number;
  height?: number;
}

interface State {
  colors: string[];
  slices: ChartSlice[];
  total: number;
}

export class PieChart extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = PieChart.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    return {
      slices: props.data,
      colors: props.colors?.length ? props.colors : DEFAULT_COLORS,
      total: props.data.reduce((acc, item) => acc + item.value, 0),
    };
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.data !== this.props.data) {
      this.setState(PieChart.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    return !this.state.total ? (
      <div />
    ) : (
      <div
        className={'pie-chart flex-column flex-center ' + (this.props.className || '')}
        style={{ minWidth: 250, minHeight: 250 }}
      >
        {this.props.title && <h3 className="title">{this.props.title}</h3>}
        <ResponsiveContainer width={this.props.width || '100%'} height={this.props.height || '100%'} debounce={200}>
          <RePieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Legend
              iconType="circle"
              layout="vertical"
              verticalAlign="bottom"
              iconSize={10}
              formatter={renderLegendText}
            />
            <Pie data={this.state.slices} dataKey="value" innerRadius={60} outerRadius={100}>
              {this.state.slices.map((cell, index) => (
                <Cell key={`cell-${index}`} fill={this.state.colors[index % this.state.colors.length]} />
              ))}
            </Pie>
          </RePieChart>
        </ResponsiveContainer>
      </div>
    );
  }
}

const renderLegendText = (value: string, entry: any) => {
  return (
    <span className="secondary-text padding-8" style={{ fontWeight: 500 }}>
      {value} ({entry.payload.value})
    </span>
  );
};
