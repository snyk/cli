import protect from '../../src/lib';
import { createProject } from '../util/createProject';
import { getPatchedLodash } from '../util/getPatchedLodash';
import * as http from '../../src/lib/http';
import * as analytics from '../../src/lib/analytics';
import * as path from 'path';
import * as os from 'os';
import * as fse from 'fs-extra';
import { runCommand } from '../util/runCommand';

jest.setTimeout(1000 * 60);

describe('@snyk/protect', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('applies patch(es)', () => {
    it('works for project with a single patchable module', async () => {
      const project = await createProject('single-patchable-module');
      const patchedLodash = await getPatchedLodash();

      const { code, stdout } = await runCommand(
        'node',
        [path.resolve(__dirname, '../../dist/index.js')],
        {
          cwd: project.path(),
        },
      );

      expect(stdout).toMatch('Successfully applied Snyk patches');
      expect(code).toEqual(0);

      await expect(
        project.read('node_modules/nyc/node_modules/lodash/lodash.js'),
      ).resolves.toEqual(patchedLodash);
    });

    it('works for project with multiple patchable modules', async () => {
      const project = await createProject('multiple-matching-paths');
      const patchedLodash = await getPatchedLodash();

      const { code, stdout } = await runCommand(
        'node',
        [path.resolve(__dirname, '../../dist/index.js')],
        {
          cwd: project.path(),
        },
      );

      expect(stdout).toMatch('Successfully applied Snyk patches');
      expect(code).toEqual(0);

      await expect(
        project.read('node_modules/nyc/node_modules/lodash/lodash.js'),
      ).resolves.toEqual(patchedLodash);
      await expect(
        project.read('node_modules/lodash/lodash.js'),
      ).resolves.toEqual(patchedLodash);
    });
  });

  describe('does not apply any patches and does not fail', () => {
    // in this scenario .snyk file has a vulnId which corresponds to the `lodash` package, but there are not instances of lodash in the node_modules
    it('for project with no modules with the target package name', async () => {
      const project = await createProject('no-matching-paths');

      const { code, stdout } = await runCommand(
        'node',
        [path.resolve(__dirname, '../../dist/index.js')],
        {
          cwd: project.path(),
        },
      );

      expect(stdout).toMatch('Nothing to patch');
      expect(code).toEqual(0);
    });

    // skipped because we need to check the versions of the found modules before we attempt to patch them which we don't currently do
    // and in order to do that, we need to first switch over to the new endpoint
    // it('for a project that has an instance of the target module but we have no patches for its version', async () => {
    //   const project = await createProject('target-module-exists-but-no-patches-for-version');
    //   const log = jest.spyOn(global.console, 'log');
    //   await protect(project.path());
    //   expect(log).toHaveBeenCalledWith('Nothing to patch');
    // });

    // fixture has a lodash@4.14.1 which we don't have patches for
    it('for project with no .snyk file', async () => {
      const project = await createProject('no-snyk-file');

      const { code, stdout } = await runCommand(
        'node',
        [path.resolve(__dirname, '../../dist/index.js')],
        {
          cwd: project.path(),
        },
      );

      expect(stdout).toMatch('No .snyk file found');
      expect(code).toEqual(0);
    });
  });

  describe('does not send analytics if analytics is disabled', () => {
    describe('via snyk.json file', () => {
      let tempConfigFolder: string;
      let tempSnykConfigFile: string;

      beforeAll(() => {
        tempConfigFolder = fse.mkdtempSync(
          path.resolve(os.tmpdir(), `snyk-config-`),
        );
        tempSnykConfigFile = path.resolve(tempConfigFolder, 'snyk.json');
        process.env.SNYK_CONFIG_FILE = tempSnykConfigFile;
      });

      afterAll(() => {
        delete process.env.SNYK_CONFIG_FILE;
        fse.removeSync(tempConfigFolder);
      });

      it('when disable-analytics equals "1" (as a string)', async () => {
        fse.writeFileSync(
          tempSnykConfigFile,
          JSON.stringify({ 'disable-analytics': '1' }),
          'utf-8',
        );
        const postJsonSpy = jest.spyOn(http, 'postJson');
        const sendAnalyticsSpy = jest.spyOn(analytics, 'sendAnalytics');
        const project = await createProject('no-matching-paths');

        await protect(project.path());

        expect(sendAnalyticsSpy).toHaveBeenCalledTimes(1); // we call sendAnalytics
        expect(postJsonSpy).toHaveBeenCalledTimes(0); // but a call to the API was never made
      });

      it('when disable-analytics equals 1 (as a number)', async () => {
        fse.writeFileSync(
          tempSnykConfigFile,
          JSON.stringify({ 'disable-analytics': 1 }),
          'utf-8',
        );
        const postJsonSpy = jest.spyOn(http, 'postJson');
        const sendAnalyticsSpy = jest.spyOn(analytics, 'sendAnalytics');
        const project = await createProject('no-matching-paths');

        await protect(project.path());

        expect(sendAnalyticsSpy).toHaveBeenCalledTimes(1); // we call sendAnalytics
        expect(postJsonSpy).toHaveBeenCalledTimes(0); // but a call to the API was never made
      });
    });

    describe('via SNYK_DISABLE_ANALYTICS env var', () => {
      it('when SNYK_DISABLE_ANALYTICS is "true"', async () => {
        process.env.SNYK_DISABLE_ANALYTICS = 'true';
        try {
          const postJsonSpy = jest.spyOn(http, 'postJson');
          const sendAnalyticsSpy = jest.spyOn(analytics, 'sendAnalytics');
          const project = await createProject('no-matching-paths');

          await protect(project.path());

          expect(sendAnalyticsSpy).toHaveBeenCalledTimes(1); // we call sendAnalytics
          expect(postJsonSpy).toHaveBeenCalledTimes(0); // but a call to the API was never made
        } finally {
          delete process.env.SNYK_DISABLE_ANALYTICS;
          console.log(delete process.env.SNYK_DISABLE_ANALYTICS);
        }
      });

      it('when SNYK_DISABLE_ANALYTICS is "1"', async () => {
        process.env.SNYK_DISABLE_ANALYTICS = '1';
        try {
          const postJsonSpy = jest.spyOn(http, 'postJson');
          const sendAnalyticsSpy = jest.spyOn(analytics, 'sendAnalytics');
          const project = await createProject('no-matching-paths');

          await protect(project.path());

          expect(sendAnalyticsSpy).toHaveBeenCalledTimes(1); // we call sendAnalytics
          expect(postJsonSpy).toHaveBeenCalledTimes(0); // but a call to the API was never made
        } finally {
          delete process.env.SNYK_DISABLE_ANALYTICS;
          console.log(delete process.env.SNYK_DISABLE_ANALYTICS);
        }
      });
    });
  });
});
