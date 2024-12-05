import * as React from 'react';

import { BarSeriesType, cheerfulFiestaPalette, BarChart as MuiBarChart } from '@mui/x-charts';
import { MakeOptional } from '@mui/x-charts/internals';

import './BarChart.scss';

export interface BarChartSeries {
  color?: string;
  label: string;
  data: number[];
  stack?: string;
}

interface Props {
  className?: string;
  colors?: string[];
  bands?: string[];
  data: BarChartSeries[];
  layout: 'horizontal' | 'vertical';
  title?: string;
  width?: number;
  height?: number;
}

interface State {
  series: MakeOptional<BarSeriesType, 'type'>[];
}

export class BarChart extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = BarChart.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    return {
      series: props.data.map((d) => ({
        type: 'bar',
        layout: props.layout,
        label: d.label,
        data: d.data,
        stack: d.stack,
        ...(d.color ? { color: d.color } : {}),
      })),
    };
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.data !== this.props.data) {
      this.setState(BarChart.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    return (
      <div className={'bar-chart flex-column flex-center flex-grow ' + (this.props.className || '')}>
        {this.props.title && <h3 className="title">{this.props.title}</h3>}
        <MuiBarChart
          barLabel="value"
          colors={this.props.colors || cheerfulFiestaPalette}
          series={this.state.series}
          layout={this.props.layout}
          {...(this.props.layout === 'vertical'
            ? { xAxis: [{ scaleType: 'band', data: this.props.bands || [] }] }
            : {})}
          {...(this.props.layout === 'horizontal'
            ? { yAxis: [{ scaleType: 'band', data: this.props.bands || [] }] }
            : {})}
          slotProps={{
            legend: {
              labelStyle: {
                fill: 'var(--text-primary-color)',
                fontSize: '0.8em',
              },
            },
          }}
          margin={{ left: 75 }}
          width={this.props.width || 600}
          height={this.props.height || 200}
        />
      </div>
    );
  }
}
