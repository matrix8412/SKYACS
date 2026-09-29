import type { Component } from 'solid-js';
import { createSignal, createResource, createEffect, createMemo, onCleanup, Show } from 'solid-js';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { api, type MetricDefinition } from '../lib/api';

interface MetricChartProps {
  serial: string;
  metric: MetricDefinition;
  hours?: number;
}

const BUCKET_OPTIONS: Array<{ label: string; value: string; hours: number }> = [
  { label: '1h', value: '5min', hours: 1 },
  { label: '6h', value: '5min', hours: 6 },
  { label: '24h', value: '5min', hours: 24 },
  { label: '7d', value: '1h', hours: 168 },
  { label: '30d', value: '1d', hours: 720 },
  { label: '365d', value: '1d', hours: 8760 },
];

const getStoredBucket = (serial: string): typeof BUCKET_OPTIONS[number] => {
  try {
    const stored = localStorage.getItem(`skyacs_metric_interval_${serial}`);
    if (stored) {
      const found = BUCKET_OPTIONS.find((o) => o.label === stored);
      if (found) return found;
    }
  } catch { /* ignore */ }
  return BUCKET_OPTIONS[2];
};

const MetricChart: Component<MetricChartProps> = (props) => {
  const [bucket, setBucket] = createSignal(getStoredBucket(props.serial));
  const [chartEl, setChartEl] = createSignal<HTMLElement>();
  let chart: uPlot | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const [data] = createResource(
    () => ({ serial: props.serial, metricId: props.metric.id, bucket: bucket().value, hours: bucket().hours }),
    (q) => api.getDeviceMetrics(q.serial, q.metricId, q.bucket, q.hours),
  );

  const seriesData = createMemo(() => {
    const d = data();
    if (!d) return null;
    if (d.aggregates && d.aggregates.length > 0) {
      const times = d.aggregates.map((a) => new Date(a.timestamp).getTime() / 1000);
      const avgs = d.aggregates.map((a) => a.avg);
      const mins = d.aggregates.map((a) => a.min);
      const maxs = d.aggregates.map((a) => a.max);
      return { series: [times, avgs, mins, maxs] as number[][] };
    }
    if (d.samples && d.samples.length > 0) {
      const times = d.samples.map((s) => new Date(s.timestamp).getTime() / 1000);
      const vals = d.samples.map((s) => s.value);
      return { series: [times, vals] as number[][] };
    }
    return null;
  });

  const renderChart = () => {
    if (!chartEl()) return;
    const s = seriesData();
    if (!s) {
      if (chart) { chart.destroy(); chart = null; }
      return;
    }

    const isAggregated = s.series.length > 2;
    const specs: uPlot.Series[] = [
      { label: 'Time' },
      { label: props.metric.name + (props.metric.unit ? ` (${props.metric.unit})` : ''), stroke: '#38bdf8', width: 2, fill: 'rgba(56,189,248,0.08)' },
    ];
    if (isAggregated) {
      specs.push(
        { label: 'Min', stroke: 'rgba(56,189,248,0.3)', width: 1, fill: 'rgba(56,189,248,0.04)' },
        { label: 'Max', stroke: 'rgba(56,189,248,0.3)', width: 1, fill: 'rgba(56,189,248,0.04)' },
      );
    }

    const opts: uPlot.Options = {
      width: chartEl()!.clientWidth,
      height: 200,
      series: specs,
      cursor: { drag: { x: true, y: false } },
      scales: {
        time: { time: true },
        value: { auto: true },
      },
      axes: [
        {
          stroke: '#475569',
          grid: { stroke: 'rgba(71,85,105,0.2)', width: 1 },
          ticks: { stroke: 'rgba(71,85,105,0.2)', width: 1 },
          label: '',
          font: '11px "IBM Plex Mono", monospace',
          space: 40,
        },
        {
          stroke: '#475569',
          grid: { stroke: 'rgba(71,85,105,0.15)', width: 1 },
          ticks: { stroke: 'rgba(71,85,105,0.15)', width: 1 },
          label: '',
          font: '11px "IBM Plex Mono", monospace',
          space: 40,
        },
      ],
      legend: { show: false },
      padding: [0, 0, 0, 0],
    };

    if (chart) {
      chart.destroy();
      chart = null;
    }

    chart = new uPlot(opts, s.series as any, chartEl()!);

    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (chart) {
          chart.setSize({ width: entry.contentRect.width, height: 200 });
        }
      }
    });
    resizeObserver.observe(chartEl()!);
  };

  createEffect(() => {
    const el = chartEl();
    const s = seriesData();
    if (!el || !s) return;
    renderChart();
  });

  onCleanup(() => {
    if (resizeObserver) resizeObserver.disconnect();
    if (chart) chart.destroy();
  });

  const handleBucketChange = (opt: typeof BUCKET_OPTIONS[number]) => {
    setBucket(opt);
    try { localStorage.setItem(`skyacs_metric_interval_${props.serial}`, opt.label); } catch { /* ignore */ }
  };

  return (
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-secondary">{props.metric.name}</span>
          <Show when={props.metric.unit}>
            <span class="text-[10px] text-muted">({props.metric.unit})</span>
          </Show>
        </div>
        <div class="flex gap-1">
          {BUCKET_OPTIONS.map((opt) => (
            <button
              onClick={() => handleBucketChange(opt)}
              class={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${bucket().value === opt.value && bucket().hours === opt.hours ? 'bg-sky-500/20 text-sky-400' : 'text-muted hover:text-secondary'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <Show when={data.loading}>
        <div class="skeleton h-[200px] w-full" />
      </Show>
      <Show when={!data.loading && data.error}>
        <div class="text-xs text-rose-400 h-[200px] flex items-center justify-center">
          Failed to load metric data
        </div>
      </Show>
      <Show when={!data.loading && !data.error && seriesData()}>
        <div ref={setChartEl} class="w-full h-[200px]" />
      </Show>
      <Show when={!data.loading && !data.error && !seriesData()}>
        <div class="text-xs text-muted h-[200px] flex flex-col items-center justify-center gap-1">
          <span>No data collected yet</span>
          <span class="text-[10px] opacity-60">Waiting for device Inform with matching parameters</span>
        </div>
      </Show>
    </div>
  );
};

export default MetricChart;
