import { merge } from 'webpack-merge';
import { Configuration } from 'webpack';
import common from './webpack.common';

export default merge(common as Configuration, {
  mode: 'development',
  devtool: 'inline-source-map',
});
