import * as common from './common';
import * as process from 'process';

const errorContextMessage = 'Download Error';

try {
  const config = common.getCurrentConfiguration();
  const executable = config.getLocalLocation();

  if (process.argv.includes('exec')) {
    const filenameShasum = config.getShasumFile();
    const downloadUrl = config.getDownloadLocation();

    common
      .downloadExecutable(downloadUrl, executable, filenameShasum)
      .then((error) => {
        if (error !== undefined) {
          common
            .logError(errorContextMessage, error)
            .then(() => process.exit(1));
        }
      })
      .catch((err) => {
        common.logError(errorContextMessage, err).then(() => process.exit(2));
      });
  }
} catch (err) {
  common.logError(errorContextMessage, err).then(() => process.exit(3));
}
