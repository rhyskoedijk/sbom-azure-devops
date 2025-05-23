const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');

module.exports = (env, argv) => ({
  target: 'web',
  entry: {
    'sbom-report-tab': path.resolve('./sbom-report-tab.tsx'),
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'ui'),
    publicPath: '/ui/',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/i,
        loader: 'ts-loader',
      },
      {
        test: /\.s[ac]ss$/i,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/inline',
      },
      {
        test: /\.html$/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    fallback: {
      path: require.resolve('path-browserify'),
    },
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
      patterns: [{ from: '*.html' }],
    }),
  ],
  stats: {
    warnings: false,
  },

  ...(env.WEBPACK_SERVE
    ? {
        devtool: 'inline-source-map',
        devServer: {
          server: 'https',
          port: 3000,
          open: ['/ui/sbom-report-tab.html'],
        },
      }
    : {}),
});
