const util = require('util');
const debug = util.debuglog('snyk-metrics');

type MetricType = 'timer' | 'synthetic';
export type MetricValue = number | undefined;
export const METRIC_TYPE_TIMER = 'timer';
export const METRIC_TYPE_SYNTHETIC = 'synthetic';

export abstract class MetricInstance {
  abstract getValue(): MetricValue;
}

export class TimerMetricInstance extends MetricInstance {
  startTimeMs = 0;
  endTimeMs = 0;
  metricTag: string;

  /**
   * Creates a new TimerMetricInstance
   * @param metricTag used for logging to identify the metric
   */
  public constructor(metricTag: string) {
    super();
    this.metricTag = metricTag;
  }

  public getValue(): MetricValue {
    if (this.startTimeMs !== 0 && this.endTimeMs !== 0) {
      return this.endTimeMs - this.startTimeMs;
    } else {
      return undefined;
    }
  }

  public start() {
    if (this.startTimeMs === 0) {
      this.startTimeMs = Date.now();
      debug(`Timer ${this.metricTag} started at ${this.startTimeMs}.`);
    } else {
      debug('Invalid Timer use: start() called when timer already stopped');
    }
  }

  public stop() {
    if (this.endTimeMs === 0) {
      this.endTimeMs = Date.now();
      debug(
        `Timer ${this.metricTag} stopped at ${
          this.endTimeMs
        }. Elapsed time is ${this.getValue()}`,
      );
    } else {
      debug('Invalid Timer use: stop() called when timer already stopped');
    }
  }
}

export class SyntheticMetricInstance extends MetricInstance {
  private value = 0;

  public setValue(value: number) {
    this.value = value;
  }

  public getValue(): number {
    return this.value;
  }
}

export abstract class Metric {
  public name: string;
  public context: string;
  public metricType: MetricType;
  protected instances: Array<MetricInstance> = [];

  public clear() {
    this.instances = [];
  }

  public getValues(): number[] {
    return this.instances.map((mi) => mi.getValue() || 0);
  }

  public getTotal(): number {
    const sumMetricValues = (accum: number, current: MetricInstance) => {
      const currentTimerMs = current.getValue() || 0;
      return (accum = accum + currentTimerMs);
    };

    const total = this.instances.reduce(sumMetricValues, 0);
    return total;
  }

  public constructor(name: string, metricType: MetricType, context: string) {
    this.name = name;
    this.metricType = metricType;
    this.context = context;
  }
}

export class TimerMetric extends Metric {
  public createInstance(): TimerMetricInstance {
    const t = new TimerMetricInstance(`${this.metricType}/${this.name}`);
    this.instances.push(t);
    return t;
  }
}

export class SyntheticMetric extends Metric {
  public createInstance(): SyntheticMetricInstance {
    const sm = new SyntheticMetricInstance();
    this.instances.push(sm);
    return sm;
  }
}

export class MetricsCollector {
  public static NETWORK_TIME: TimerMetric = new TimerMetric(
    'network_time',
    'timer',
    'Total time spent making and waiting on network requests',
  );
  public static CPU_TIME: SyntheticMetric = new SyntheticMetric(
    'cpu_time',
    'synthetic',
    'Time spent on things other than network requests',
  );

  public static getAllMetrics(): any[] {
    const metrics: Metric[] = [
      MetricsCollector.NETWORK_TIME,
      MetricsCollector.CPU_TIME,
    ];

    const res: any = {};
    for (const m of metrics) {
      res[m.name] = {
        type: m.metricType,
        values: m.getValues(),
        total: m.getTotal(),
      };
    }
    return res;
  }
}
