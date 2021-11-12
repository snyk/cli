import { merge } from 'webpack-merge';
import common from './webpack.common';
import { Configuration } from 'webpack';
const LicensePlugin = require('webpack-license-plugin');

export default merge(common as Configuration, {
  mode: 'production',
  devtool: 'source-map',
  optimization: {
    minimize: false,
  },
  plugins: [
    new LicensePlugin({
      outputFilename: 'thirdPartyNotice.json',
      licenseOverrides: {
        '@arcanis/slice-ansi@1.0.2': 'MIT',
      },
      excludedPackageTest: (packageName) => {
        return packageName.startsWith('@snyk/');
      },
    }),
  ],
});
