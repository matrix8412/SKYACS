// Categorized ECharts chart types for the metric chart-type selector.
// `timeSeries` marks the types that can render a time-series (x = time) chart.
// Non-time-series types show a fallback message in MetricChart.
export interface EChartsType {
  value: string;
  label: string;
  category: string;
  timeSeries: boolean;
}

export const ECHARTS_TYPES: EChartsType[] = [
  { value: 'line', label: 'Line', category: 'Line', timeSeries: true },
  { value: 'bar', label: 'Bar', category: 'Bar', timeSeries: true },
  { value: 'pictorialBar', label: 'Pictorial Bar', category: 'Bar', timeSeries: true },
  { value: 'scatter', label: 'Scatter', category: 'Scatter', timeSeries: true },
  { value: 'effectScatter', label: 'Effect Scatter', category: 'Scatter', timeSeries: true },
  { value: 'candlestick', label: 'Candlestick', category: 'Statistical', timeSeries: true },
  { value: 'boxplot', label: 'Boxplot', category: 'Statistical', timeSeries: true },
  { value: 'heatmap', label: 'Heatmap', category: 'Statistical', timeSeries: true },
  { value: 'pie', label: 'Pie', category: 'Pie', timeSeries: false },
  { value: 'sunburst', label: 'Sunburst', category: 'Pie', timeSeries: false },
  { value: 'gauge', label: 'Gauge', category: 'Gauge', timeSeries: false },
  { value: 'radar', label: 'Radar', category: 'Radar', timeSeries: false },
  { value: 'funnel', label: 'Funnel', category: 'Funnel', timeSeries: false },
  { value: 'graph', label: 'Graph', category: 'Graph', timeSeries: false },
  { value: 'chord', label: 'Chord', category: 'Graph', timeSeries: false },
  { value: 'sankey', label: 'Sankey', category: 'Graph', timeSeries: false },
  { value: 'treemap', label: 'Treemap', category: 'Tree', timeSeries: false },
  { value: 'tree', label: 'Tree', category: 'Tree', timeSeries: false },
  { value: 'map', label: 'Map', category: 'Map', timeSeries: false },
  { value: 'lines', label: 'Lines', category: 'Map', timeSeries: false },
  { value: 'parallel', label: 'Parallel', category: 'Other', timeSeries: false },
  { value: 'themeRiver', label: 'Theme River', category: 'Other', timeSeries: false },
  { value: 'custom', label: 'Custom', category: 'Other', timeSeries: false },
];

export const isTimeSeriesType = (value: string): boolean =>
  ECHARTS_TYPES.find(t => t.value === value)?.timeSeries ?? false;