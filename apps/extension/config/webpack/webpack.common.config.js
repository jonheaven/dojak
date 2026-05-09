const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = function commonConfig(env = {}) {
  const mode = env.config === 'dev' || env.config === 'debug' ? 'development' : 'production';
  const rootDir = path.resolve(__dirname, '../..');

  return {
    mode,
    context: rootDir,
    entry: {
      background: path.resolve(rootDir, '../../packages/core/src/background/index.ts'),
      'content-script': path.resolve(rootDir, 'src/content-script/index.ts'),
      pageProvider: path.resolve(rootDir, 'src/content-script/pageProvider/index.ts'),
      popup: path.resolve(rootDir, 'src/popup/index.tsx')
    },
    output: {
      path: path.resolve(rootDir, `dist/${env.browser || 'chrome'}`),
      filename: '[name].js',
      chunkFilename: '[name].chunk.js',
      clean: false
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      modules: [path.resolve(rootDir, 'node_modules'), path.resolve(rootDir, '../../node_modules'), 'node_modules'],
      alias: {
        '@dojak/core/lib': path.resolve(rootDir, '../../packages/core/src/shared/lib'),
        '@dojak/core/utils': path.resolve(rootDir, '../../packages/core/src/shared/utils'),
        '@dojak/core/constant': path.resolve(rootDir, '../../packages/core/src/shared/constant'),
        '@dojak/core/types': path.resolve(rootDir, '../../packages/core/src/shared/types.ts'),
        '@dojak/ui/src': path.resolve(rootDir, '../../packages/ui/src'),
        '@': path.resolve(rootDir, 'src'),
        '@dojak/core': path.resolve(rootDir, '../../packages/core/src'),
        '@dojak/ui': path.resolve(rootDir, '../../packages/ui/src'),
        'react-native$': 'react-native-web',
        'process/browser': require.resolve('process/browser.js'),
        'bitcoinjs-lib': path.resolve(rootDir, '../../node_modules/.pnpm/bitcoinjs-lib@6.1.7/node_modules/bitcoinjs-lib'),
        bip174: path.resolve(rootDir, '../../node_modules/.pnpm/bip174@2.1.1/node_modules/bip174')
      },
      fallback: {
        assert: require.resolve('assert/'),
        buffer: require.resolve('buffer/'),
        crypto: require.resolve('crypto-browserify'),
        events: require.resolve('events/'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        os: false,
        process: require.resolve('process/browser.js'),
        stream: require.resolve('stream-browserify'),
        url: require.resolve('url/'),
        vm: false,
        zlib: require.resolve('browserify-zlib')
      }
    },
    experiments: {
      asyncWebAssembly: true
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          include: [
            path.resolve(rootDir, 'src'),
            path.resolve(rootDir, '../../packages/core/src'),
            path.resolve(rootDir, '../../packages/ui/src')
          ],
          use: {
            loader: require.resolve('babel-loader'),
            options: {
              presets: [require.resolve('babel-preset-react-app')]
            }
          }
        },
        {
          test: /\.css$/,
          use: [require.resolve('style-loader'), require.resolve('css-loader')]
        },
        {
          test: /\.less$/,
          use: [require.resolve('style-loader'), require.resolve('css-loader'), require.resolve('less-loader')]
        },
        {
          test: /\.(png|jpe?g|gif|svg|woff2?|ttf|eot)$/i,
          type: 'asset/resource'
        },
        {
          test: /\.wasm$/,
          type: 'webassembly/async'
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(mode),
        'process.env.manifest': JSON.stringify(env.manifest || 'mv3'),
        'process.env.channel': JSON.stringify(env.channel || 'github'),
        'process.env.release': JSON.stringify(env.version || '0.0.0')
      }),
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser'
      }),
      new HtmlWebpackPlugin({
        filename: 'popup.html',
        template: path.resolve(rootDir, 'src/popup/index.html'),
        chunks: ['popup'],
        inject: 'body'
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(rootDir, 'src/options.html'),
            to: path.resolve(rootDir, `dist/${env.browser || 'chrome'}/options.html`),
            noErrorOnMissing: true
          },
          {
            from: path.resolve(rootDir, 'src/qr-scanner.html'),
            to: path.resolve(rootDir, `dist/${env.browser || 'chrome'}/qr-scanner.html`),
            noErrorOnMissing: true
          },
          {
            from: path.resolve(rootDir, 'src/qr-scanner.js'),
            to: path.resolve(rootDir, `dist/${env.browser || 'chrome'}/qr-scanner.js`),
            noErrorOnMissing: true
          }
        ]
      })
    ],
    optimization: {
      concatenateModules: false
    }
  };
};
