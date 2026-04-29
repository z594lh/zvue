module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        browsers: ['> 1%', 'last 2 versions', 'not dead', 'not ie 11']
      }
    }]
  ],
  plugins: [
    '@babel/plugin-transform-private-methods',
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-transform-class-static-block'
  ]
}
