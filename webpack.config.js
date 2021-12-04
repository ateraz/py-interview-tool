const path = require('path')
const webpack = require('webpack')

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    monaco: './monaco.js',
    // Package each language's worker and give these filenames in `getWorkerUrl`
    'editor.worker': 'monaco-editor/esm/vs/editor/editor.worker.js',
    'json.worker': 'monaco-editor/esm/vs/language/json/json.worker',
    'css.worker': 'monaco-editor/esm/vs/language/css/css.worker',
    'html.worker': 'monaco-editor/esm/vs/language/html/html.worker',
    'ts.worker': 'monaco-editor/esm/vs/language/typescript/ts.worker'
  },
  output: {
    globalObject: 'self',
    path: path.resolve('./dist/'),
    filename: '[name].bundle.js',
    publicPath: '/dist/'
  },
  module: {
    rules: [{
      test: /\.css$/,
      use: ['style-loader', 'css-loader']
    }, {
      test: /\.ttf$/,
      use: ['file-loader']
    }]
  },
  devServer: {
    contentBase: path.join('.'),
    compress: true,
    publicPath: '/dist/'
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1
    })
  ]
}
