// postcss.config.cjs  (format CommonJS pour compat maximum dans CI)
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
