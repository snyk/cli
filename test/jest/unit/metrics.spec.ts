const debugMock: string[][] = [];
jest.mock('debug', () => {
  const factory = (key) => (...args) => {
    debugMock.push([key, ...args]);
  };
  factory.default = factory;
  return factory;
});

import {
  TimerMetricInstance,
  SyntheticMetricInstance,
  MetricsCollector,
} from '../../../src/lib/metrics';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMetricsLogLines() {
  return debugMock
    .filter(([key]) => 'snyk-metrics' === key)
    .map(([, logLine]) => logLine);
}

afterEach(() => {
  MetricsCollector.NETWORK_TIME.clear();
  MetricsCollector.CPU_TIME.clear();
  jest.restoreAllMocks();
  debugMock.length = 0;
});

describe('SyntheticMetricInstance', () => {
  it('has a correct initial value', () => {
    const smi = new SyntheticMetricInstance();
    expect(smi.getValue()).toBe(0);
  });

  it('can be manually set', () => {
    const smi = new SyntheticMetricInstance();
    smi.setValue(5);
    expect(smi.getValue()).toBe(5);
  });
});

describe('TimerMetricInstance', () => {
  it('has a correct initial value', () => {
    const tmi = new TimerMetricInstance('timer/network_time');
    expect(tmi.getValue()).toBeUndefined;
  });

  it('can time things with sufficient accuracy', async () => {
    const tmi = new TimerMetricInstance('timer/network_time');
    tmi.start();
    await sleep(10);
    tmi.stop();
    // Sleep() is backed by setTimeout(), and some Node runtimes might execute setTimeout callback before the specified
    // delay, meaning that tmi.getValue() will occasionally return `9` at this point. An extra ms leeway in this
    // assertion works round the issue. https://github.com/nodejs/node/issues/10154
    expect(tmi.getValue()).toBeGreaterThanOrEqual(9);
  });

  it('.start() / .stop() logs start/top and improper use warnings if you try to start/stop it again after stopping it', async () => {
    const t = new TimerMetricInstance('timer/network_time');
    expect(t.getValue()).toBeUndefined();

    t.start();
    await sleep(2);
    t.stop();
    const t1 = t.getValue();

    // if we try to start/stop it again then 1) we make logImproperUse call and 2) the Timer value does not change
    t.start();
    await sleep(2);
    t.stop();

    const logLines = getMetricsLogLines();
    expect(logLines).toHaveLength(4);
    expect(logLines[0]).toContain('Timer timer/network_time started at');
    expect(logLines[1]).toContain('Timer timer/network_time stopped at');
    expect(logLines[2]).toBe(
      'Invalid Timer use: start() called when timer already stopped',
    );
    expect(logLines[3]).toBe(
      'Invalid Timer use: stop() called when timer already stopped',
    );

    const t2 = t.getValue();
    expect(t2).toBe(t1);
  });
});

describe('MetricsCollector', () => {
  it('can get values and compute total on timer through MetricsCollector', () => {
    const t1 = MetricsCollector.NETWORK_TIME.createInstance();
    t1.start();
    t1.stop();
    jest.spyOn(t1, 'getValue').mockReturnValue(100);
    expect(t1.getValue()).toBe(100); // just to make sure the mock is actually working

    const t2 = MetricsCollector.NETWORK_TIME.createInstance();
    t2.start();
    t2.stop();
    jest.spyOn(t2, 'getValue').mockReturnValue(200);
    expect(t2.getValue()).toBe(200); // just to make sure the mock is actually working

    expect(MetricsCollector.NETWORK_TIME.getValues()).toEqual([100, 200]);
    const total = MetricsCollector.NETWORK_TIME.getTotal();
    expect(total).toBe(300);
  });

  it('can set and get cpu time through MetricsCollector', () => {
    const s = MetricsCollector.CPU_TIME.createInstance();
    s.setValue(5);
    expect(MetricsCollector.CPU_TIME.getValues()).toEqual([5]);
    expect(MetricsCollector.CPU_TIME.getTotal()).toBe(5);
  });

  it('returns all metrics in the way we need for analytics', () => {
    const t1 = MetricsCollector.NETWORK_TIME.createInstance();
    t1.start();
    t1.stop();
    jest.spyOn(t1, 'getValue').mockReturnValue(100);

    const t2 = MetricsCollector.NETWORK_TIME.createInstance();
    t2.start();
    t2.stop();
    jest.spyOn(t2, 'getValue').mockReturnValue(200);

    MetricsCollector.CPU_TIME.createInstance().setValue(50);

    const allMetrics = MetricsCollector.getAllMetrics();

    const expected = {
      // eslint-disable-next-line @typescript-eslint/camelcase
      cpu_time: {
        total: 50,
        type: 'synthetic',
        values: [50],
      },
      // eslint-disable-next-line @typescript-eslint/camelcase
      network_time: {
        total: 300,
        type: 'timer',
        values: [100, 200],
      },
    };
    expect(allMetrics).toEqual(expected);
  });
});
