import * as common from './common';
import * as process from 'process';
import * as Sentry from '@sentry/node';

async function logError(err): Promise<void> {
  const version = common.getCurrentVersion(common.versionFile);
  Sentry.init({
    dsn:
      'https://3e845233db8c4f43b4c4b9245f1d7bd6@o30291.ingest.sentry.io/4504599528079360',
    release: version,
  });

  const sentryError = new Error('Error downloading binary (' + err + ')');
  sentryError.stack = err.stack;
  Sentry.captureException(sentryError);
  await Sentry.close();
  console.error(err);
}

try {
  const config = common.getCurrentConfiguration();
  const executable = config.getLocalLocation();

  if (process.argv.includes('exec')) {
    const filenameShasum = config.getShasumFile();
    const downloadUrl = config.getDownloadLocation();

    common
      .downloadExecutable(downloadUrl, executable, filenameShasum)
      .then(async (exitCode) => {
        if (exitCode != 0) {
          logError(Error('code: ' + exitCode)).then(() =>
            process.exit(exitCode),
          );
        }
      })
      .catch((err) => {
        logError(err).then(() => process.exit(1));
      });
  }
} catch (err) {
  logError(err).then(() => process.exit(1));
}
