const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

export default {
  entry: './src/cli/index.ts',
  target: 'node12',
  output: {
    clean: true,
    path: path.resolve(__dirname, 'dist/cli/'),
    filename: 'index.js',
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
          from: 'node_modules/@snyk/java-call-graph-builder/bin/init.gradle',
          to: '../bin',
        },
        {
          from: 'node_modules/snyk-gradle-plugin/lib/legacy-init.gradle',
          to: '../lib',
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
          from: 'node_modules/sql.js/dist/sql-wasm.wasm',
          to: './',
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
