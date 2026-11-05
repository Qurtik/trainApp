const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

const previousEnhanceMiddleware = config.server.enhanceMiddleware;

config.server.enhanceMiddleware = (middleware, server) => {
  const enhanced = previousEnhanceMiddleware
    ? previousEnhanceMiddleware(middleware, server)
    : middleware;

  return (req, res, next) => {
    const url = req.url ?? '';
    const isNativeBundle = /[?&]platform=(android|ios)\b/.test(url);
    if (!isNativeBundle) {
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    }
    return enhanced(req, res, next);
  };
};

module.exports = config;
