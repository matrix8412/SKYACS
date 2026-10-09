import type { Component } from 'solid-js';
import { createSignal, createResource, createEffect, createMemo, onCleanup, Show, For } from 'solid-js';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { api, type MetricDefinition } from '../lib/api';

interface MetricChartProps {
  serial: string;
  metrics: MetricDefinition[];
  hours?: number;
}

const DEFAULT_PALETTE = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#fb923c'];

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

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

interface UnitScale { divisor: number; suffix: string }

const computeUnitScale = (values: number[], mode: string): UnitScale => {
  const max = Math.max(0, ...values.filter((v) => v != null));
  if (max === 0) return { divisor: 1, suffix: '' };

  if (mode === 'auto') {
    if (max >= 1e12) return { divisor: 1e12, suffix: 'T' };
    if (max >= 1e9) return { divisor: 1e9, suffix: 'G' };
    if (max >= 1e6) return { divisor: 1e6, suffix: 'M' };
    if (max >= 1e3) return { divisor: 1e3, suffix: 'K' };
    return { divisor: 1, suffix: '' };
  }
  if (mode === 'bytes') {
    const kb = 1024, mb = 1024 ** 2, gb = 1024 ** 3, tb = 1024 ** 4;
    if (max >= tb) return { divisor: tb, suffix: 'TB' };
    if (max >= gb) return { divisor: gb, suffix: 'GB' };
    if (max >= mb) return { divisor: mb, suffix: 'MB' };
    if (max >= kb) return { divisor: kb, suffix: 'KB' };
    return { divisor: 1, suffix: 'B' };
  }
  if (mode === 'bits') {
    if (max >= 1e12) return { divisor: 1e12, suffix: 'Tb' };
    if (max >= 1e9) return { divisor: 1e9, suffix: 'Gb' };
    if (max >= 1e6) return { divisor: 1e6, suffix: 'Mb' };
    if (max >= 1e3) return { divisor: 1e3, suffix: 'Kb' };
    return { divisor: 1, suffix: 'b' };
  }
  return { divisor: 1, suffix: '' };
};

const effectiveUnit = (unit: string, scaleMode: string, suffix: string): string => {
  if (scaleMode === 'bytes' || scaleMode === 'bits') {
    return suffix || unit;
  }
  if (scaleMode === 'auto') {
    return suffix ? suffix + unit : unit;
  }
  return unit;
};

const fmtVal = (v: number | null): string => (v == null ? '—' : v.toFixed(2));

const MetricChart: Component<MetricChartProps> = (props) => {
  const [bucket, setBucket] = createSignal(getStoredBucket(props.serial));
  const [chartEl, setChartEl] = createSignal<HTMLElement>();
  let chart: uPlot | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let rafId: number | null = null;
  let tooltipEl: HTMLDivElement | null = null;

  const [settings] = createResource(() => api.getSettings());
  const chartShowPoints = createMemo(() => settings()?.['chart_show_points'] !== 'false');

  const [data] = createResource(
    () => ({ serial: props.serial, ids: props.metrics.map((m) => m.id), bucket: bucket().value, hours: bucket().hours }),
    async (q) => {
      const results = await Promise.all(
        q.ids.map((id) => api.getDeviceMetrics(q.serial, id, q.bucket, q.hours)),
      );
      return results;
    },
  );

  const hasRightAxis = createMemo(() => props.metrics.some((m) => m.axis === 'right'));

  const seriesData = createMemo(() => {
    const results = data();
    if (!results) return null;

    let baseTimes: number[] | null = null;
    let isAggregated = false;

    for (const r of results) {
      if (r.aggregates && r.aggregates.length > 0) {
        baseTimes = r.aggregates.map((a) => new Date(a.timestamp).getTime() / 1000);
        isAggregated = true;
        break;
      }
      if (r.samples && r.samples.length > 0) {
        baseTimes = r.samples.map((s) => new Date(s.timestamp).getTime() / 1000);
        break;
      }
    }
    if (!baseTimes) return null;

    const series: number[][] = [baseTimes];
    const suffixes: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const m = props.metrics[i];
      const scale = m.unit_scale ? computeUnitScale(
        (r.aggregates?.map((a) => a.avg) ?? r.samples?.map((s) => s.value) ?? []),
        m.unit_scale
      ) : { divisor: 1, suffix: '' };
      suffixes.push(scale.suffix);

      if (r.aggregates && r.aggregates.length > 0) {
        series.push(r.aggregates.map((a) => a.avg / scale.divisor));
      } else if (r.samples && r.samples.length > 0) {
        series.push(r.samples.map((s) => s.value / scale.divisor));
      } else {
        series.push(baseTimes.map(() => null as unknown as number));
      }
    }

    return { series, isAggregated, suffixes };
  });

  const chartTitle = createMemo(() => {
    if (props.metrics.length === 1) {
      const m = props.metrics[0];
      return m.name + (m.unit ? ` (${m.unit})` : '');
    }
    const group = props.metrics[0].group;
    if (group) return group;
    return props.metrics.map((m) => m.name).join(' / ');
  });

  const legendStats = createMemo(() => {
    const results = data();
    if (!results) return null;
    return results.map((r, i) => {
      const m = props.metrics[i];
      const color = m.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
      const values = r.aggregates?.map((a) => a.avg) ?? r.samples?.map((s) => s.value) ?? [];
      const scale = m.unit_scale ? computeUnitScale(values, m.unit_scale) : { divisor: 1, suffix: '' };
      const unit = effectiveUnit(m.unit, m.unit_scale, scale.suffix);
      let min: number | null = null;
      let max: number | null = null;
      let avg: number | null = null;
      if (r.aggregates && r.aggregates.length > 0) {
        min = Math.min(...r.aggregates.map((a) => a.min)) / scale.divisor;
        max = Math.max(...r.aggregates.map((a) => a.max)) / scale.divisor;
        avg = r.aggregates.reduce((s, a) => s + a.avg, 0) / r.aggregates.length / scale.divisor;
      } else if (r.samples && r.samples.length > 0) {
        const vals = r.samples.map((s) => s.value);
        min = Math.min(...vals) / scale.divisor;
        max = Math.max(...vals) / scale.divisor;
        avg = vals.reduce((s, v) => s + v, 0) / vals.length / scale.divisor;
      }
      return { name: m.name, color, unit, min, avg, max };
    });
  });

  const renderChart = (showPoints: boolean) => {
    if (!chartEl()) return;
    const s = seriesData();
    if (!s) {
      if (chart) { chart.destroy(); chart = null; }
      return;
    }

    const metrics = props.metrics;
    const axisUnitLabel = (side: 'left' | 'right'): string => {
      const units: string[] = [];
      for (let i = 0; i < metrics.length; i++) {
        const isRight = metrics[i].axis === 'right';
        if (side === 'right' ? !isRight : isRight) continue;
        const u = effectiveUnit(metrics[i].unit, metrics[i].unit_scale, s.suffixes[i]);
        if (u && !units.includes(u)) units.push(u);
      }
      return units.join(' / ');
    };
    const specs: uPlot.Series[] = [{ label: 'Time' }];

    for (let i = 0; i < metrics.length; i++) {
      const m = metrics[i];
      const color = m.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
      const scale = m.axis === 'right' ? 'y2' : 'y';
      const unit = effectiveUnit(m.unit, m.unit_scale, s.suffixes[i]);
      const label = m.name + (unit ? ` (${unit})` : '');

      specs.push({
        label,
        stroke: color,
        width: 2,
        fill: hexToRgba(color, 0.06),
        points: { show: showPoints, size: 4 },
        scale,
      });
    }

    const scales: uPlot.Scales = {
      x: { time: true },
      y: { auto: true },
    };
    if (hasRightAxis()) {
      scales.y2 = { auto: true };
    }

    const axes: uPlot.Axes = [
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
        label: axisUnitLabel('left'),
        font: '11px "IBM Plex Mono", monospace',
        space: 40,
      },
    ];
    if (hasRightAxis()) {
      axes.push({
        scale: 'y2',
        stroke: '#475569',
        grid: { show: false },
        ticks: { stroke: 'rgba(71,85,105,0.15)', width: 1 },
        label: axisUnitLabel('right'),
        font: '11px "IBM Plex Mono", monospace',
        space: 40,
        side: 1,
      });
    }

    const opts: uPlot.Options = {
      width: chartEl()!.clientWidth || 600,
      height: 200,
      series: specs,
      cursor: { drag: { x: true, y: false } },
      scales,
      axes,
      legend: { show: metrics.length > 1 },
      padding: [0, 0, 0, 0],
      hooks: {
        setCursor: [(self: uPlot) => {
          const idx = self.cursor.idx;
          if (idx == null || !tooltipEl) {
            if (tooltipEl) tooltipEl.style.display = 'none';
            return;
          }
          const ts = self.data[0][idx];
          if (ts == null) { tooltipEl.style.display = 'none'; return; }
          const date = new Date(ts * 1000);
          const timeStr = date.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
          const dateStr = date.toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' });

          let html = `<div style="margin-bottom:3px;opacity:0.7">${dateStr} ${timeStr}</div>`;
          let hasVal = false;
          for (let i = 0; i < metrics.length; i++) {
            const m = metrics[i];
            const color = m.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
            const valIdx = 1 + i;
            const val = self.data[valIdx]?.[idx];
            if (val == null) continue;
            hasVal = true;
            const effUnit = effectiveUnit(m.unit, m.unit_scale, s.suffixes[i]);
            const unit = effUnit ? ` ${effUnit}` : '';
            html += `<div style="display:flex;align-items:center;gap:4px;margin-top:2px;"><span style="width:8px;height:8px;border-radius:2px;background:${color};display:inline-block;"></span><span>${m.name}: ${typeof val === 'number' ? val.toFixed(2) : val}${unit}</span></div>`;
          }
          if (!hasVal) { tooltipEl.style.display = 'none'; return; }

          tooltipEl.innerHTML = html;
          tooltipEl.style.display = 'block';

          const xPos = self.valToPos(ts, 'x', true);
          const yPos = self.valToPos(self.data[1]?.[idx] ?? 0, 'y', true);
          const left = Math.max(0, Math.min(xPos, self.width - 160));
          const top = Math.max(0, yPos - 30);
          tooltipEl.style.left = `${left}px`;
          tooltipEl.style.top = `${top}px`;
        }],
      },
    };

    if (chart) {
      chart.destroy();
      chart = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }

    tooltipEl = document.createElement('div');
    tooltipEl.style.cssText = 'position:absolute;display:none;pointer-events:none;background:rgba(15,23,42,0.9);color:#e2e8f0;font:11px "IBM Plex Mono",monospace;padding:4px 8px;border-radius:4px;white-space:nowrap;z-index:10;';
    chartEl()!.appendChild(tooltipEl);

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
    const showPoints = chartShowPoints();
    if (!el || !s) return;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      renderChart(showPoints);
    });
  });

  onCleanup(() => {
    if (rafId) cancelAnimationFrame(rafId);
    if (resizeObserver) resizeObserver.disconnect();
    if (chart) chart.destroy();
    if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
  });

  const handleBucketChange = (opt: typeof BUCKET_OPTIONS[number]) => {
    setBucket(opt);
    try { localStorage.setItem(`skyacs_metric_interval_${props.serial}`, opt.label); } catch { /* ignore */ }
  };

  return (
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-secondary">{chartTitle()}</span>
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
        <div ref={setChartEl} class="w-full h-[200px] relative overflow-hidden" />
        <Show when={legendStats()}>
          <div class="flex flex-col gap-0.5 pt-1">
            <For each={legendStats()!}>
              {(s) => (
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-[2px] inline-block" style={{ background: s.color }} />
                    <span class="text-xs text-secondary">{s.name}</span>
                  </div>
                  <span class="text-[10px] text-muted font-mono">
                    min {fmtVal(s.min)} · avg {fmtVal(s.avg)} · max {fmtVal(s.max)}{s.unit ? ` ${s.unit}` : ''}
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>
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
