import * as React from 'react';

import { cheerfulFiestaPalette, PieChart as MuiPieChart, PieValueType as MuiPieChartValue } from '@mui/x-charts';
import { MakeOptional } from '@mui/x-charts/internals';

import './PieChart.scss';

export interface PieChartValue {
  label: string;
  value: number;
}

interface Props {
  className?: string;
  colors?: string[];
  data: PieChartValue[];
  title?: string;
  width?: number;
  height?: number;
}

interface State {
  data: MakeOptional<MuiPieChartValue, 'id'>[];
  total: number;
}

export class PieChart extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = PieChart.getDerivedStateFromProps(props);
  }

  static getDerivedStateFromProps(props: Props): State {
    return {
      data: props.data,
      total: props.data.reduce((acc, item) => acc + item.value, 0),
    };
  }

  public componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.data !== this.props.data) {
      this.setState(PieChart.getDerivedStateFromProps(this.props));
    }
  }

  public render(): JSX.Element {
    return (
      <div className={'pie-chart flex-column flex-center flex-grow ' + (this.props.className || '')}>
        {this.props.title && <h3 className="title">{this.props.title}</h3>}
        <MuiPieChart
          margin={{ top: 10, left: 10, right: 10, bottom: 10 }}
          colors={this.props.colors || cheerfulFiestaPalette}
          series={[
            {
              arcLabel: (item) => `${item.label?.substring(0, 20)}`,
              arcLabelMinAngle: 30,
              innerRadius: '50%',
              highlightScope: { fade: 'global', highlight: 'item' },
              faded: { color: 'gray', additionalRadius: -10, innerRadius: 60 },
              data: this.state.data || [],
            },
          ]}
          slotProps={{
            legend: {
              hidden: true,
              direction: 'column',
              position: {
                horizontal: 'middle',
                vertical: 'bottom',
              },
              labelStyle: {
                fill: 'var(--text-primary-color)',
                fontSize: '0.8em',
              },
            },
          }}
          width={this.props.width || 250}
          height={this.props.height || 250}
        />
      </div>
    );
  }
}
