#!/usr/bin/env node
/**
 * Regenerate test/jest/test-timings-<platform>.json from jest-junit XML reports.
 *
 * The acceptance suite is sharded across CI nodes by estimated runtime
 * (see test/jest/timingSequencer.js). That estimate is only as good as the
 * recorded timings, so this script rebuilds them from the JUnit reports that
 * CI produces via `store_test_results`.
 *
 * Usage:
 *   node scripts/test-timings/gen-test-timings.js --platform <name> [reportsGlobDir ...]
 *
 * --platform <name>  Write to test/jest/test-timings-<name>.json.
 *                    Use linux, macos, or windows.
 *
 * Defaults to scanning ./test/reports. Pass one or more directories (e.g. the
 * downloaded artifacts of every shard) to merge timings across all of them.
 * Per-file times are summed across testsuites and the slowest observation
 * wins when the same file appears in multiple report sets.
 *
 * Requires jest-junit to emit the `file` attribute (addFileAttribute: true).
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');

function parseArgs(argv) {
  const args = argv.slice(2);
  let platform = null;
  const dirs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--platform') {
      platform = args[++i];
    } else {
      dirs.push(args[i]);
    }
  }
  if (!platform) {
    console.error(
      'Usage: node scripts/test-timings/gen-test-timings.js --platform <linux|macos|windows> [reportsGlobDir ...]',
    );
    process.exit(1);
  }
  return {
    platform,
    dirs,
    outputPath: path.join(REPO_ROOT, 'test', 'jest', `test-timings-${platform}.json`),
  };
}

function findXmlFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findXmlFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
      out.push(full);
    }
  }
  return out;
}

function toRepoRelativePosix(filePath) {
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(REPO_ROOT, filePath);
  return path.relative(REPO_ROOT, abs).split(path.sep).join('/');
}

const TESTSUITE_RE = /<testsuite\b([^>]*)>/g;
const FILE_ATTR_RE = /\bfile="([^"]+)"/;
const NAME_ATTR_RE = /\bname="([^"]+)"/;
const TIME_ATTR_RE = /\btime="([^"]+)"/;
const TESTS_ATTR_RE = /\btests="(\d+)"/;
// Single/double-quoted titles may contain the other quote chars or backticks
// (e.g. describe('`snyk test` of basic projects ...')).
const DESCRIBE_RE = /describe\s*\(\s*(?:'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)")/g;
const DESCRIBE_EACH_RE =
  /describe\.each\s*\([\s\S]*?\)\s*\(\s*['"`]([^'"`]+)['"`]/g;
const DESCRIBE_IF_RE =
  /describeIf\s*\([^)]*\)\s*\(\s*(?:'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)")/g;
const TEST_TITLE_RE =
  /(?:^|[\n;])\s*(?:test|it)\s*\(\s*(?:'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)")/gm;
const TESTCASE_CLASSNAME_RE = /<testcase\b[^>]*\bclassname="([^"]+)"/;
const SPEC_TEST_COUNT_RE = /\b(it|test)\s*\(/g;

/** @type {Map<string, string[]> | null} */
let describeToFiles = null;
/** @type {Map<string, string[]> | null} */
let testTitleToFiles = null;
/** @type {Map<string, number> | null} */
let specTestCounts = null;

function listAcceptanceSpecFiles() {
  const glob = require('glob');
  return glob
    .sync(
      '{test/jest/acceptance/**/*.spec.ts,ts-binary-wrapper/test/acceptance/**/*.spec.ts}',
      { cwd: REPO_ROOT, absolute: true },
    )
    .map((abs) => path.relative(REPO_ROOT, abs).split(path.sep).join('/'));
}

function getSpecTestCount(rel) {
  if (!specTestCounts) {
    specTestCounts = new Map();
    for (const file of listAcceptanceSpecFiles()) {
      const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
      specTestCounts.set(
        file,
        (content.match(SPEC_TEST_COUNT_RE) || []).length,
      );
    }
  }
  return specTestCounts.get(rel) || 0;
}

function addDescribeTitle(map, name, rel) {
  const list = map.get(name) || [];
  if (!list.includes(rel)) list.push(rel);
  map.set(name, list);
}

function buildDescribeToFilesMap() {
  const map = new Map();
  for (const rel of listAcceptanceSpecFiles()) {
    const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    let match;
    DESCRIBE_RE.lastIndex = 0;
    while ((match = DESCRIBE_RE.exec(content)) !== null) {
      const title = match[1] ?? match[2];
      if (title) addDescribeTitle(map, title, rel);
    }
    DESCRIBE_EACH_RE.lastIndex = 0;
    while ((match = DESCRIBE_EACH_RE.exec(content)) !== null) {
      addDescribeTitle(map, match[1], rel);
    }
    DESCRIBE_IF_RE.lastIndex = 0;
    while ((match = DESCRIBE_IF_RE.exec(content)) !== null) {
      const title = match[1] ?? match[2];
      if (title) addDescribeTitle(map, title, rel);
    }
  }
  return map;
}

function buildTestTitleToFilesMap() {
  const map = new Map();
  for (const rel of listAcceptanceSpecFiles()) {
    const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    let match;
    TEST_TITLE_RE.lastIndex = 0;
    while ((match = TEST_TITLE_RE.exec(content)) !== null) {
      const title = match[1] ?? match[2];
      if (title) addDescribeTitle(map, title, rel);
    }
  }
  return map;
}

function normalizeClassnameHint(classnameHint) {
  return classnameHint?.trim() || null;
}

function resolveByTestTitle(title) {
  if (!title) return null;
  if (!testTitleToFiles) testTitleToFiles = buildTestTitleToFilesMap();
  const candidates = testTitleToFiles.get(title) || [];
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Map a testsuite name to at most one spec file.
 * Unique describe titles map directly. Duplicate titles are disambiguated by
 * comparing the testsuite's `tests` count to each candidate's it/test count.
 */
function resolveWithCandidates(candidates, testsInSuite) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  if (testsInSuite == null) return null;

  let best = null;
  let bestDiff = Infinity;
  let tied = false;
  for (const rel of candidates) {
    const diff = Math.abs(testsInSuite - getSpecTestCount(rel));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = rel;
      tied = false;
    } else if (diff === bestDiff) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/**
 * jest-junit often emits only the outer describe.each title on <testsuite name>
 * (e.g. "user journey") while nested titles live in <testcase classname="...">.
 * Match the longest describe() title that appears in the classname hint.
 */
function resolveByClassnameHint(classnameHint, candidateFilter = null) {
  classnameHint = normalizeClassnameHint(classnameHint);
  if (!classnameHint) return null;
  if (!describeToFiles) describeToFiles = buildDescribeToFilesMap();

  let bestFile = null;
  let bestTitleLen = 0;
  let tied = false;

  for (const [title, files] of describeToFiles) {
    if (!classnameHint.includes(title)) continue;
    for (const rel of files) {
      if (candidateFilter && !candidateFilter.includes(rel)) continue;
      if (title.length > bestTitleLen) {
        bestTitleLen = title.length;
        bestFile = rel;
        tied = false;
      } else if (title.length === bestTitleLen && rel !== bestFile) {
        tied = true;
      }
    }
  }

  return tied ? null : bestFile;
}

/**
 * Map a testsuite name to at most one spec file.
 * Unique describe titles map directly. Duplicate titles are disambiguated by
 * comparing the testsuite's `tests` count to each candidate's it/test count,
 * then by nested titles in testcase classnames.
 *
 * jest-junit nests describe titles with " > " on some reporters (e.g.
 * "user journey > typescript workflow > `snyk test` of basic projects ...").
 * When the full name has no match, we try progressively shorter suffixes so
 * that nested or describe.each-generated titles still resolve.
 */
function resolveFileForTestsuite(testsuiteName, testsInSuite, classnameHint) {
  if (!describeToFiles) describeToFiles = buildDescribeToFilesMap();
  classnameHint = normalizeClassnameHint(classnameHint);

  const candidates = describeToFiles.get(testsuiteName) || [];

  // Shared outer titles (e.g. describe.each "user journey") need classname hints;
  // junit tests= counts include it.each expansions and rarely match source it/test counts.
  if (candidates.length > 1 && classnameHint) {
    const byClassname = resolveByClassnameHint(classnameHint, candidates);
    if (byClassname) return byClassname;
  }

  const byCount = resolveWithCandidates(candidates, testsInSuite);
  if (byCount) return byCount;

  if (candidates.length > 1) return null;

  const segments = testsuiteName.split(' > ');
  for (let i = 1; i < segments.length; i++) {
    const suffix = segments.slice(i).join(' > ');
    const suffixCandidates = describeToFiles.get(suffix) || [];
    const suffixResult = resolveWithCandidates(suffixCandidates, testsInSuite);
    if (suffixResult) return suffixResult;
    if (suffixCandidates.length > 0 && classnameHint) {
      const byClassname = resolveByClassnameHint(
        classnameHint,
        suffixCandidates,
      );
      if (byClassname) return byClassname;
    }
  }

  const byClassname = resolveByClassnameHint(classnameHint);
  if (byClassname) return byClassname;

  return resolveByTestTitle(classnameHint);
}

function formatSuiteMeta(suite) {
  const parts = [];
  if (suite.tests != null) parts.push(`tests=${suite.tests}`);
  if (Number.isFinite(suite.timeSec)) parts.push(`time=${suite.timeSec}s`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

function truncateHint(hint, maxLen = 120) {
  if (hint.length <= maxLen) return hint;
  return `${hint.slice(0, maxLen)}...`;
}

function main() {
  const { platform, dirs, outputPath } = parseArgs(process.argv);
  const searchDirs =
    dirs.length > 0 ? dirs : [path.join(REPO_ROOT, 'test', 'reports')];

  const xmlFiles = searchDirs.flatMap((d) => findXmlFiles(path.resolve(d)));
  if (xmlFiles.length === 0) {
    console.error(
      `No JUnit XML reports found in: ${searchDirs.join(', ')}\n` +
        'Run the acceptance tests first (they write to test/reports), or pass ' +
        'the directories containing each shard report.',
    );
    process.exit(1);
  }

  // Sum testsuite times per file within a single report run, then keep the
  // max across runs so a slow observation is never masked by a faster one.
  const perRun = new Map(); // xmlFile -> Map(relPath -> ms)
  let usedDescribeFallback = false;
  /** @type {{ xml: string, name: string, tests: number | null, timeSec: number, classnameHint: string | null }[]} */
  const unmatchedSuites = [];
  /** @type {{ xml: string, name: string, tests: number | null, timeSec: number, candidates: string[], classnameHint: string | null }[]} */
  const ambiguousSuites = [];

  for (const xmlFile of xmlFiles) {
    const xml = fs.readFileSync(xmlFile, 'utf8');
    const fileTotals = new Map();
    let match;
    TESTSUITE_RE.lastIndex = 0;
    while ((match = TESTSUITE_RE.exec(xml)) !== null) {
      const attrs = match[1];
      const timeMatch = attrs.match(TIME_ATTR_RE);
      if (!timeMatch) continue;
      const seconds = Number(timeMatch[1]);
      if (!Number.isFinite(seconds)) continue;
      const ms = seconds * 1000;

      const fileMatch = attrs.match(FILE_ATTR_RE);
      if (fileMatch) {
        const rel = toRepoRelativePosix(fileMatch[1]);
        fileTotals.set(rel, (fileTotals.get(rel) || 0) + ms);
        continue;
      }

      const nameMatch = attrs.match(NAME_ATTR_RE);
      if (!nameMatch) continue;
      const testsMatch = attrs.match(TESTS_ATTR_RE);
      const testsInSuite = testsMatch ? Number(testsMatch[1]) : null;
      const afterSuite = xml.slice(
        match.index + match[0].length,
        match.index + match[0].length + 4000,
      );
      const testcaseMatch = afterSuite.match(TESTCASE_CLASSNAME_RE);
      const classnameHint = testcaseMatch ? testcaseMatch[1] : null;
      const rel = resolveFileForTestsuite(
        nameMatch[1],
        testsInSuite,
        classnameHint,
      );
      if (!rel) {
        const candidates = (describeToFiles || buildDescribeToFilesMap()).get(
          nameMatch[1],
        );
        const suiteInfo = {
          xml: path.relative(REPO_ROOT, xmlFile),
          name: nameMatch[1],
          tests: testsInSuite,
          timeSec: seconds,
          classnameHint,
        };
        if (!candidates || candidates.length === 0) {
          unmatchedSuites.push(suiteInfo);
        } else {
          ambiguousSuites.push({ ...suiteInfo, candidates });
        }
        continue;
      }
      usedDescribeFallback = true;
      fileTotals.set(rel, (fileTotals.get(rel) || 0) + ms);
    }
    perRun.set(xmlFile, fileTotals);
  }

  const merged = {};
  for (const fileTotals of perRun.values()) {
    for (const [rel, ms] of fileTotals) {
      merged[rel] = Math.max(merged[rel] || 0, Math.round(ms));
    }
  }

  const fileCount = Object.keys(merged).length;
  if (fileCount === 0) {
    console.error(
      'Parsed reports but found no per-file timings. Ensure jest-junit has ' +
        'addFileAttribute: true, or that testsuite names match describe() titles in spec files.',
    );
    process.exit(1);
  }

  const sorted = Object.fromEntries(
    Object.entries(merged).sort((a, b) => b[1] - a[1]),
  );
  fs.writeFileSync(outputPath, JSON.stringify(sorted, null, 2) + '\n');
  console.log(
    `Wrote ${fileCount} test timings${platform ? ` (platform: ${platform})` : ''} to ${path.relative(
      process.cwd(),
      outputPath,
    )}`,
  );
  if (usedDescribeFallback) {
    console.warn(
      'Note: used describe()-name fallback (no file= on testsuite). ' +
        'Re-run after merging addFileAttribute for more accurate paths.',
    );
    if (unmatchedSuites.length > 0) {
      console.warn(
        `Warning: ${unmatchedSuites.length} testsuite(s) did not match any spec file:`,
      );
      for (const suite of unmatchedSuites) {
        const meta = formatSuiteMeta(suite);
        console.warn(`  - "${suite.name}"${meta} in ${suite.xml}`);
        if (suite.classnameHint) {
          console.warn(`    classname: ${truncateHint(suite.classnameHint)}`);
        }
      }
    }
    if (ambiguousSuites.length > 0) {
      console.warn(
        `Warning: skipped ${ambiguousSuites.length} testsuite(s) with ambiguous describe() titles:`,
      );
      for (const suite of ambiguousSuites) {
        const meta = formatSuiteMeta(suite);
        console.warn(`  - "${suite.name}"${meta} in ${suite.xml}`);
        console.warn(`    candidates: ${suite.candidates.join(', ')}`);
        if (suite.classnameHint) {
          console.warn(`    classname: ${truncateHint(suite.classnameHint)}`);
        }
      }
    }
  }
}

main();
