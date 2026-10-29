// Metro: la app comparte módulos puros del web (../src: tipos, estados, precios,
// horarios, validaciones). Los imports "@/..." apuntan allí, y los paquetes que
// esos archivos usan (zod, libphonenumber-js) se resuelven desde mobile/node_modules,
// porque en EAS Build solo se instala esta carpeta.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const webSrc = path.resolve(__dirname, '../src');
const appEntry = path.join(__dirname, 'package.json');

config.watchFolders = [...(config.watchFolders ?? []), webSrc];

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstream ?? context.resolveRequest;
  if (moduleName.startsWith('@/')) {
    return resolve(context, path.join(webSrc, moduleName.slice(2)), platform);
  }
  const bare = !moduleName.startsWith('.') && !path.isAbsolute(moduleName);
  if (bare && context.originModulePath.startsWith(webSrc)) {
    return resolve({ ...context, originModulePath: appEntry }, moduleName, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
