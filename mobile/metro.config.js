const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Zorg dat .db (voor surayt.db) en .mp3 als bundel-assets worden herkend
config.resolver.assetExts.push("db", "mp3", "ttf");

module.exports = withNativeWind(config, { input: "./global.css" });
