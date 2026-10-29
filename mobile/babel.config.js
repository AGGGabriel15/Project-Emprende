// Config de Babel de todo el proyecto: también transforma los módulos que la
// app comparte con el web (../src), por ejemplo en las pruebas con jest-expo.
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
