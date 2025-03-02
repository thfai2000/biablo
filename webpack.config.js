const path = require('path');

module.exports = {
  mode: 'development',
  entry: {
    'utils': './src/client/utils.ts',
    'dungeon-generator': './src/client/dungeon-generator.ts',
    'player': './src/client/player.ts',
    'game': './src/client/game.ts',
    'stats-widget': './src/client/stats-widget.ts',
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'public/js'),
  },
};