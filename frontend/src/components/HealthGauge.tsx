import type { Component } from 'solid-js';
import { onMount, onCleanup, createEffect, Show } from 'solid-js';
import * as echarts from 'echarts/core';
import { GaugeChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([GaugeChart, CanvasRenderer]);

interface HealthGaugeProps {
  value: number | null;
  min: number;
  max: number;
  color: string;
  label: string;
  centerText: string;
  animated: boolean;
  warn?: number | null;
  critical?: number | null;
  direction?: 'higher_is_worse' | 'lower_is_worse';
}

const HealthGauge: Component<HealthGaugeProps> = (props) => {
  let chartRef: HTMLDivElement | undefined;
  let chart: echarts.ECharts | null = null;

  const buildOption = () => {
    const { value, min, max, centerText, animated, warn, critical, direction } = props;
    const safeVal = value ?? min;
    const range = max - min || 1;

    // Build color zones
    const zones: [number, string][] = [];
    if (direction === 'lower_is_worse') {
      if (critical != null && critical > min) {
        zones.push([Number(((critical - min) / range).toFixed(4)), '#f43f5e']);
      }
      if (warn != null && warn > min) {
        zones.push([Number(((warn - min) / range).toFixed(4)), '#f59e0b']);
      }
      zones.push([1, '#10b981']);
    } else {
      if (warn != null && warn < max) {
        zones.push([Number(((warn - min) / range).toFixed(4)), '#10b981']);
      }
      if (critical != null && critical < max) {
        zones.push([Number(((critical - min) / range).toFixed(4)), '#f59e0b']);
      }
      zones.push([1, '#f43f5e']);
    }

    return {
      animation: animated,
      animationDuration: 600,
      animationEasing: 'cubicOut' as const,
      series: [
        {
          type: 'gauge' as const,
          min,
          max,
          startAngle: 200,
          endAngle: -20,
          radius: '90%',
          axisLine: {
            lineStyle: {
              width: 12,
              color: zones,
            },
          },
          pointer: {
            length: '60%',
            width: 4,
            itemStyle: { color: 'auto' },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            valueAnimation: true,
            formatter: () => centerText,
            color: 'inherit',
            fontSize: 14,
            fontWeight: 'bold',
            offsetCenter: [0, '70%'],
          },
          title: {
            show: true,
            fontSize: 10,
            color: '#71717a',
            offsetCenter: [0, '95%'],
          },
          data: [
            {
              value: safeVal,
              name: props.label,
            },
          ],
        },
      ],
    };
  };

  onMount(() => {
    if (chartRef) {
      chart = echarts.init(chartRef, null, { renderer: 'canvas' });
      chart.setOption(buildOption() as any);
    }
  });

  createEffect(() => {
    if (chart) {
      chart.setOption(buildOption() as any, { notMerge: true });
    }
  });

  onCleanup(() => {
    if (chart) {
      chart.dispose();
      chart = null;
    }
  });

  return (
    <div>
      <Show when={props.value !== null}>
        <div ref={chartRef!} style={{ width: '100%', height: '80px' }} />
      </Show>
      <Show when={props.value === null}>
        <div class="flex items-center justify-center h-20 text-muted text-lg font-mono">-</div>
      </Show>
    </div>
  );
};

export default HealthGauge;