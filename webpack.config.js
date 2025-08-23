const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: {
      'background/service-worker': './src/background/service-worker.ts',
      'content/detector': './src/content/detector.ts',
      'content/injector': './src/content/injector.ts',
      'popup/popup': './src/popup/popup.ts',
      'offscreen/offscreen': './src/offscreen/offscreen.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'src/manifest.json',
            to: 'manifest.json',
          },
          {
            from: 'src/popup/popup.html',
            to: 'popup/popup.html',
          },
          {
            from: 'src/offscreen/offscreen.html',
            to: 'offscreen/offscreen.html',
          },
          {
            from: 'src/content/styles.css',
            to: 'content/styles.css',
          },
          {
            from: 'public/icons',
            to: 'icons',
          },
          {
            from: 'node_modules/gif.js/dist/gif.worker.js',
            to: 'gif.worker.js',
          },
        ],
      }),
    ],
    devtool: isProduction ? false : 'inline-source-map',
    optimization: {
      minimize: isProduction,
    },
  };
};