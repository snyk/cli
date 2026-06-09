import {
  mapLegacyGraphFlags,
  shouldPrintGraph,
  isJsonl,
  shouldEmbedErrors,
} from '../../../src/lib/snyk-test/common';
import { Options, TestOptions } from '../../../src/lib/types';

describe('print-graph flag resolution', () => {
  let stderrSpy: jest.SpyInstance;

  const baseOptions: Options & TestOptions = {
    path: '',
    showVulnPaths: 'some',
  };

  beforeEach(() => {
    stderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('bare --print-graph resolves to plaintext (no jsonl)', () => {
    const opts: Options & TestOptions = { ...baseOptions, 'print-graph': true };
    mapLegacyGraphFlags(opts);

    expect(shouldPrintGraph(opts)).toBe(true);
    expect(isJsonl(opts)).toBe(false);
    expect(shouldEmbedErrors(opts)).toBe(false);
    expect(opts['prune']).toBeFalsy();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('--print-graph --jsonl resolves to complete JSONL (no pruning)', () => {
    const opts: Options & TestOptions = {
      ...baseOptions,
      'print-graph': true,
      jsonl: true,
    };
    mapLegacyGraphFlags(opts);

    expect(shouldPrintGraph(opts)).toBe(true);
    expect(isJsonl(opts)).toBe(true);
    expect(shouldEmbedErrors(opts)).toBe(true);
    expect(opts['prune']).toBeFalsy();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('--print-graph --prune resolves to pruned JSONL', () => {
    const opts: Options & TestOptions = {
      ...baseOptions,
      'print-graph': true,
      prune: true,
    };
    mapLegacyGraphFlags(opts);

    expect(shouldPrintGraph(opts)).toBe(true);
    expect(isJsonl(opts)).toBe(true);
    expect(shouldEmbedErrors(opts)).toBe(true);
    expect(opts['prune']).toBe(true);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('--prune alone implies --print-graph and --jsonl', () => {
    const opts: Options & TestOptions = { ...baseOptions, prune: true };
    mapLegacyGraphFlags(opts);

    expect(shouldPrintGraph(opts)).toBe(true);
    expect(isJsonl(opts)).toBe(true);
    expect(shouldEmbedErrors(opts)).toBe(true);
    expect(opts['print-graph']).toBe(true);
  });

  it('--print-effective-graph maps to pruned JSONL but throws on errors', () => {
    const opts: Options & TestOptions = {
      ...baseOptions,
      'print-effective-graph': true,
    };
    mapLegacyGraphFlags(opts);

    expect(shouldPrintGraph(opts)).toBe(true);
    expect(isJsonl(opts)).toBe(true);
    expect(opts['prune']).toBe(true);
    expect(opts['print-graph']).toBe(true);
    expect(shouldEmbedErrors(opts)).toBe(false);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('--print-effective-graph is deprecated'),
    );
  });

  it('--print-effective-graph-with-errors maps to pruned JSONL with embedded errors', () => {
    const opts: Options & TestOptions = {
      ...baseOptions,
      'print-effective-graph-with-errors': true,
    };
    mapLegacyGraphFlags(opts);

    expect(shouldPrintGraph(opts)).toBe(true);
    expect(isJsonl(opts)).toBe(true);
    expect(opts['prune']).toBe(true);
    expect(opts['print-graph']).toBe(true);
    expect(shouldEmbedErrors(opts)).toBe(true);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '--print-effective-graph-with-errors is deprecated',
      ),
    );
  });

  it('--print-output-jsonl-with-errors maps to unpruned JSONL with embedded errors', () => {
    const opts: Options & TestOptions = {
      ...baseOptions,
      'print-output-jsonl-with-errors': true,
    };
    mapLegacyGraphFlags(opts);

    expect(shouldPrintGraph(opts)).toBe(true);
    expect(isJsonl(opts)).toBe(true);
    expect(opts['prune']).toBeFalsy();
    expect(opts['print-graph']).toBe(true);
    expect(shouldEmbedErrors(opts)).toBe(true);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('--print-output-jsonl-with-errors is deprecated'),
    );
  });

  it('no print flags resolves to no graph printing', () => {
    const opts: Options & TestOptions = { ...baseOptions };
    mapLegacyGraphFlags(opts);

    expect(shouldPrintGraph(opts)).toBe(false);
    expect(isJsonl(opts)).toBe(false);
    expect(shouldEmbedErrors(opts)).toBe(false);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('--print-deps alongside --print-graph suppresses graph printing', () => {
    const opts: Options & TestOptions = {
      ...baseOptions,
      'print-graph': true,
      'print-deps': true,
    };
    mapLegacyGraphFlags(opts);

    expect(shouldPrintGraph(opts)).toBe(false);
  });
});
