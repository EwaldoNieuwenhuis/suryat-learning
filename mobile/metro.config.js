const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Zorg dat .db (voor surayt.db), .mp3 en .wasm als bundel-assets worden herkend
config.resolver.assetExts.push("db", "mp3", "ttf", "wasm");

module.exports = withNativeWind(config, { input: "./global.css" });
