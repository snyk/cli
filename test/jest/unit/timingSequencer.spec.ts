import * as path from 'path';
import * as fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const glob = require('glob');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TimingSequencer = require('../timingSequencer');

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** Same file set CI shards over (coreCli acceptance + ts-binary-wrapper). */
function listShardedAcceptanceTests(): { path: string }[] {
  const patterns = [
    'test/jest/acceptance/**/*.spec.ts',
    'ts-binary-wrapper/test/acceptance/**/*.spec.ts',
  ];
  const paths = patterns.flatMap((pattern) =>
    glob.sync(pattern, { cwd: REPO_ROOT, absolute: true }),
  );
  return paths.map((p) => ({ path: p }));
}

function shardEstimatedTotalsMs(
  sequencer: InstanceType<typeof TimingSequencer>,
  tests: { path: string }[],
  shardCount: number,
): number[] {
  const totals: number[] = [];
  for (let shardIndex = 1; shardIndex <= shardCount; shardIndex++) {
    const shardTests = sequencer.shard(tests, { shardIndex, shardCount });
    totals.push(
      shardTests.reduce((sum, test) => sum + sequencer.weightFor(test.path), 0),
    );
  }
  return totals;
}

/** Jest default: alphabetical order, equal-count contiguous slices. */
function jestDefaultShardTotalsMs(
  sequencer: InstanceType<typeof TimingSequencer>,
  tests: { path: string }[],
  shardCount: number,
): number[] {
  const sorted = [...tests].sort((a, b) => (a.path < b.path ? -1 : 1));
  const shardSize = Math.ceil(tests.length / shardCount);
  const totals: number[] = [];

  for (let i = 0; i < shardCount; i++) {
    const slice = sorted.slice(shardSize * i, shardSize * (i + 1));
    totals.push(
      slice.reduce((sum, test) => sum + sequencer.weightFor(test.path), 0),
    );
  }
  return totals;
}

function maxMinRatio(totals: number[]): number {
  return Math.max(...totals) / Math.min(...totals);
}

function spreadMs(totals: number[]): number {
  return Math.max(...totals) - Math.min(...totals);
}

function meanMs(totals: number[]): number {
  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

/**
 * Build a sequencer fed exactly `weights`, with one synthetic test file per
 * weight. The synthetic paths are anchored at `process.cwd()` and the timings
 * keys are the matching `cwd`-relative POSIX paths, so `weightFor` (which does
 * `path.relative(process.cwd(), ...)`) resolves them no matter where Jest runs.
 * If that mapping ever broke, every file would fall back to DEFAULT_WEIGHT_MS
 * and the shape assertions below would fail loudly rather than silently pass.
 *
 * One index-suffixed file per element also keeps duplicate weights distinct.
 */
function sequencerWithWeights(weights: number[]): {
  sequencer: InstanceType<typeof TimingSequencer>;
  tests: { path: string }[];
} {
  const relPaths = weights.map(
    (_, index) => `test/__synthetic__/w${index}.spec.ts`,
  );
  const tests = relPaths.map((rel) => ({
    path: path.join(process.cwd(), ...rel.split('/')),
  }));
  const timings: Record<string, number> = Object.fromEntries(
    relPaths.map((rel, index) => [rel, weights[index]]),
  );

  const sequencer = new TimingSequencer();
  sequencer.timings = timings;
  return { sequencer, tests };
}

/**
 * Run every shard and return the full partition: for each shard, the sorted
 * (desc) list of its tests' weights. Also returns the flat list of every
 * assigned path so callers can assert a strict, non-overlapping partition.
 */
function partitionByWeight(
  sequencer: InstanceType<typeof TimingSequencer>,
  tests: { path: string }[],
  shardCount: number,
): { shards: number[][]; assignedPaths: string[] } {
  const shards: number[][] = [];
  const assignedPaths: string[] = [];
  for (let shardIndex = 1; shardIndex <= shardCount; shardIndex++) {
    const shardTests = sequencer.shard(tests, { shardIndex, shardCount });
    for (const test of shardTests) assignedPaths.push(test.path);
    shards.push(
      shardTests
        .map((test) => sequencer.weightFor(test.path))
        .sort((a, b) => b - a),
    );
  }
  return { shards, assignedPaths };
}

describe('TimingSequencer.shard LPT bin-packing', () => {
  it('packs [9,8,7,6,5,4,3,2,1] across 4 shards into exactly [12,11,11,11]', () => {
    const weights = [9, 8, 7, 6, 5, 4, 3, 2, 1];
    const { sequencer, tests } = sequencerWithWeights(weights);
    const shardCount = 4;

    const totals = shardEstimatedTotalsMs(sequencer, tests, shardCount);
    const { shards, assignedPaths } = partitionByWeight(
      sequencer,
      tests,
      shardCount,
    );

    // Exact per-shard runtime: greedy LPT lands on the optimal 12/11/11/11.
    expect([...totals].sort((a, b) => b - a)).toEqual([12, 11, 11, 11]);

    // Exact groupings (order of shards is not contractual, so sort the
    // outer list before comparing) — stronger than arrayContaining, which
    // would tolerate an extra/duplicate shard.
    const sortedShards = [...shards].sort(
      (a, b) => b[0] - a[0] || a.length - b.length,
    );
    expect(sortedShards).toEqual([
      [9, 2, 1],
      [8, 3],
      [7, 4],
      [6, 5],
    ]);

    // Strict partition: every input file assigned exactly once, nothing
    // invented or dropped.
    expect(assignedPaths.length).toBe(weights.length);
    expect(new Set(assignedPaths).size).toBe(weights.length);
    expect(new Set(assignedPaths)).toEqual(new Set(tests.map((t) => t.path)));

    expect(maxMinRatio(totals)).toBeCloseTo(12 / 11, 5);
  });

  it('breaks ties by path so the partition is deterministic', () => {
    // All-equal weights: LPT degenerates to round-robin in path order, so the
    // result must be stable across runs/machines.
    const weights = [5, 5, 5, 5, 5, 5];
    const first = sequencerWithWeights(weights);
    const second = sequencerWithWeights(weights);

    const a = partitionByWeight(first.sequencer, first.tests, 3);
    const b = partitionByWeight(second.sequencer, second.tests, 3);

    expect(a.assignedPaths).toEqual(b.assignedPaths);
    expect(a.shards).toEqual([
      [5, 5],
      [5, 5],
      [5, 5],
    ]);
  });
});

describe('TimingSequencer shard balance', () => {
  const tests = listShardedAcceptanceTests();
  const sequencer = new TimingSequencer();

  it('includes the acceptance files we shard in CI', () => {
    expect(tests.length).toBeGreaterThan(100);
  });

  it.each([6, 8])(
    'assigns every test file to exactly one shard (shardCount=%i)',
    (shardCount) => {
      const assigned = new Set<string>();
      for (let shardIndex = 1; shardIndex <= shardCount; shardIndex++) {
        for (const test of sequencer.shard(tests, { shardIndex, shardCount })) {
          expect(assigned.has(test.path)).toBe(false);
          assigned.add(test.path);
        }
      }
      expect(assigned.size).toBe(tests.length);
    },
  );

  it.each([6, 8])(
    'keeps estimated shard runtimes within a tight band (shardCount=%i)',
    (shardCount) => {
      const totals = shardEstimatedTotalsMs(sequencer, tests, shardCount);
      const mean = meanMs(totals);
      const ratio = maxMinRatio(totals);
      const spread = spreadMs(totals);
      const maxDeviation = Math.max(...totals.map((t) => Math.abs(t - mean)));

      // With committed timings, LPT packing lands shards within ~1% of each
      // other (~4–5s spread on ~8–9min total). Allow headroom for new tests at
      // the default weight without failing CI.
      expect(ratio).toBeLessThan(1.2);
      expect(spread).toBeLessThan(120_000);
      expect(maxDeviation / mean).toBeLessThan(0.15);
    },
  );

  it.each([6, 8])(
    'balances much better than Jest default count/alphabetical sharding (shardCount=%i)',
    (shardCount) => {
      const timingTotals = shardEstimatedTotalsMs(sequencer, tests, shardCount);
      const defaultTotals = jestDefaultShardTotalsMs(
        sequencer,
        tests,
        shardCount,
      );

      expect(maxMinRatio(timingTotals)).toBeLessThan(1.2);
      expect(maxMinRatio(timingTotals)).toBeLessThan(
        maxMinRatio(defaultTotals) * 0.75,
      );
      expect(spreadMs(timingTotals)).toBeLessThan(
        spreadMs(defaultTotals) * 0.25,
      );
      // Default sharding still leaves minutes of skew with real timings.
      expect(spreadMs(defaultTotals)).toBeGreaterThan(180_000);
    },
  );

  it('is deterministic for the same inputs', () => {
    const shardCount = 8;
    const first = shardEstimatedTotalsMs(sequencer, tests, shardCount);
    const second = shardEstimatedTotalsMs(
      new TimingSequencer(),
      tests,
      shardCount,
    );
    expect(second).toEqual(first);
  });
});

describe('TimingSequencer platform-aware loading', () => {
  const originalEnv = process.env.TEST_SNYK_TIMINGS_PLATFORM;
  const originalStrict = process.env.TEST_SNYK_TIMINGS_STRICT;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TEST_SNYK_TIMINGS_PLATFORM;
    } else {
      process.env.TEST_SNYK_TIMINGS_PLATFORM = originalEnv;
    }
    if (originalStrict === undefined) {
      delete process.env.TEST_SNYK_TIMINGS_STRICT;
    } else {
      process.env.TEST_SNYK_TIMINGS_STRICT = originalStrict;
    }
    jest.resetModules();
  });

  it('uses equal weights when no platform env var is set', () => {
    delete process.env.TEST_SNYK_TIMINGS_PLATFORM;
    delete process.env.TEST_SNYK_TIMINGS_STRICT;
    const Seq = require('../timingSequencer');
    const seq = new Seq();
    expect(seq.timingsSource).toBeNull();
    expect(Object.keys(seq.timings).length).toBe(0);
  });

  it('loads platform-specific file when TEST_SNYK_TIMINGS_PLATFORM is set and file exists', () => {
    const platformFile = path.join(
      __dirname,
      '..',
      'test-timings-test-dummy.json',
    );
    const dummyTimings = { 'test/jest/acceptance/dummy.spec.ts': 99999 };
    fs.writeFileSync(platformFile, JSON.stringify(dummyTimings));
    try {
      process.env.TEST_SNYK_TIMINGS_PLATFORM = 'test-dummy';
      const Seq = require('../timingSequencer');
      const seq = new Seq();
      expect(seq.timings).toEqual(dummyTimings);
      expect(seq.timingsSource).toBe('test-timings-test-dummy.json');
    } finally {
      fs.unlinkSync(platformFile);
    }
  });

  it('falls back to equal weights when platform file does not exist', () => {
    process.env.TEST_SNYK_TIMINGS_PLATFORM = 'nonexistent-platform';
    delete process.env.TEST_SNYK_TIMINGS_STRICT;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const Seq = require('../timingSequencer');
      const seq = new Seq();
      expect(seq.timingsSource).toBeNull();
      expect(Object.keys(seq.timings).length).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('nonexistent-platform'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('committed platform timing files load successfully', () => {
    for (const platform of ['linux', 'macos', 'windows']) {
      const file = path.join(__dirname, '..', `test-timings-${platform}.json`);
      if (!fs.existsSync(file)) continue;
      jest.resetModules();
      process.env.TEST_SNYK_TIMINGS_PLATFORM = platform;
      const Seq = require('../timingSequencer');
      const seq = new Seq();
      expect(seq.timingsSource).toBe(`test-timings-${platform}.json`);
    }
  });

  describe('strict mode (TEST_SNYK_TIMINGS_STRICT)', () => {
    it('throws when the platform file is missing', () => {
      process.env.TEST_SNYK_TIMINGS_PLATFORM = 'nonexistent-platform';
      process.env.TEST_SNYK_TIMINGS_STRICT = '1';
      const Seq = require('../timingSequencer');
      expect(() => new Seq()).toThrow(/nonexistent-platform/);
      expect(() => new Seq()).toThrow(/strict mode/i);
    });

    it('throws when no platform is set', () => {
      delete process.env.TEST_SNYK_TIMINGS_PLATFORM;
      process.env.TEST_SNYK_TIMINGS_STRICT = '1';
      const Seq = require('../timingSequencer');
      expect(() => new Seq()).toThrow(/not set/i);
      expect(() => new Seq()).toThrow(/strict mode/i);
    });

    it('loads normally when the platform file exists', () => {
      process.env.TEST_SNYK_TIMINGS_PLATFORM = 'linux';
      process.env.TEST_SNYK_TIMINGS_STRICT = '1';
      const linuxFile = path.join(__dirname, '..', 'test-timings-linux.json');
      if (!fs.existsSync(linuxFile)) return;
      const Seq = require('../timingSequencer');
      const seq = new Seq();
      expect(seq.timingsSource).toBe('test-timings-linux.json');
    });
  });
});

describe('platform-specific timing file integrity', () => {
  const PLATFORMS = ['linux', 'macos', 'windows'];
  const tests = listShardedAcceptanceTests();
  const testRelPaths = new Set(
    tests.map((t) =>
      path.relative(REPO_ROOT, t.path).split(path.sep).join('/'),
    ),
  );

  for (const platform of PLATFORMS) {
    const filePath = path.join(
      __dirname,
      '..',
      `test-timings-${platform}.json`,
    );
    const exists = fs.existsSync(filePath);

    (exists ? describe : describe.skip)(`test-timings-${platform}.json`, () => {
      const timings: Record<string, number> = exists
        ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
        : {};

      it('every entry points to a file that still exists', () => {
        const stale = Object.keys(timings).filter(
          (key) => !testRelPaths.has(key),
        );
        expect(stale).toEqual([]);
      });

      it('values are positive integers', () => {
        for (const val of Object.values(timings)) {
          expect(typeof val).toBe('number');
          expect(Number.isInteger(val)).toBe(true);
          expect(val).toBeGreaterThan(0);
        }
      });
    });
  }
});
