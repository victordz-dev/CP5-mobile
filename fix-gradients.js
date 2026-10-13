const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname);
const writeChanges = process.argv.includes('--write');
const requestedPath = process.argv.find((argument) => !argument.startsWith('--') && argument !== process.argv[0] && argument !== process.argv[1]);
const targetRoot = path.resolve(projectRoot, requestedPath ?? 'src/app');

if (targetRoot !== projectRoot && !targetRoot.startsWith(`${projectRoot}${path.sep}`)) {
  throw new Error('O diretório deve estar dentro deste projeto.');
}

if (!fs.existsSync(targetRoot) || !fs.statSync(targetRoot).isDirectory()) {
  throw new Error(`Diretório não encontrado: ${targetRoot}`);
}

function removeLinearGradients(content) {
  return content
    .replace(/import\s+\{\s*LinearGradient\s*\}\s+from\s+['"]expo-linear-gradient['"];?\r?\n?/g, '')
    .replace(/<LinearGradient/g, '<View')
    .replace(/<\/LinearGradient>/g, '</View>')
    .replace(/\s+colors=\{[^}]+\}/g, '')
    .replace(/\s+start=\{[^}]+\}/g, '')
    .replace(/\s+end=\{[^}]+\}/g, '');
}

function processDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      processDirectory(fullPath);
      continue;
    }
    if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name)) {
      continue;
    }

    const current = fs.readFileSync(fullPath, 'utf8');
    if (!current.includes('LinearGradient')) {
      continue;
    }

    const updated = removeLinearGradients(current);
    const relativePath = path.relative(projectRoot, fullPath);
    if (writeChanges) {
      fs.writeFileSync(fullPath, updated, 'utf8');
      console.log(`Atualizado: ${relativePath}`);
    } else {
      console.log(`Seria atualizado: ${relativePath}`);
    }
  }
}

processDirectory(targetRoot);
if (!writeChanges) {
  console.log('Simulação concluída. Use --write para aplicar as alterações.');
}
