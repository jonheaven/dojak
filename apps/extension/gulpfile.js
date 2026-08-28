var webpack = require('webpack');
var webpackConfigFunc = require('./webpack.config');
var gulp = require('gulp');
var zip = require('gulp-zip');
var clean = require('gulp-clean');
var jsoncombine = require('gulp-jsoncombine');
var minimist = require('minimist');
var packageConfig = require('./package.json');
const { exit } = require('process');
const uglify = require('gulp-uglify');

//parse arguments
var knownOptions = {
  string: ['env', 'browser', 'manifest', 'channel'],
  default: {
    env: 'dev',
    browser: 'chrome',
    manifest: 'mv3',
    channel: 'store'
  }
};

var supported_envs = ['dev', 'pro'];
var supported_browsers = ['chrome', 'firefox', 'edge', 'brave'];
var supported_mvs = ['mv2', 'mv3'];
var brandName = 'dojak';
var version = packageConfig.version;
var validVersion = version.split('-beta')[0];
var options = {
  env: knownOptions.default.env,
  browser: knownOptions.default.browser,
  manifest: knownOptions.default.manifest
};
options = minimist(process.argv.slice(2), knownOptions);
if (!supported_envs.includes(options.env)) {
  console.error(`not supported env: [${options.env}]. It should be one of ${supported_envs.join(', ')}.`);
  exit(0);
}
if (!supported_browsers.includes(options.browser)) {
  console.error(`not supported browser: [${options.browser}]. It should be one of ${supported_browsers.join(', ')}.`);
  exit(0);
}
if (!supported_mvs.includes(options.manifest)) {
  console.error(`not supported browser: [${options.manifest}]. It should be one of ${supported_mvs.join(', ')}.`);
  exit(0);
}

//tasks...
function task_clean() {
  return gulp.src(`dist/${options.browser}/*`, { read: false }).pipe(clean());
}

function task_prepare() {
  // Monorepo-safe preparation: source assets directly from src/bin.
  const raw = gulp.src(['src/qr-scanner.html', 'src/qr-scanner.js'], { allowEmpty: true }).pipe(gulp.dest(`dist/${options.browser}`));
  const optionsPage = gulp.src('src/options.html', { allowEmpty: true }).pipe(gulp.dest(`dist/${options.browser}`));
  const icons = gulp.src(['bin/icons/**/*', 'src/assets/doge.svg'], { allowEmpty: true }).pipe(gulp.dest(`dist/${options.browser}/icons`));
  const locales = gulp.src('src/_locales/**/*').pipe(gulp.dest(`dist/${options.browser}/_locales`));
  const manifestBase = gulp.src('src/manifest/_base_v3.json').pipe(gulp.dest(`dist/${options.browser}/manifest`));
  const manifestBrowser = gulp.src(`src/manifest/${options.browser}.json`, { allowEmpty: true }).pipe(gulp.dest(`dist/${options.browser}/manifest`));
  return require('merge-stream')(raw, optionsPage, icons, locales, manifestBase, manifestBrowser);
}

function task_merge_manifest() {
  let baseFile = '_base_v3';
  if (options.manifest == 'mv2') {
    baseFile = '_base_v2';
  }
  return gulp
    .src([
      `dist/${options.browser}/manifest/${baseFile}.json`,
      `dist/${options.browser}/manifest/${options.browser}.json`
    ])
    .pipe(
      jsoncombine('manifest.json', (data, meta) => {
        const result = Object.assign({}, data[baseFile], data[options.browser]);
        result.version = validVersion;
        return Buffer.from(JSON.stringify(result));
      })
    )
    .pipe(gulp.dest(`dist/${options.browser}`));
}

function task_clean_tmps() {
  return gulp.src(`dist/${options.browser}/manifest`, { read: false }).pipe(clean());
}

function task_webpack(cb) {
  webpack(
    webpackConfigFunc({
      version: validVersion,
      config: options.env,
      browser: options.browser,
      manifest: options.manifest,
      channel: options.channel
    }),
    (err, stats) => {
      if (err) {
        console.error(err);
        return cb(err);
      }
      if (stats.hasErrors()) {
        console.error(stats.toString({ colors: true, errors: true }));
        return cb(new Error('Webpack compilation errors'));
      }
      console.log(stats.toString({ colors: true }));
      cb();
    }
  );
}

function task_uglify(cb) {
  if (options.env == 'pro') {
    return gulp
      .src(`dist/${options.browser}/**/*.js`)
      .pipe(uglify())
      .pipe(gulp.dest(`dist/${options.browser}`));
  }
  cb();
}

function task_package(cb) {
  if (options.env == 'pro') {
    if (options.browser == 'firefox') {
      return gulp
        .src(`dist/${options.browser}/**/*`)
        .pipe(zip(`${brandName}-${options.browser}-${options.manifest}-v${version}.xpi`))
        .pipe(gulp.dest('./dist'));
    } else {
      return gulp
        .src(`dist/${options.browser}/**/*`)
        .pipe(zip(`${brandName}-${options.browser}-${options.manifest}-v${version}.zip`))
        .pipe(gulp.dest('./dist'));
    }
  }
  cb();
}

exports.build = gulp.series(
  task_clean,
  task_prepare,
  task_merge_manifest,
  task_clean_tmps,
  task_webpack,
  task_uglify,
  task_package
);

// Fast watch mode for development - skips clean and enables webpack watch
function task_webpack_watch(cb) {
  const compiler = webpack(
    webpackConfigFunc({
      version: validVersion,
      config: options.env,
      browser: options.browser,
      manifest: options.manifest,
      channel: options.channel
    })
  );

  compiler.watch({}, (err, stats) => {
    if (err) {
      console.error(err);
      return;
    }
    if (stats.hasErrors()) {
      console.error(stats.toString({ colors: true, errors: true }));
      return;
    }
    console.log('✨ Rebuilt:', new Date().toLocaleTimeString());
    console.log(stats.toString({ colors: true, chunks: false, modules: false }));
  });

  // Don't call cb() - watch mode runs indefinitely
}

exports.watch = gulp.series(
  task_prepare,
  task_merge_manifest,
  task_clean_tmps,
  task_webpack_watch
);