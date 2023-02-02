import * as common from './common';
import * as process from 'process';
import * as Sentry from '@sentry/node';

const config = common.getCurrentConfiguration();
export const executable = config.getLocalLocation();

if (process.argv.includes('exec')) {
  const filenameShasum = config.getShasumFile();
  const downloadUrl = config.getDownloadLocation();

  common
    .downloadExecutable(downloadUrl, executable, filenameShasum)
    .then(process.exit)
    .catch((err) => {
      const sentryError = new Error(
        'Error downloading binary ' + downloadUrl + ' (' + err + ')',
      );
      Sentry.init({
        dsn:
          'https://3e845233db8c4f43b4c4b9245f1d7bd6@o30291.ingest.sentry.io/4504599528079360',
        release: config.getVersion(),
      });
      Sentry.captureException(sentryError);

      console.error(err);
      process.exit(1);
    });
}
