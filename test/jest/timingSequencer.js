const Sequencer = require('@jest/test-sequencer').default;
const fs = require('fs');
const path = require('path');

// Weight for any test file with no recorded timing. Sits slightly above the
// median acceptance test so brand-new/unknown files are not all bunched onto a
// single shard.
const DEFAULT_WEIGHT_MS =
  Number(process.env.JEST_DEFAULT_TEST_WEIGHT_MS) || 15000;

const platformTimingsPath = (platform) =>
  path.join(__dirname, `test-timings-${platform}.json`);

const isStrictMode = () =>
  ['1', 'true'].includes(process.env.TEST_SNYK_TIMINGS_STRICT);

const toRepoRelativePosix = (absolutePath) =>
  path.relative(process.cwd(), absolutePath).split(path.sep).join('/');

function readTimingsOrNull(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Pick the timings to shard by, honouring TEST_SNYK_TIMINGS_PLATFORM.
 *
 * A platform must always be set. Strict mode (TEST_SNYK_TIMINGS_STRICT,
 * enabled in CI) throws when the platform file is missing. Without strict
 * mode (local runs) it falls back to equal weights.
 *
 * @returns {{ timings: Record<string, number>, source: string | null, platform: string | null }}
 */
function resolveTimings() {
  const platform = process.env.TEST_SNYK_TIMINGS_PLATFORM || null;
  const strict = isStrictMode();

  if (platform) {
    const file = platformTimingsPath(platform);
    const timings = readTimingsOrNull(file);
    if (timings) {
      return { timings, source: path.basename(file), platform };
    }
    if (strict) {
      throw new Error(
        `[timingSequencer] TEST_SNYK_TIMINGS_PLATFORM=${platform} but ` +
          `${path.basename(file)} is missing or invalid and strict mode ` +
          '(TEST_SNYK_TIMINGS_STRICT) is on. Generate it with: ' +
          `npm run gen:test-timings:${platform}`,
      );
    }
  }

  if (strict) {
    throw new Error(
      '[timingSequencer] TEST_SNYK_TIMINGS_PLATFORM is not set and strict ' +
        'mode (TEST_SNYK_TIMINGS_STRICT) is on.',
    );
  }

  return { timings: {}, source: null, platform };
}

let hasLogged = false;
function logResolvedTimings({ source, platform }) {
  if (hasLogged) return;
  hasLogged = true;

  if (platform && !source) {
    console.warn(
      `[timingSequencer] WARNING: platform "${platform}" requested but its ` +
        'timings file was not found; using equal weights. ' +
        'Shards are NOT balanced with platform-specific weights.',
    );
    return;
  }
  console.info(
    `[timingSequencer] Using ${source || 'equal weights (no timings file)'}` +
      (platform ? ` for platform "${platform}"` : ''),
  );
}

class TimingSequencer extends Sequencer {
  constructor(...args) {
    super(...args);
    const resolved = resolveTimings();
    this.timings = resolved.timings;
    this.timingsSource = resolved.source;
    logResolvedTimings(resolved);
  }

  weightFor(testPath) {
    const weight = this.timings[toRepoRelativePosix(testPath)];
    return typeof weight === 'number' ? weight : DEFAULT_WEIGHT_MS;
  }

  /**
   * Distribute tests across shards by estimated runtime instead of Jest's
   * default count-based + alphabetical slice, using greedy longest-processing-
   * time (LPT) bin-packing: heaviest files first, each assigned to the currently
   * lightest shard. Keeps per-shard runtime roughly balanced even when a few
   * files dominate.
   *
   * Deterministic across machines: identical inputs + timings always yield the
   * same assignment (weight desc, ties broken by raw path order).
   *
   * @param {Array<{ path: string }>} tests
   * @param {{ shardIndex: number, shardCount: number }} options shardIndex is 1-based
   */
  shard(tests, { shardIndex, shardCount }) {
    const heaviestFirst = [...tests].sort((a, b) => {
      const byWeight = this.weightFor(b.path) - this.weightFor(a.path);
      if (byWeight !== 0) return byWeight;
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    });

    const shards = Array.from({ length: shardCount }, () => ({
      totalMs: 0,
      tests: [],
    }));

    for (const test of heaviestFirst) {
      const lightest = shards.reduce((min, shard) =>
        shard.totalMs < min.totalMs ? shard : min,
      );
      lightest.tests.push(test);
      lightest.totalMs += this.weightFor(test.path);
    }

    return shards[shardIndex - 1].tests;
  }
}

module.exports = TimingSequencer;
