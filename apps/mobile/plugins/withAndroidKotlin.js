const { withProjectBuildGradle } = require('expo/config-plugins');

module.exports = function withAndroidKotlin(config) {
  return withProjectBuildGradle(config, (mod) => {
    // Expo 52 declares Kotlin 1.9.25; RN 0.76.6 otherwise supplies 1.9.24
    // through its unversioned classpath, which conflicts with Compose 1.5.15.
    mod.modResults.contents = mod.modResults.contents.replace(
      "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
      () => 'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")'
    );
    return mod;
  });
};
