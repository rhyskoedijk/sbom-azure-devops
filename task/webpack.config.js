const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');

module.exports = (env, argv) => ({
  target: 'node',
  entry: {
    index: './index.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'task'),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/i,
        loader: 'ts-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          format: {
            comments: false,
          },
        },
      }),
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { context: 'node_modules/@vizdom/vizdom-ts-node/', from: '*.wasm' },
        { context: '../images', from: 'icon.png' },
        { from: 'task.json' },
      ],
    }),
  ],
  stats: {
    warnings: false,
  },
});
