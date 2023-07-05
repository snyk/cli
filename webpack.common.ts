const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const LicensePlugin = require('webpack-license-plugin');

export default {
  entry: './src/cli/index.ts',
  target: 'node12',
  output: {
    clean: true,
    path: path.resolve(__dirname, 'dist/cli/'),
    filename: 'index.js',
    hashFunction: 'sha256',
    library: {
      name: 'snyk',
      type: 'commonjs2',
    },
  },
  node: false, // don't mock node modules
  plugins: [
    new CopyPlugin({
      patterns: [
        // All of these plugins rely on a init.gradle or similar file in a specific location
        // We should upgrade those npm packages to statically load these, instead of relying on a file location
        {
          from: 'node_modules/snyk-gradle-plugin/lib/init.gradle',
          to: '../lib',
        },
        {
          from: 'node_modules/snyk-python-plugin/pysrc/',
          to: '../../pysrc/',
        },
        {
          from: 'node_modules/@snyk/snyk-hex-plugin/elixirsrc/',
          to: '../elixirsrc/',
        },
        {
          from: 'node_modules/snyk-sbt-plugin/scala/',
          to: '../scala/',
        },
        {
          from: 'node_modules/snyk-go-plugin/gosrc/',
          to: '../gosrc/',
        },
        {
          from: 'node_modules/sql.js/dist/sql-wasm.wasm',
          to: './',
        },
      ],
    }),
    new LicensePlugin({
      outputFilename: 'thirdPartyNotice.json',
      excludedPackageTest: (packageName) => {
        return (
          packageName.startsWith('@snyk/') ||
          packageName === '@arcanis/slice-ansi' // this MIT package comes with license in the README
        );
      },
      additionalFiles: {
        'thirdPartyNotice.json': (packages) =>
          JSON.stringify(
            [
              {
                name: '@arcanis/slice-ansi',
                version: '1.0.2',
                repository: null,
                source:
                  'https://registry.npmjs.org/@arcanis/slice-ansi/-/slice-ansi-1.0.2.tgz',
                license: 'MIT',
                // taken from npm page README https://www.npmjs.com/package/@arcanis/slice-ansi/v/1.0.2
                licenseText:
                  'Copyright © 2020 Mael Nison\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
              },
              ...packages,
            ],
            null,
            2,
          ),
      },
    }),
  ],
  module: {
    rules: [
      {
        test: /\.ts$/i,
        loader: 'ts-loader',
      },
      {
        test: /\.node$/,
        loader: 'node-loader',
      },
    ],
    // noParse avoids breaking sql.js. https://github.com/sql-js/sql.js/issues/406#issuecomment-688594485
    noParse: /node_modules\/sql\.js\/dist\/sql-wasm\.js$/,
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    modules: ['packages', 'node_modules'],
  },
  externals: {},
};
