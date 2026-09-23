// Lê planilhas .xlsx e .csv (exportações do ACADESC, SIG etc.) e converte em linhas.
'use strict';
const { readZip } = require('./zip');

const decodeXml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

const textOf = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => decodeXml(m[1])).join('');

function colIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function lerXlsx(buf) {
  const z = readZip(buf);
  const get = (n) => (z.has(n) ? z.get(n).toString('utf8') : '');
  const shared = [...get('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const wb = get('xl/workbook.xml');
  const rels = get('xl/_rels/workbook.xml.rels');
  const alvo = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = (m[0].match(/Id="([^"]+)"/) || [])[1];
    const t = (m[0].match(/Target="([^"]+)"/) || [])[1];
    if (id && t) alvo[id] = t.replace(/^\/?xl\//, '');
  }
  const abas = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const nome = decodeXml((m[0].match(/name="([^"]*)"/) || [])[1] || '');
    const rid = (m[0].match(/r:id="([^"]+)"/) || [])[1];
    const xml = get('xl/' + alvo[rid]);
    const linhas = [];
    for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rn = +((r[0].match(/\br="(\d+)"/) || [])[1] || linhas.length + 1);
      const linha = [];
      for (const c of (r[1] || '').matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const tipo = (c[2].match(/t="(\w+)"/) || [])[1];
        const corpo = c[3] || '';
        let v = (corpo.match(/<v>([^<]*)<\/v>/) || [])[1];
        if (tipo === 's') v = shared[+v];
        else if (tipo === 'inlineStr') v = textOf(corpo);
        else if (tipo === 'str' || tipo === 'e') v = v == null ? '' : decodeXml(v);
        else if (tipo === 'b') v = v === '1';
        else if (v != null && v !== '') v = Number(v);
        if (v != null) linha[colIndex(c[1] + '1')] = v;
      }
      linhas[rn - 1] = linha;
    }
    abas.push({ nome, linhas: Array.from(linhas, (l) => l || []) });
  }
  return abas;
}

function lerCsv(buf) {
  let txt = buf.toString('utf8');
  if (txt.includes('�')) txt = buf.toString('latin1'); // Excel costuma salvar CSV em ANSI
  txt = txt.replace(/^﻿/, '');
  const primeira = txt.split(/\r?\n/, 1)[0];
  const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas = [];
  let linha = [], campo = '', aspas = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (aspas) {
      if (ch === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && txt[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return [{ nome: 'CSV', linhas }];
}

function lerPlanilha(buf, nomeArquivo) {
  if (/\.csv$/i.test(nomeArquivo)) return lerCsv(buf);
  if (/\.xls$/i.test(nomeArquivo)) throw new Error('Arquivo .xls antigo: abra no Excel e use "Salvar como" .xlsx');
  return lerXlsx(buf);
}

// Número de série do Excel <-> data ISO
function serialParaIso(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const iso = String(v).match(/^\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : null;
}

function isoParaSerial(iso) {
  if (!iso) return null;
  return Math.round((Date.parse(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000);
}

module.exports = { lerPlanilha, serialParaIso, isoParaSerial, decodeXml };
