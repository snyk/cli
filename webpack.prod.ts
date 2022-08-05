import { merge } from 'webpack-merge';
import common from './webpack.common';
import { Configuration } from 'webpack';

export default merge(common as Configuration, {
  mode: 'production',
  devtool: 'source-map',
  optimization: {
    minimize: false,
  },
});
