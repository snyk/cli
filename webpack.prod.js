const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const LicensePlugin = require('webpack-license-plugin');

module.exports = merge(common, {
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
