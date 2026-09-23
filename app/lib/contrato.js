// Gera o contrato 2027 a partir do modelo "CONTRATO EDUCACIONAL 2027 preenchimento auto.xlsx".
// O modelo busca os dados com PROCV na aba Planilha1 usando a matrícula digitada em BF2.
// Aqui a Planilha1 passa a conter SOMENTE o aluno do contrato (nada de dados de outros alunos no arquivo).
'use strict';
const fs = require('fs');
const path = require('path');
const { readZip, writeZip } = require('./zip');
const { isoParaSerial } = require('./planilha');

const MODELO = path.join(__dirname, '..', 'modelos', 'contrato-2027.xlsx');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function colNum(letras) { let n = 0; for (const ch of letras) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
function colLetras(n) { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }

// vazioComoTexto: grava "" em vez de célula vazia (o PROCV devolve "" em vez de 0)
function celula(ref, valor, estilo, vazioComoTexto) {
  const s = estilo ? ` s="${estilo}"` : '';
  if ((valor == null || valor === '') && vazioComoTexto) return `<c r="${ref}"${s} t="inlineStr"><is><t></t></is></c>`;
  if (valor == null || valor === '') return `<c r="${ref}"${s}/>`;
  if (typeof valor === 'number') return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(valor)}</t></is></c>`;
}

// Define o valor de uma célula já existente (mantém o estilo) ou a insere na linha, na ordem certa.
function definirCelula(xml, ref, valor) {
  const [, letras, linha] = ref.match(/^([A-Z]+)(\d+)$/);
  const reCel = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  const m = xml.match(reCel);
  if (m) {
    if (/<f[\s>]/.test(m[0])) return xml; // nunca sobrescreve fórmula
    const estilo = (m[1].match(/s="(\d+)"/) || [])[1];
    return xml.replace(reCel, celula(ref, valor, estilo));
  }
  const reLinha = new RegExp(`(<row r="${linha}"[^>]*?)(/>|>([\\s\\S]*?)</row>)`);
  const ml = xml.match(reLinha);
  if (!ml) return xml;
  const alvo = colNum(letras);
  const conteudo = ml[3] || '';
  const cels = [...conteudo.matchAll(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)];
  let novo = conteudo, feito = false;
  for (const c of cels) {
    if (colNum(c[1]) > alvo) { novo = conteudo.replace(c[0], celula(ref, valor) + c[0]); feito = true; break; }
  }
  if (!feito) novo = conteudo + celula(ref, valor);
  return xml.replace(reLinha, `${ml[1]}>${novo}</row>`);
}

function gerarContrato(aluno, destino) {
  if (!fs.existsSync(MODELO)) throw new Error('Modelo do contrato não encontrado em app/modelos/contrato-2027.xlsx');
  const z = readZip(fs.readFileSync(MODELO));
  const txt = (n) => z.get(n).toString('utf8');

  // Descobre qual arquivo é cada aba
  const wb = txt('xl/workbook.xml');
  const rels = txt('xl/_rels/workbook.xml.rels');
  const alvoDe = (nomeAba) => {
    const rid = (wb.match(new RegExp(`<sheet [^>]*name="${nomeAba}"[^>]*r:id="([^"]+)"`)) || [])[1];
    const t = (rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`)) || [])[1];
    return t ? 'xl/' + t.replace(/^\/?xl\//, '') : null;
  };
  const abaContrato = alvoDe('Contrato Educacional 2026') || 'xl/worksheets/sheet1.xml';
  const abaDados = alvoDe('Planilha1') || 'xl/worksheets/sheet2.xml';

  // 1) Planilha1: mantém cabeçalho (linhas 1 a 6) e coloca só este aluno na linha 7
  let dados = txt(abaDados);
  const ini = dados.indexOf('<sheetData>') + '<sheetData>'.length;
  const fim = dados.indexOf('</sheetData>');
  const cab = [...dados.slice(ini, fim).matchAll(/<row r="(\d+)"[\s\S]*?<\/row>/g)].filter((r) => +r[1] <= 6).map((r) => r[0]).join('');
  const v = [
    aluno.mat ? Number(aluno.mat) || aluno.mat : '', aluno.nome, aluno.telefone, destino.ano,
    destino.descricao, destino.serie, aluno.turma, aluno.turno, null,
    aluno.filho_funcionario ? 'SIM' : 'NÃO', '', aluno.nome_mae, aluno.nome_pai, aluno.nome_resp || aluno.nome_pai || aluno.nome_mae,
    aluno.email, aluno.email_mae, aluno.email_pai, '', aluno.tel_mae, aluno.cel_mae, '', aluno.tel_pai, aluno.cel_pai,
    isoParaSerial(aluno.dt_nasc), aluno.nis, '', aluno.cpf, '',
  ];
  let linha7 = '<row r="7">';
  v.forEach((val, i) => {
    const ref = colLetras(i + 1) + '7';
    if (i === 8) linha7 += `<c r="${ref}" t="str"><f>E7&amp;" - "&amp;F7</f><v>${esc(destino.descricao + ' - ' + destino.serie)}</v></c>`;
    else linha7 += celula(ref, val, null, true);
  });
  linha7 += '</row>';
  dados = dados.slice(0, ini) + cab + linha7 + dados.slice(fim);
  dados = dados.replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:AB7"/>');
  z.set(abaDados, Buffer.from(dados, 'utf8'));

  // 2) Contrato: matrícula em BF2 (dispara os PROCV) + campos que o app conhece
  let c = txt(abaContrato);
  c = definirCelula(c, 'BF2', Number(aluno.mat) || aluno.mat);
  c = definirCelula(c, 'B31', aluno.nome_mae || '');
  c = definirCelula(c, 'AH31', aluno.email_mae || '');
  // Endereço e documentos do responsável (vêm da exportação de responsáveis do ACADESC)
  c = definirCelula(c, 'B27', aluno.endereco || '');
  c = definirCelula(c, 'AR27', aluno.cep || '');
  c = definirCelula(c, 'B29', aluno.bairro || '');
  c = definirCelula(c, 'AC29', aluno.cidade || '');
  c = definirCelula(c, 'B41', aluno.cpf_resp || '');
  c = definirCelula(c, 'Q41', aluno.rg_resp || '');
  z.set(abaContrato, Buffer.from(c, 'utf8'));

  // 3) Força o Excel a recalcular tudo ao abrir e remove a cadeia de cálculo antiga
  let w = wb.replace(/<calcPr([^>]*?)\/>/, (m0, a) => `<calcPr${a.replace(/\s*fullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`);
  z.set('xl/workbook.xml', Buffer.from(w, 'utf8'));
  if (z.has('xl/calcChain.xml')) {
    z.delete('xl/calcChain.xml');
    z.set('xl/_rels/workbook.xml.rels', Buffer.from(rels.replace(/<Relationship [^>]*calcChain[^>]*\/>/, ''), 'utf8'));
    const ct = z.get('[Content_Types].xml').toString('utf8').replace(/<Override [^>]*calcChain[^>]*\/>/, '');
    z.set('[Content_Types].xml', Buffer.from(ct, 'utf8'));
  }
  return writeZip(z);
}

// Utilitários para outros modelos .xlsx
function abrirModelo(arquivo) {
  if (!fs.existsSync(arquivo)) throw new Error('Modelo não encontrado: ' + path.basename(arquivo));
  const z = readZip(fs.readFileSync(arquivo));
  const txt = (n) => z.get(n).toString('utf8');
  const wb = txt('xl/workbook.xml');
  const rels = txt('xl/_rels/workbook.xml.rels');
  const aba = (nome) => {
    const rid = (wb.match(new RegExp(`<sheet [^>]*name="${nome}"[^>]*r:id="([^"]+)"`)) || [])[1];
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${rid}"`));
    const t = rel && (rel.match(/Target="([^"]+)"/) || [])[1];
    if (!t) throw new Error(`Aba "${nome}" não encontrada no modelo`);
    return 'xl/' + t.replace(/^\/?xl\//, '');
  };
  const finalizar = () => {
    z.set('xl/workbook.xml', Buffer.from(txt('xl/workbook.xml').replace(/<calcPr([^>]*?)\/>/, (m0, a) => `<calcPr${a.replace(/\s*fullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`), 'utf8'));
    if (z.has('xl/calcChain.xml')) {
      z.delete('xl/calcChain.xml');
      z.set('xl/_rels/workbook.xml.rels', Buffer.from(txt('xl/_rels/workbook.xml.rels').replace(/<Relationship [^>]*calcChain[^>]*\/>/, ''), 'utf8'));
      z.set('[Content_Types].xml', Buffer.from(txt('[Content_Types].xml').replace(/<Override [^>]*calcChain[^>]*\/>/, ''), 'utf8'));
    }
    return writeZip(z);
  };
  // Troca o conteúdo da aba por: linhas de cabeçalho mantidas + linhas novas
  const substituirLinhas = (arq, manterAte, novasLinhasXml, ultimaCol) => {
    let x = txt(arq);
    const ini = x.indexOf('<sheetData>') + '<sheetData>'.length;
    const fim = x.indexOf('</sheetData>');
    const cab = [...x.slice(ini, fim).matchAll(/<row r="(\d+)"[\s\S]*?<\/row>/g)].filter((r) => +r[1] <= manterAte).map((r) => r[0]).join('');
    x = x.slice(0, ini) + cab + novasLinhasXml + x.slice(fim);
    const ultima = manterAte + (novasLinhasXml.match(/<row /g) || []).length;
    x = x.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${ultimaCol}${ultima}"/>`);
    z.set(arq, Buffer.from(x, 'utf8'));
  };
  return { z, txt, aba, finalizar, substituirLinhas };
}

function linhaXml(numero, valores) {
  return `<row r="${numero}">` + valores.map((v, i) => celula(colLetras(i + 1) + numero, v, null, true)).join('') + '</row>';
}

module.exports = { gerarContrato, definirCelula, abrirModelo, linhaXml, celula, colLetras };
