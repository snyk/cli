import * as common from './common';
import * as process from 'process';

const config = common.getCurrentConfiguration();
export const executable = config.getLocalLocation();

if (process.argv.includes('exec')) {
  const filenameShasum = config.getShasumFile();
  const downloadUrl = config.getDownloadLocation();

  common
    .downloadExecutable(downloadUrl, executable, filenameShasum)
    .then(process.exit)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
