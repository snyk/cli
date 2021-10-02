const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/cli/index.ts',
  target: 'node10',
  output: {
    clean: true,
    path: path.resolve(__dirname, 'dist/cli/'),
    filename: 'index.js',
    library: {
      name: 'snyk',
      type: 'umd',
    },
  },
  node: false, // don't mock node modules
  plugins: [
    new CopyPlugin({
      patterns: [
        // All of these plugins rely on a init.gradle or similar file in a specific location
        // We should upgrade those npm packages to statically load these, instead of relying on a file location
        {
          from: 'node_modules/@snyk/java-call-graph-builder/bin/init.gradle',
          to: '../bin',
        },
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
          from:
            'node_modules/@snyk/java-call-graph-builder/config.default.json',
          to: '../',
        },
      ],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.ts$/i,
        loader: 'ts-loader',
        exclude: ['/node_modules'],
      },
      {
        // `./node_modules/ssh2/lib/protocol/crypto/build/Release/sshcrypto.node` is a binary file introduced
        // by snyk-docker-plugin -> docker-modem@3
        test: /ssh2\/lib\/protocol\/crypto\/build\/Release\/sshcrypto\.node/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    modules: ['packages', 'node_modules'],
  },
  externals: {},
};
