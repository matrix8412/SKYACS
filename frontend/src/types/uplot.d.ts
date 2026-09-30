declare module 'uplot' {
  class uPlot {
    constructor(opts: uPlot.Options, data: unknown, el: HTMLElement);
    destroy(): void;
    setSize(size: { width: number; height: number }): void;
    cursor: { idx: number | null; left: number | null; top: number | null };
    data: (number | null)[][];
    series: Array<{ data: (number | null)[] }>;
    width: number;
    height: number;
    valToPos(val: number, scale: string, mode: boolean): number;
  }

  namespace uPlot {
    interface Series {
      label?: string;
      stroke?: string;
      width?: number;
      fill?: string;
      points?: { show?: boolean; size?: number };
      scale?: string;
      [key: string]: unknown;
    }

    interface Axis {
      scale?: string;
      stroke?: string;
      grid?: { stroke?: string; width?: number; show?: boolean };
      ticks?: { stroke?: string; width?: number };
      label?: string;
      font?: string;
      space?: number;
      side?: number;
      [key: string]: unknown;
    }

    interface Scales {
      [key: string]: {
        time?: boolean;
        auto?: boolean;
        [key: string]: unknown;
      };
    }

    type Axes = Axis[];

    interface Options {
      width?: number;
      height?: number;
      series?: Series[];
      cursor?: { drag?: { x?: boolean; y?: boolean } };
      scales?: Scales;
      axes?: Axis[];
      legend?: { show?: boolean };
      padding?: number[];
      hooks?: {
        setCursor?: Array<(self: uPlot) => void>;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }
  }

  export default uPlot;
}