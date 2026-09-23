// Remove dados reais de alunos dos modelos .xlsx (LGPD) mantendo layout e fórmulas.
// Uso: node ferramentas/sanitizar-modelos.js
// - Planilha1 (contrato 2027) e Planilha3 (contrato de atividade extra) ficam só com o cabeçalho
// - valores em cache das fórmulas são apagados (o Excel recalcula ao abrir)
// - a tabela de textos (sharedStrings) é reconstruída só com o que ainda é usado
'use strict';
const fs = require('fs');
const path = require('path');
const { readZip, writeZip } = require('../app/lib/zip');

const MODELOS = [
  { arquivo: 'contrato-2027.xlsx', limpar: { Planilha1: 6 }, apagarCelulas: {} },
  { arquivo: 'contrato-atividade-extra.xlsx', limpar: { Planilha3: 1 }, apagarCelulas: { Planilha1: ['C10'] } },
];

function sanitizar(caminho, { limpar, apagarCelulas }) {
  const z = readZip(fs.readFileSync(caminho));
  const txt = (n) => z.get(n).toString('utf8');
  const wb = txt('xl/workbook.xml'), rels = txt('xl/_rels/workbook.xml.rels');
  const abas = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((m) => {
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((r) => r[0]).find((r) => r.includes(`Id="${m[2]}"`));
    return { nome: m[1], arq: 'xl/' + rel.match(/Target="([^"]+)"/)[1].replace(/^\/?xl\//, '') };
  });

  const ss = z.has('xl/sharedStrings.xml') ? [...txt('xl/sharedStrings.xml').matchAll(/<si>[\s\S]*?<\/si>/g)].map((m) => m[0]) : [];
  const usados = new Map(); // índice antigo -> novo
  const novos = [];

  for (const { nome, arq } of abas) {
    let x = txt(arq);
    if (limpar[nome] != null) {
      const ini = x.indexOf('<sheetData>') + '<sheetData>'.length, fim = x.indexOf('</sheetData>');
      const manter = [...x.slice(ini, fim).matchAll(/<row r="(\d+)"[\s\S]*?<\/row>|<row r="(\d+)"[^>]*\/>/g)].filter((r) => +(r[1] || r[2]) <= limpar[nome]).map((r) => r[0]).join('');
      x = x.slice(0, ini) + manter + x.slice(fim);
    }
    for (const ref of apagarCelulas[nome] || []) {
      x = x.replace(new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`), (m0, a) => `<c r="${ref}"${a.replace(/\s*t="\w+"/, '')}/>`);
    }
    // remove hiperlinks (costumam guardar e-mails de responsáveis: mailto:...)
    x = x.replace(/<hyperlinks>[\s\S]*?<\/hyperlinks>/g, '');
    const relsAba = arq.replace('worksheets/', 'worksheets/_rels/') + '.rels';
    if (z.has(relsAba)) z.set(relsAba, Buffer.from(txt(relsAba).replace(/<Relationship [^>]*relationships\/hyperlink"[^>]*\/>/g, ''), 'utf8'));
    // apaga o valor em cache de toda célula com fórmula
    x = x.replace(/(<c [^>]*?>)(<f[^>]*?(?:\/>|>[\s\S]*?<\/f>))<v>[\s\S]*?<\/v>/g, '$1$2');
    // remapeia textos compartilhados
    x = x.replace(/<c ([^>]*?)t="s"([^>]*)><v>(\d+)<\/v><\/c>/g, (m0, a, b, i) => {
      if (!usados.has(+i)) { usados.set(+i, novos.length); novos.push(ss[+i]); }
      return `<c ${a}t="s"${b}><v>${usados.get(+i)}</v></c>`;
    });
    z.set(arq, Buffer.from(x, 'utf8'));
  }
  if (z.has('xl/sharedStrings.xml')) {
    const cab = txt('xl/sharedStrings.xml').match(/^[\s\S]*?<sst\b[^>]*>/)[0].replace(/\s(count|uniqueCount)="\d+"/g, '').replace('<sst', `<sst count="${novos.length}" uniqueCount="${novos.length}"`);
    z.set('xl/sharedStrings.xml', Buffer.from(cab + novos.join('') + '</sst>', 'utf8'));
  }
  if (z.has('xl/calcChain.xml')) {
    z.delete('xl/calcChain.xml');
    z.set('xl/_rels/workbook.xml.rels', Buffer.from(txt('xl/_rels/workbook.xml.rels').replace(/<Relationship [^>]*calcChain[^>]*\/>/, ''), 'utf8'));
    z.set('[Content_Types].xml', Buffer.from(txt('[Content_Types].xml').replace(/<Override [^>]*calcChain[^>]*\/>/, ''), 'utf8'));
  }
  z.set('xl/workbook.xml', Buffer.from(txt('xl/workbook.xml').replace(/<calcPr([^>]*?)\/>/, (m0, a) => `<calcPr${a.replace(/\s*fullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`), 'utf8'));
  // remove miniaturas/metadados que podem conter prévia dos dados
  for (const n of [...z.keys()]) if (/^docProps\/thumbnail/.test(n)) z.delete(n);
  fs.writeFileSync(caminho, writeZip(z));
  return { abas: abas.map((a) => a.nome), textos: `${ss.length} → ${novos.length}` };
}

const pasta = path.join(__dirname, '..', 'app', 'modelos');
for (const m of MODELOS) {
  const arq = path.join(pasta, m.arquivo);
  if (!fs.existsSync(arq)) { console.log('não encontrado:', m.arquivo); continue; }
  console.log(m.arquivo, sanitizar(arq, m));
}
