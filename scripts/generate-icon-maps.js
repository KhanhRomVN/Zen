const fs = require('fs');
const path = require('path');

const FileNamePattern = {
  Ecmascript: 'ecmascript',
  Configuration: 'configuration',
  NodeEcosystem: 'nodeEcosystem',
  Cosmiconfig: 'cosmiconfig',
  Yaml: 'yaml',
  Dotfile: 'dotfile',
};

const mapPatterns = (patterns) => {
  const result = [];
  for (const [fileName, pattern] of Object.entries(patterns)) {
    switch (pattern) {
      case FileNamePattern.Ecmascript:
        result.push(
          `${fileName}.js`,
          `${fileName}.mjs`,
          `${fileName}.cjs`,
          `${fileName}.ts`,
          `${fileName}.mts`,
          `${fileName}.cts`
        );
        break;
      case FileNamePattern.Configuration:
        result.push(
          `${fileName}.json`,
          `${fileName}.jsonc`,
          `${fileName}.json5`,
          `${fileName}.yaml`,
          `${fileName}.yml`,
          `${fileName}.toml`
        );
        break;
      case FileNamePattern.NodeEcosystem:
        result.push(
          `${fileName}.js`,
          `${fileName}.mjs`,
          `${fileName}.cjs`,
          `${fileName}.ts`,
          `${fileName}.mts`,
          `${fileName}.cts`,
          `${fileName}.json`,
          `${fileName}.jsonc`,
          `${fileName}.json5`,
          `${fileName}.yaml`,
          `${fileName}.yml`,
          `${fileName}.toml`
        );
        break;
      case FileNamePattern.Cosmiconfig:
        result.push(
          `.${fileName}rc`,
          `.${fileName}rc.json`,
          `.${fileName}rc.jsonc`,
          `.${fileName}rc.json5`,
          `.${fileName}rc.yaml`,
          `.${fileName}rc.yml`,
          `.${fileName}rc.toml`,
          `.${fileName}rc.js`,
          `.${fileName}rc.mjs`,
          `.${fileName}rc.cjs`,
          `.${fileName}rc.ts`,
          `.${fileName}rc.mts`,
          `.${fileName}rc.cts`,
          `.config/${fileName}rc`,
          `.config/${fileName}rc.json`,
          `.config/${fileName}rc.jsonc`,
          `.config/${fileName}rc.json5`,
          `.config/${fileName}rc.yaml`,
          `.config/${fileName}rc.yml`,
          `.config/${fileName}rc.toml`,
          `.config/${fileName}rc.js`,
          `.config/${fileName}rc.mjs`,
          `.config/${fileName}rc.cjs`,
          `.config/${fileName}rc.ts`,
          `.config/${fileName}rc.mts`,
          `.config/${fileName}rc.cts`,
          `${fileName}.config.json`,
          `${fileName}.config.jsonc`,
          `${fileName}.config.json5`,
          `${fileName}.config.yaml`,
          `${fileName}.config.yml`,
          `${fileName}.config.toml`,
          `${fileName}.config.js`,
          `${fileName}.config.mjs`,
          `${fileName}.config.cjs`,
          `${fileName}.config.ts`,
          `${fileName}.config.mts`,
          `${fileName}.config.cts`
        );
        break;
      case FileNamePattern.Yaml:
        result.push(`${fileName}.yaml`, `${fileName}.yml`);
        break;
      case FileNamePattern.Dotfile:
        result.push(`.${fileName}`, fileName);
        break;
    }
  }
  return result;
};

// Simple TS file loader
function loadTsFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Strip imports
  content = content.replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, '');
  // Strip types from definitions
  content = content.replace(/export\s+const\s+(\w+)\s*:\s*[^=]+=/g, 'const $1 =');
  content = content.replace(/:[\w\[\]<>|{}]+/g, '');
  content = content.replace(/as\s+\w+(\[\])?/g, '');
  content = content.replace(/as\s+FolderIconClone/g, '');
  // Replace references
  content = content.replace(/IconPack\.\w+/g, '""');
  content = content.replace(/FileNamePattern\.\w+/g, (match) => `"${match.split('.')[1].charAt(0).toLowerCase() + match.split('.')[1].slice(1)}"`);
  // Remove parseByPattern call if any, just return the array
  content = content.replace(/parseByPattern\(([\s\S]*?)\)/, '$1');
  
  const tempPath = path.join(__dirname, 'temp-loader.js');
  fs.writeFileSync(tempPath, `
    const IconPack = { Angular: 'angular', Ngrx: 'ngrx', React: 'react', Redux: 'redux', Vue: 'vue', Vuex: 'vuex' };
    const FileNamePattern = { Ecmascript: 'ecmascript', Configuration: 'configuration', NodeEcosystem: 'nodeEcosystem', Cosmiconfig: 'cosmiconfig', Yaml: 'yaml', Dotfile: 'dotfile' };
    ${content}
    module.exports = { 
      fileIcons: typeof fileIcons !== 'undefined' ? fileIcons : undefined,
      folderIcons: typeof folderIcons !== 'undefined' ? folderIcons : undefined,
      languageIcons: typeof languageIcons !== 'undefined' ? languageIcons : undefined
    };
  `);
  
  const resolvedPath = require.resolve(tempPath);
  if (require.cache[resolvedPath]) {
    delete require.cache[resolvedPath];
  }
  
  const data = require(tempPath);
  fs.unlinkSync(tempPath);
  return data;
}

const themeSrcDir = path.join(__dirname, '../temp/vscode-material-icon-theme-5.35.0/src/core/icons');

const { fileIcons } = loadTsFile(path.join(themeSrcDir, 'fileIcons.ts'));
const { folderIcons } = loadTsFile(path.join(themeSrcDir, 'folderIcons.ts'));
const { languageIcons } = loadTsFile(path.join(themeSrcDir, 'languageIcons.ts'));

// Now process the loaded icons
const extensionsMap = {};
const fileNamesMap = {};

fileIcons.icons.forEach(icon => {
  const iconName = icon.name;
  
  // Handle patterns
  if (icon.patterns) {
    const patternedNames = mapPatterns(icon.patterns);
    patternedNames.forEach(name => {
      fileNamesMap[name.toLowerCase()] = iconName;
    });
  }

  // Handle fileNames
  if (icon.fileNames) {
    icon.fileNames.forEach(name => {
      fileNamesMap[name.toLowerCase()] = iconName;
    });
  }

  // Handle fileExtensions
  if (icon.fileExtensions) {
    icon.fileExtensions.forEach(ext => {
      extensionsMap[ext.toLowerCase()] = iconName;
    });
  }
});

// Process folder icons (using specific theme)
const folderNamesMap = {};
const specificTheme = folderIcons.find(theme => theme.name === 'specific');
if (specificTheme) {
  specificTheme.icons.forEach(icon => {
    const iconName = icon.name;
    if (icon.folderNames) {
      icon.folderNames.forEach(name => {
        folderNamesMap[name.toLowerCase()] = iconName;
      });
    }
  });
}

// Process language icons
const languagesMap = {};
languageIcons.forEach(icon => {
  const iconName = icon.name;
  if (icon.ids) {
    icon.ids.forEach(id => {
      languagesMap[id.toLowerCase()] = iconName;
    });
  }
});

// Output code
const outputContent = `/**
 * Pre-compiled icon mappings from vscode-material-icon-theme
 * Generated by scripts/generate-icon-maps.js
 */

export const fileNamesMap: Record<string, string> = ${JSON.stringify(fileNamesMap, null, 2)};

export const extensionsMap: Record<string, string> = ${JSON.stringify(extensionsMap, null, 2)};

export const folderNamesMap: Record<string, string> = ${JSON.stringify(folderNamesMap, null, 2)};

export const languagesMap: Record<string, string> = ${JSON.stringify(languagesMap, null, 2)};
`;

fs.writeFileSync(
  path.join(__dirname, '../src/webview-ui/src/utils/materialIconMaps.ts'),
  outputContent,
  'utf8'
);

console.log('Successfully generated materialIconMaps.ts!');
