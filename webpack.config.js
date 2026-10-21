// Builds client/dist from client/source (npm run build / npm run watch, in this folder).
// Everything it needs is in this package: the project it's installed in doesn't build it, composer installs the built dist

const fs = require('fs');
const path = require('path');
const autoprefixer = require('autoprefixer');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const RemoveEmptyScriptsPlugin = require('webpack-remove-empty-scripts');

const source = path.resolve(__dirname, 'client/source');
const dist = path.resolve(__dirname, 'client/dist');

// One stylesheet for each module the CMS styles (styles/modules/<vendor>/<package>: a folder with an index.scss, or a file),
// named after the module's composer name. They're written to dist/styles/modules/<vendor>/<package>.css, and loaded only
// when that module is installed (LeftAndMainExtension)
const modulesDir = path.join(source, 'styles/modules');
const moduleStyles = Object.fromEntries(
  fs.readdirSync(modulesDir, { withFileTypes: true })
    .filter((vendor) => vendor.isDirectory())
    .flatMap((vendor) => fs.readdirSync(path.join(modulesDir, vendor.name), { withFileTypes: true }).flatMap((entry) => {
      const base = path.join(modulesDir, vendor.name, entry.name);

      if (entry.isDirectory()) return [[`modules/${vendor.name}/${entry.name}`, path.join(base, 'index.scss')]];
      if (entry.name.endsWith('.scss')) return [[`modules/${vendor.name}/${entry.name.replace(/\.scss$/, '')}`, base]];
      return [];
    }))
);

module.exports = (env, argv) => {
  const production = argv.mode === 'production';

  return {
    name: 'silverstripe-cms-styles',
    mode: production ? 'production' : 'development',
    devtool: false,
    stats: 'errors-warnings',
    watchOptions: { ignored: /node_modules/ },
    entry: {
      // The CMS's scripts and styles (cms.js imports cms.scss, which is written to dist/styles/cms.css)
      'cms': path.join(source, 'scripts/cms.js'),
      // Inlined in the CMS's <head> to apply the theme before anything is drawn
      'appearance-boot': path.join(source, 'scripts/appearance-boot.js'),
      // Inlined in the CMS's <head> too: the styles for the first thing drawn (written to dist/styles/critical.css)
      'critical': path.join(source, 'styles/critical.scss'),
      ...moduleStyles,
      // Runs in the site's pages when they are shown in the CMS preview
      'preview': path.join(source, 'scripts/preview.js'),
      // The dev pages (dev/build, tasks...)
      'dev': path.join(source, 'scripts/dev.js'),
    },
    output: {
      path: path.join(dist, 'scripts'),
      filename: '[name].js',
      chunkFilename: 'components/[name].[contenthash:8].js',
      // Lazy chunks (the code editor) load from beside the script that asked for them, wherever the package is installed
      publicPath: 'auto',
      clean: true,
    },
    resolve: {
      alias: {
        // @use 'cms/abstracts' in the styles
        cms: path.join(source, 'styles'),
      },
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              // Not the project's babel config, this package brings its own
              babelrc: false,
              configFile: false,
              cacheDirectory: true,
              cacheCompression: false,
              // Syntax only: no polyfills (the CMS styles need a modern browser anyway, and boot script is inlined in every page)
              presets: [['@babel/preset-env', { modules: false }]],
            },
          },
        },
        {
          test: /\.scss$/,
          use: [
            MiniCssExtractPlugin.loader,
            { loader: 'css-loader', options: { url: false } },
            { loader: 'postcss-loader', options: { postcssOptions: { plugins: [autoprefixer()] } } },
            'sass-loader',
          ],
        },
      ],
    },
    optimization: {
      minimizer: [
        new TerserPlugin({ terserOptions: { compress: { passes: 2 } } }),
        new CssMinimizerPlugin(),
      ],
    },
    plugins: [
      new RemoveEmptyScriptsPlugin(),
      // (the css goes to dist/styles, beside dist/scripts)
      new MiniCssExtractPlugin({ filename: '../styles/[name].css', chunkFilename: '[name].css' }),
    ],
  };
};
