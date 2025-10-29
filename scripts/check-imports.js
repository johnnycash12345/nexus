import fs from "fs";
import path from "path";

const projectRoot = "./src";
const foldersToIgnore = ['node_modules', 'dist', 'scripts'];

function findImports(code) {
  const regex = /from\s+['"]([^'"]+)['"]/g;
  const matches = [];
  let match;
  while ((match = regex.exec(code))) matches.push(match[1]);
  return matches;
}

function checkDir(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
        if (!foldersToIgnore.includes(item.name)) {
            checkDir(fullPath);
        }
    }
    else if (item.name.endsWith(".ts") || item.name.endsWith(".tsx")) {
      const code = fs.readFileSync(fullPath, "utf-8");
      const imports = findImports(code);
      for (const imp of imports) {
        if (imp.startsWith("../")) {
          console.error(`❌ Caminho relativo inválido detectado em ${fullPath}: '${imp}'. Use o alias '@/' em vez disso.`);
          process.exit(1);
        }
      }
    }
  }
}

function checkAliasConfig() {
  let viteConfigCorrect = false;
  let tsConfigCorrect = false;

  // Check vite.config.ts
  const viteConfigPath = path.resolve(process.cwd(), 'vite.config.ts');
  if (fs.existsSync(viteConfigPath)) {
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf-8');
    if (viteConfigContent.includes("'@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src')")) {
      viteConfigCorrect = true;
    }
  }

  // Check tsconfig.json
  const tsConfigPath = path.resolve(process.cwd(), 'tsconfig.json');
  if (fs.existsSync(tsConfigPath)) {
    try {
      const tsConfigContent = fs.readFileSync(tsConfigPath, 'utf-8');
      const tsConfig = JSON.parse(tsConfigContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''));
      if (tsConfig.compilerOptions?.baseUrl === '.' && tsConfig.compilerOptions?.paths?.['@/*']?.[0] === 'src/*') {
        tsConfigCorrect = true;
      }
    } catch (e) {
      // It's ok to fail parsing, the check will fail below.
    }
  }
  
  if (!viteConfigCorrect || !tsConfigCorrect) {
    console.error('❌ Alias “@” não configurado corretamente no projeto.');
    if (!viteConfigCorrect) console.error("   - Verifique `resolve.alias` em vite.config.ts.");
    if (!tsConfigCorrect) console.error('   - Verifique `baseUrl` e `paths` em tsconfig.json.');
    process.exit(1);
  }
}

console.log("🔍 Verificando configurações de alias...");
checkAliasConfig();
console.log("✅ Configurações de alias estão corretas.");


console.log("🔍 Verificando importações do Nexus...");
if (fs.existsSync(projectRoot)) {
    checkDir(projectRoot);
    console.log("✅ Nenhum erro de importação encontrado.");
} else {
    console.warn(`⚠️  Diretório do projeto '${projectRoot}' não encontrado. Pulando verificação de importações.`);
}