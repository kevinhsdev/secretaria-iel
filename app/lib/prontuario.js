// Varre a pasta de prontuários (ex.: Desktop\Contratos\<turma>\<aluno>\*.pdf)
// e descobre quais PDFs padronizados (nomes do PDF Renamer) cada aluno já tem.
'use strict';
const fs = require('fs');
const path = require('path');
const { norm } = require('./series');

let cache = { pasta: null, quando: 0, indice: new Map() };

function indexar(pasta) {
  const agora = Date.now();
  if (cache.pasta === pasta && agora - cache.quando < 60_000) return cache.indice;
  const indice = new Map(); // nome normalizado do aluno -> [{ pasta, arquivos[] }]
  let turmas = [];
  try { turmas = fs.readdirSync(pasta, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { turmas = []; }
  for (const t of turmas) {
    const dirTurma = path.join(pasta, t.name);
    let alunos = [];
    try { alunos = fs.readdirSync(dirTurma, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { continue; }
    for (const a of alunos) {
      const dir = path.join(dirTurma, a.name);
      let arquivos = [];
      try { arquivos = fs.readdirSync(dir).filter((f) => /\.pdf$/i.test(f)); } catch { /* sem acesso */ }
      const chave = norm(a.name);
      if (!indice.has(chave)) indice.set(chave, []);
      indice.get(chave).push({ turma: t.name, pasta: dir, arquivos });
    }
  }
  cache = { pasta, quando: agora, indice };
  return indice;
}

function doAluno(pasta, nome) {
  return indexar(pasta).get(norm(nome)) || [];
}

// O arquivo padrão (ex.: "CONTRATO EDUCACIONAL {ano}") existe em alguma pasta do aluno?
function temArquivo(pastas, padrao, ano) {
  if (!padrao) return false;
  const alvo = norm(padrao.replace('{ano}', ano));
  return pastas.some((p) => p.arquivos.some((f) => norm(f.replace(/\.pdf$/i, '')).startsWith(alvo)));
}

function limparCache() { cache.quando = 0; }

module.exports = { doAluno, temArquivo, limparCache };
