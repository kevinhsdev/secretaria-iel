// Localiza a foto do aluno pela matrícula nas pastas configuradas.
// Aceita "2083.jpg" (pasta "fotos alunos") e "AcaDescMySql.exe002083.jpeg" (pasta do ACADESC).
'use strict';
const fs = require('fs');
const path = require('path');

let cache = { chave: '', quando: 0, mapa: new Map() };

function indexar(pastas) {
  const chave = pastas.join('|');
  if (cache.chave === chave && Date.now() - cache.quando < 120_000) return cache.mapa;
  const mapa = new Map(); // matrícula -> { arquivo, mtime }
  const visitar = (dir, nivel) => {
    let itens = [];
    try { itens = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const it of itens) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) { if (nivel < 3) visitar(p, nivel + 1); continue; }
      const m = it.name.match(/^(?:AcaDescMySql\.exe)?0*(\d{1,6})\.(jpe?g|png)$/i);
      if (!m) continue;
      let mtime = 0;
      try { mtime = fs.statSync(p).mtimeMs; } catch { continue; }
      const atual = mapa.get(m[1]);
      if (!atual || mtime > atual.mtime) mapa.set(m[1], { arquivo: p, mtime }); // a mais recente vence
    }
  };
  for (const p of pastas) if (p) visitar(p, 0);
  cache = { chave, quando: Date.now(), mapa };
  return mapa;
}

function fotoDe(pastasTexto, mat) {
  if (!mat) return null;
  const pastas = String(pastasTexto || '').split(';').map((s) => s.trim()).filter(Boolean);
  return indexar(pastas).get(String(Number(mat))) || null;
}

module.exports = { fotoDe };
