const webpackMerge = require('webpack-merge');
const commonConfig = require('./config/webpack/webpack.common.config');
const configs = {
  dev: require('./config/webpack/webpack.dev.config'),
  pro: require('./config/webpack/webpack.pro.config'),
  debug: require('./config/webpack/webpack.debug.config')
};

const config = (env) => {
  if (env.config == 'dev') {
    process.env.NODE_ENV = 'development';
    process.env.BABEL_ENV = 'development';
  } else {
    process.env.NODE_ENV = 'production';
    process.env.BABEL_ENV = 'production';
    process.env.TAILWIND_MODE = 'watch';
  }

  if (env.config) {
    const selectedConfig = configs[env.config];
    // Handle function configs (like dev config)
    const resolvedConfig = typeof selectedConfig === 'function' ? selectedConfig(env) : selectedConfig;
    return webpackMerge.merge(commonConfig(env), resolvedConfig);
  }

  return commonConfig(env);
};

module.exports = config;
