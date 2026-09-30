// 5.6.0 — "Importar boletim" do histórico escolar: lê o boletim do aluno em qualquer formato que a secretaria recebe
// (Excel, Word, PDF, foto ou papel escaneado) e devolve uma PROPOSTA de notas por disciplina e bimestre.
// Nada é gravado aqui: a tela mostra a proposta para a pessoa conferir antes de colocar no histórico.
//
// Como cada formato vira texto (sem bibliotecas e sem internet):
//   .xlsx/.csv  → lib/planilha.js          .docx → as tabelas do word/document.xml
//   .xls/.ods   → Excel da escola converte  .doc/.rtf/.odt → Word da escola converte (ler-boletim.ps1)
//   PDF, foto, escaneado → reconhecimento de texto que já vem no Windows (Windows.Media.Ocr, ler-boletim.ps1)
// Tudo vira a mesma coisa: linhas de células { t: texto, x: centro, x0/x1: começo e fim } — e daí em diante
// o boletim é interpretado do mesmo jeito, venha de onde vier.
// O arquivo só passa por uma pasta temporária, apagada no fim (LGPD: é dado de menor).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { readZip } = require('./zip');
const { lerPlanilha, decodeXml } = require('./planilha');
const { lerTextoPdf } = require('./pdf-texto');

const SCRIPT = path.join(__dirname, 'ler-boletim.ps1');
const erro = (msg) => Object.assign(new Error(msg), { status: 400 });
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const numBR = (n) => String(Number(n.toFixed(2))).replace('.', ',');

// ───────────── 1. Ler o arquivo ─────────────

function tipoDoArquivo(buf, nome) {
  const ext = (path.extname(nome || '').slice(1) || '').toLowerCase();
  const b = buf.subarray(0, 8);
  if (b.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (b[0] === 0x50 && b[1] === 0x4b) { // zip: .xlsx, .docx (ou .odt/.ods, que o Office converte)
    const z = readZip(buf);
    if (z.has('word/document.xml')) return 'docx';
    if (z.has('xl/workbook.xml')) return 'xlsx';
    if (ext === 'odt') return 'word';
    if (ext === 'ods') return 'excel';
    throw erro('Não reconheci este arquivo. Envie o boletim em PDF, Word, Excel ou como foto (JPG ou PNG).');
  }
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return /^xl/.test(ext) ? 'excel' : 'word'; // .doc/.xls antigos
  if (b.subarray(0, 5).toString('latin1') === '{\\rtf') return 'word';
  if ((b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50) || b.subarray(0, 2).toString('latin1') === 'BM'
    || b.subarray(0, 3).toString('latin1') === 'GIF' || ['II*\0', 'MM\0*'].includes(b.subarray(0, 4).toString('latin1'))
    || b.subarray(4, 8).toString('latin1') === 'ftyp') return 'imagem';
  if (ext === 'csv' || ext === 'txt') return 'csv';
  throw erro('Não reconheci este arquivo. Envie o boletim em PDF, Word, Excel ou como foto (JPG ou PNG).');
}

// Roda o ajudante do Windows numa pasta temporária que some no fim, aconteça o que acontecer
async function comPastaTemporaria(fn) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'iel-boletim-'));
  try { return await fn(pasta); } finally { fs.rmSync(pasta, { recursive: true, force: true }); }
}
function rodarAjudante(modo, entrada, saida, tempo = 120000) {
  if (process.platform !== 'win32') return Promise.reject(erro('Este tipo de arquivo só é lido no Windows. Envie em Excel (.xlsx) ou Word (.docx).'));
  return new Promise((ok, falhou) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-Modo', modo, '-Entrada', entrada, '-Saida', saida],
      { timeout: tempo, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (e, out, err) => {
        // O Word/Excel aberto por este pedido às vezes fica na memória mesmo depois de "Quit" (ou travou escondido):
        // fecha só ele — o número do processo ficou anotado pelo ajudante; um Office que a pessoa está usando nunca é tocado
        try { const pid = +fs.readFileSync(saida + '.pid', 'utf8'); if (pid > 0) process.kill(pid); } catch { /* não abriu Office ou já fechou */ }
        if (!e && fs.existsSync(saida)) return ok();
        const msg = String(err || e?.message || '');
        if (e && e.killed) return falhou(erro(modo === 'ocr' ? 'O arquivo demorou demais para ser lido. Tente uma foto mais nítida ou só a folha das notas.'
          : `O ${modo === 'word' ? 'Word' : 'Excel'} não respondeu. Abra o arquivo nele, use "Salvar como" ${modo === 'word' ? '.docx' : '.xlsx'} e envie de novo.`));
        if (/SEM_OCR/.test(msg)) return falhou(erro('Este computador não tem o reconhecimento de texto do Windows em português. Envie o boletim em Excel ou Word.'));
        if (modo === 'word') return falhou(erro('Não consegui abrir no Word. Abra o arquivo no Word, use "Salvar como" .docx e envie de novo.'));
        if (modo === 'excel') return falhou(erro('Não consegui abrir no Excel. Abra o arquivo no Excel, use "Salvar como" .xlsx e envie de novo.'));
        if (/HEIF|HEIC|0x88982F50|componente/i.test(msg)) return falhou(erro('Não consegui abrir esta foto. Tire de novo em JPG (ou mande pelo WhatsApp, que já converte) e envie.'));
        falhou(erro('Não consegui ler este arquivo. Se for foto, tire de novo com boa luz e o papel reto; se for PDF, confira se ele abre no computador.'));
      });
  });
}

// Planilha: cada linha vira uma linha; a coluna é a posição (A=0, B=1…)
function linhasDaPlanilha(abas) {
  const linhas = [];
  for (const aba of abas) for (const l of aba.linhas) {
    const cel = [];
    l.forEach((v, i) => {
      if (v == null || v === '' || typeof v === 'boolean') return;
      const t = typeof v === 'number' ? numBR(v) : String(v).trim();
      if (t) cel.push({ t, x: i, x0: i, x1: i });
    });
    if (cel.length) linhas.push(cel);
  }
  return { linhas, grade: true };
}

// Word (.docx): as tabelas viram linhas (com as células mescladas ocupando mais de uma coluna); o texto solto, uma célula só
function lerDocx(buf) {
  const z = readZip(buf);
  const xml = z.get('word/document.xml').toString('utf8');
  const textoDe = (x) => [...x.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((p) =>
    [...p[0].matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)].map((m) => (m[1] != null ? decodeXml(m[1]) : ' ')).join('')).join(' ').replace(/\s+/g, ' ').trim();
  const linhas = [];
  const corpo = (xml.match(/<w:body>([\s\S]*)<\/w:body>/) || [])[1] || xml;
  // Tabelas e parágrafos na ordem em que aparecem (tabela dentro de tabela é raro em boletim; vira texto da célula)
  for (const m of corpo.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g)) {
    if (m[0].startsWith('<w:tbl>')) {
      for (const tr of m[0].matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)) {
        let col = 0; const cel = [];
        for (const tc of tr[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)) {
          const span = +((tc[0].match(/<w:gridSpan w:val="(\d+)"/) || [])[1] || 1);
          const t = textoDe(tc[0]);
          if (t) cel.push({ t, x: col + (span - 1) / 2, x0: col, x1: col + span - 1 });
          col += span;
        }
        if (cel.length) linhas.push(cel);
      }
    } else {
      // Parágrafo com tabulações (boletim "desenhado" com Tab em vez de tabela): cada pedaço é uma coluna
      const pedacos = [...m[0].matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)].map((x) => (x[1] != null ? decodeXml(x[1]) : '\t')).join('')
        .split('\t').map((s) => s.trim());
      const cel = pedacos.map((t, i) => ({ t, x: i, x0: i, x1: i })).filter((c) => c.t);
      if (cel.length) linhas.push(cel);
    }
  }
  const imagens = [...z.keys()].filter((k) => /^word\/media\/.+\.(png|jpe?g|bmp|gif|tiff?)$/i.test(k));
  return { linhas, grade: true, imagens: imagens.map((k) => ({ nome: path.basename(k), buf: z.get(k) })) };
}

// Reconhecimento de texto: palavras soltas com posição → linhas e células.
// Palavras na mesma altura formam uma linha; um espaço bem maior que o normal entre palavras separa as colunas.
function linhasDoOcr(paginas) {
  const linhas = [];
  for (const pg of paginas || []) {
    // Folha torta na foto: o Windows já devolve as posições como se a folha estivesse reta (conferido com uma foto girada 2°)
    const ps = (pg.palavras || []).filter((p) => String(p.t || '').trim())
      .map((p) => ({ t: String(p.t).trim(), cx: p.x + p.w / 2, cy: p.y + p.h / 2, w: p.w, h: p.h, l: p.l }));
    if (!ps.length) continue;
    const alturas = ps.map((p) => p.h).sort((a, b) => a - b);
    const h = alturas[Math.floor(alturas.length / 2)] || 10;
    ps.sort((a, b) => a.cy - b.cy);
    const grupos = [];
    for (const p of ps) {
      const g = grupos[grupos.length - 1];
      if (g && Math.abs(p.cy - g.cy) < h * 0.6) { g.ps.push(p); g.cy = g.ps.reduce((s, q) => s + q.cy, 0) / g.ps.length; } else grupos.push({ cy: p.cy, ps: [p] });
    }
    for (const g of grupos) {
      g.ps.sort((a, b) => a.cx - b.cx);
      const cel = [];
      for (const p of g.ps) {
        const x0 = p.cx - p.w / 2, x1 = p.cx + p.w / 2;
        const ult = cel[cel.length - 1];
        // Mesma célula: pouco espaço entre as palavras e o Windows as leu na mesma linha de texto
        // No PDF cada pedaço tem o seu número: só junta com o vizinho se estiverem colados (letras espaçadas de um título).
        // No reconhecimento de imagem o número é a linha de texto do Windows: palavras próximas da mesma linha juntam.
        // Medido no boletim do ACADESC (escreve letra por letra): entre letras ~0, entre palavras ~0,28 da altura, entre colunas ≥ 0,44.
        const gap = x0 - (ult?.x1 ?? -1e9);
        if (ult && (gap < h * 0.36 || (gap < h * 0.9 && ult.l === p.l))) { ult.t += (gap < h * 0.12 ? '' : ' ') + p.t; ult.x1 = x1; } else cel.push({ t: p.t, x0, x1, l: p.l });
      }
      linhas.push(cel.map((c) => ({ t: c.t, x: (c.x0 + c.x1) / 2, x0: c.x0, x1: c.x1 })));
    }
  }
  return { linhas, grade: false };
}

async function lerOcr(buf, ext) {
  return comPastaTemporaria(async (pasta) => {
    const ent = path.join(pasta, 'boletim.' + ext), sai = path.join(pasta, 'saida.json');
    fs.writeFileSync(ent, buf);
    await rodarAjudante('ocr', ent, sai);
    const r = JSON.parse(fs.readFileSync(sai, 'utf8').replace(/^﻿/, ''));
    return { ...linhasDoOcr([].concat(r.paginas || [])), paginas: r.paginas_total || 1 };
  });
}
async function converterNoOffice(buf, modo, ext) {
  return comPastaTemporaria(async (pasta) => {
    const ent = path.join(pasta, 'boletim.' + ext), sai = path.join(pasta, modo === 'word' ? 'convertido.docx' : 'convertido.xlsx');
    fs.writeFileSync(ent, buf);
    await rodarAjudante(modo, ent, sai);
    return fs.readFileSync(sai);
  });
}

async function lerDocumento(buf, nome) {
  if (!buf || !buf.length) throw erro('O arquivo está vazio.');
  const tipo = tipoDoArquivo(buf, nome);
  const ext = (path.extname(nome || '').slice(1) || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (tipo === 'xlsx') return { origem: 'planilha do Excel', ocr: false, ...linhasDaPlanilha(lerPlanilha(buf, 'x.xlsx')) };
  if (tipo === 'csv') return { origem: 'planilha (CSV)', ocr: false, ...linhasDaPlanilha(lerPlanilha(buf, 'x.csv')) };
  if (tipo === 'excel') return { origem: 'planilha do Excel (formato antigo)', ocr: false, ...linhasDaPlanilha(lerPlanilha(await converterNoOffice(buf, 'excel', ext || 'xls'), 'x.xlsx')) };
  if (tipo === 'docx' || tipo === 'word') {
    const docx = tipo === 'docx' ? buf : await converterNoOffice(buf, 'word', ext || 'doc');
    const r = lerDocx(docx);
    // Word que só tem a foto do boletim colada dentro: lê a(s) imagem(ns)
    const temNotas = r.linhas.some((l) => l.filter((c) => lerNota(c.t) != null).length >= 2);
    if (!temNotas && r.imagens.length) {
      const partes = [];
      for (const im of r.imagens.slice(0, 4)) partes.push(...(await lerOcr(im.buf, path.extname(im.nome).slice(1))).linhas);
      return { origem: 'imagem dentro do Word (texto reconhecido)', ocr: true, linhas: partes, grade: false };
    }
    return { origem: tipo === 'docx' ? 'documento do Word' : 'documento do Word (formato antigo)', ocr: false, linhas: r.linhas, grade: true };
  }
  if (tipo === 'pdf') {
    // PDF gerado por sistema (o do ACADESC) tem o texto dentro: lê direto, sem adivinhar. Escaneado não tem: vai para a imagem.
    let t = null;
    try { t = lerTextoPdf(buf); } catch { t = null; }
    if (t) {
      const r = linhasDoOcr(t.paginas);
      if (r.linhas.some((l) => l.filter((c) => lerNota(c.t) != null).length >= 2)) return { origem: 'PDF', ocr: false, ...r, paginas: t.total };
    }
  }
  const r = await lerOcr(buf, tipo === 'pdf' ? 'pdf' : ext || 'png');
  return { origem: tipo === 'pdf' ? 'PDF (texto reconhecido)' : 'foto ou imagem (texto reconhecido)', ocr: true, ...r };
}

// ───────────── 2. Entender o boletim ─────────────

// Nota: 0 a 10 com vírgula ou ponto. O reconhecimento às vezes troca O por 0 e l/I por 1 — só corrige quando vira número.
function lerNota(t) {
  // "*5,0": o ACADESC marca com * a nota abaixo da média — a nota continua valendo
  let s = String(t ?? '').trim().replace(/\s+/g, '').replace(/^\*/, '');
  if (!s) return null;
  if (/\d/.test(s) && /^[\dOoIl|.,]+$/.test(s)) s = s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
  const m = s.match(/^(\d{1,2})(?:[.,](\d{1,2}))?$/);
  if (!m) return null;
  const n = Number(m[1] + '.' + (m[2] || '0'));
  if (n > 10) return null;
  return numBR(n);
}
// Conceito (A, B, MB, S…) só vale numa coluna que o cabeçalho diz que é de nota
const lerConceito = (t) => (/^(MB|B|R|I|S|NS|PS|A|C|D|E|O|P|NA|AP|EP|ED)$/.test(String(t || '').trim().toUpperCase()) ? String(t).trim().toUpperCase() : null);

// O que cada coluna do boletim é, pelo texto do cabeçalho
function papelDaColuna(rotulo) {
  const r = norm(rotulo).replace(/[º°ª]/g, '').replace(/[.:]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b([1-4])[0o]\s*(?=bim|b\b)/, '$1 '); // o reconhecimento de imagem lê "1º Bim" como "10 Bim" ou "1o Bim"
  if (!r) return null;
  if (/\bfalt|\bf\b|\bfa\b|ausenc|\bfreq/.test(r)) return 'faltas';
  if (/aulas?\s*dadas|\bad\b|\baulas\b/.test(r)) return 'aulas';
  if (/\brec\b|recup|\bexame\b|\bpf\b/.test(r)) return 'rec';
  const rom = { i: 1, ii: 2, iii: 3, iv: 4 };
  let m = r.match(/\b([1-4])\s*(?:o|a)?\s*(?:bim\w*|b)\b/) || r.match(/\bbim\w*\s*([1-4])\b/) || r.match(/\b(?:b|n|nota|av)\s*([1-4])\b/) || r.match(/^([1-4])\s*(?:o|a)?$/);
  if (m) return 'b' + m[1];
  m = r.match(/\b(i{1,3}|iv)\s*(?:bim\w*|b)\b/);
  if (m) return 'b' + rom[m[1]];
  if (/^(resultado|situacao)$/.test(r)) return 'resultado';
  if (/final|anual|\bmf\b|\bm\s*f\b|\bma\b|\bnf\b|\bm\s*a\b/.test(r)) return 'final';
  // "Méd." sozinha é a média do boletim até agora; só vira nota final se não houver uma coluna "M.F."/"Média Final"
  if (/\bmedia\b|\bmed\b/.test(r)) return 'media';
  if (/\bnota\b|\bn\b/.test(r)) return 'nota';
  return null;
}

// Semelhança entre o nome da disciplina no boletim e no histórico (abreviações comuns incluídas)
const APELIDOS = {
  lp: 'lingua portuguesa', l: 'lingua', ling: 'lingua', port: 'portugues', mat: 'matematica', ef: 'educacao fisica', edf: 'educacao fisica', ed: 'educacao',
  er: 'ensino religioso', cien: 'ciencias', cienc: 'ciencias', hist: 'historia', geo: 'geografia', geog: 'geografia', ing: 'ingles',
  lem: 'lingua estrangeira moderna', bio: 'biologia', biol: 'biologia', fis: 'fisica', qui: 'quimica', quim: 'quimica', filo: 'filosofia',
  fil: 'filosofia', soc: 'sociologia', socio: 'sociologia', red: 'redacao', esp: 'espanhol', aprof: 'aprofundamento', lit: 'literatura',
  artes: 'arte', religiao: 'ensino religioso', rel: 'religioso', est: 'estrangeira', estr: 'estrangeira', mod: 'moderna', educ: 'educacao', tec: 'tecnologia', pv: 'projeto vida', robotica: 'educacao tecnologica robotica',
};
const PARADAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'na', 'no']);
const tokens = (s) => norm(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean)
  .flatMap((t) => (APELIDOS[t] || t).split(' ')).filter((t) => !PARADAS.has(t));
// Mesma palavra: igual; abreviação curta ("geog" → "geografia"); ou mesma raiz ("biologia" ~ "biológicas", "inglês" ~ "inglesa").
// "lingua" NÃO é "linguagens" (senão "Língua Inglesa" cai em "Aprof. de Linguagens Inglês").
function mesmoToken(a, b) {
  if (a === b) return true;
  const [c, l] = a.length <= b.length ? [a, b] : [b, a];
  if (c.length >= 3 && c.length <= 5 && l.startsWith(c)) return true;
  let k = 0; while (k < c.length && c[k] === l[k]) k++;
  return k >= 4 && k >= 0.7 * l.length;
}
function semelhanca(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  if (ta.join(' ') === tb.join(' ')) return 1;
  const usados = new Set();
  let iguais = 0;
  for (const x of ta) { const j = tb.findIndex((y, k) => !usados.has(k) && mesmoToken(x, y)); if (j >= 0) { usados.add(j); iguais++; } }
  const dice = (2 * iguais) / (ta.length + tb.length);
  // Todas as palavras do nome mais curto aparecem no mais longo ("Espanhol" ↔ "Língua Est. Moderna – Espanhol")
  return iguais === Math.min(ta.length, tb.length) ? Math.max(dice, 0.6) : dice;
}
// Cada disciplina do histórico recebe no máximo uma linha do boletim: as mais parecidas primeiro
function casarDisciplinas(nomes, comps) {
  const pares = [];
  nomes.forEach((n, i) => comps.forEach((c) => { const s = semelhanca(n, c); if (s >= 0.5) pares.push({ i, c, s }); }));
  pares.sort((a, b) => b.s - a.s);
  const saida = nomes.map(() => null), usados = new Set();
  for (const p of pares) if (!saida[p.i] && !usados.has(p.c)) { saida[p.i] = { nome: p.c, certeza: Math.round(p.s * 100) }; usados.add(p.c); }
  return saida;
}

// Linha que é título, total ou resumo, não disciplina
const NAO_DISCIPLINA = /^(media|total|frequencia|faltas|resultado|situacao|aluno|nome|serie|turma|ano|curso|bimestre|disciplina|componente|materia|observ|assinatura|data|classe|mat\b|matricula|n[ºo°]?\b|legenda|conceito)/;
const ehTexto = (t) => /[a-zà-ú]{2,}/i.test(t) && lerNota(t) == null;

function descobrirSerie(txt) {
  const t = norm(txt).replace(/[º°ª]/g, ' ');
  // "E.F. 9 3ª A" (DescClasse do ACADESC; lido de imagem vira "3a A") e "Ens. Fund. 9 anos | 3º"
  let m = t.match(/\be\s*\.?\s*f\s*\.?\s*9\s+([1-9])[ao]?\b/) || t.match(/fund\w*\.?\s*9\s*anos\W+([1-9])[ao]?\b/);
  if (m) return 'F' + m[1];
  m = t.match(/\be\s*\.?\s*m\s*\.?\s*([1-3])[ao]?\b/) || t.match(/\b([1-3])\s*a?\s*(?:serie|ano)\s*(?:do\s*)?(?:ensino\s*)?medio/) || t.match(/ensino medio\W+([1-3])[ao]?\b/);
  if (m) return 'EM' + m[1];
  m = t.match(/\b([1-9])\s*o?\s*ano\b/);
  if (m) return 'F' + m[1];
  return null;
}
function descobrirAno(txt, anoMax) {
  const t = norm(txt);
  const m = t.match(/ano\s*letivo\s*:?\s*((?:19|20)\d\d)/) || t.match(/\bano\s*:?\s*((?:19|20)\d\d)/);
  if (m && +m[1] <= anoMax) return +m[1];
  const conta = new Map();
  for (const x of t.matchAll(/\b((?:19|20)\d\d)\b/g)) if (+x[1] >= 1990 && +x[1] <= anoMax) conta.set(+x[1], (conta.get(+x[1]) || 0) + 1);
  return [...conta.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] || null;
}
function nomeConfere(txt, nome) {
  const t = ' ' + norm(txt).replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const partes = norm(nome).replace(/[^a-z ]/g, ' ').split(' ').filter((p) => p.length >= 3 && !PARADAS.has(p));
  if (!partes.length || t.trim().length < 20) return null;
  const achou = partes.filter((p) => t.includes(' ' + p + ' ')).length;
  return partes.length === 1 ? achou === 1 : t.includes(' ' + partes[0] + ' ') && achou >= 2;
}

// Monta o mapa de colunas a partir de 1 a 3 linhas de cabeçalho ("1º Bimestre" em cima, "Nota | Faltas" embaixo;
// um título de duas linhas, como "Média Final" com a célula mesclada na vertical, pode estar em qualquer uma delas)
function mapaDeColunas(cabs, tol) {
  if (!cabs.length) return null;
  const baixo = cabs[cabs.length - 1], cimas = cabs.slice(0, -1).reverse(); // a de cima mais perto primeiro
  const cobre = (c, x) => x >= c.x0 - tol && x <= c.x1 + tol;
  const cima = cimas.flat();
  // A seção de cima de uma coluna: o título que a cobre ou, se nenhum cobre (título mais estreito que as colunas,
  // como "Faltas" em cima de "1° B 2° B 3° B 4° B Tot." no boletim do ACADESC), o título de centro mais perto
  // (primeiro quem cobre, em qualquer linha; só depois o mais perto — e não longe demais: até 3 larguras do título)
  const perto = (linha, x) => linha.filter((p) => Math.abs(p.x - x) <= 3 * Math.max(p.x1 - p.x0, tol))
    .reduce((m, p) => (!m || Math.abs(p.x - x) < Math.abs(m.x - x) ? p : m), null);
  const cols = baixo.map((c) => {
    let pai = null;
    for (const linha of cimas) { const p = linha.find((q) => cobre(q, c.x)); if (p && papelDaColuna(p.t)) { pai = p; break; } }
    if (!pai && !cima.some((q) => cobre(q, c.x))) for (const linha of cimas) { const p = perto(linha, c.x); if (p && papelDaColuna(p.t)) { pai = p; break; } }
    const proprio = papelDaColuna(c.t), doPai = pai ? papelDaColuna(pai.t) : null;
    let papel = proprio;
    // Embaixo de "Faltas": "1° B" é falta do 1º bimestre, não nota
    if (['faltas', 'aulas', 'rec'].includes(doPai)) papel = doPai;
    // Embaixo de "1º Bimestre": "Nota" ou "Média" é a nota daquele bimestre; "Faltas", "Aulas" e "Rec." continuam o que são.
    // Embaixo de "Resultado Final": "M.F." é a nota final
    else if (doPai && /^b\d$|^final$/.test(doPai) && !['faltas', 'aulas', 'rec', 'resultado'].includes(proprio) && !/^b\d$/.test(proprio || '')) papel = doPai;
    return { ...c, papel: papel === 'nota' ? null : papel, rotulo: [pai?.t, c.t].filter(Boolean).join(' ') };
  });
  for (const p of cima) if (!baixo.some((c) => cobre(p, c.x) || cobre(c, p.x))) cols.push({ ...p, papel: papelDaColuna(p.t), rotulo: p.t });
  return cols.some((c) => /^b\d$|^final$/.test(c.papel || '')) ? cols : null;
}

function interpretar(doc, compsPorCurso, { nome = '', anoMax = new Date().getFullYear() + 1 } = {}) {
  const linhas = doc.linhas || [];
  const txt = linhas.map((l) => l.map((c) => c.t).join('  ')).join('\n');
  const alturas = [];
  const tol = doc.grade ? 0.5 : (() => {
    for (const l of linhas) for (const c of l) alturas.push(c.x1 - c.x0);
    const larg = alturas.filter((w) => w > 0).sort((a, b) => a - b);
    return Math.max(8, (larg[Math.floor(larg.length / 4)] || 20) * 0.9);
  })();
  const todosComps = [...new Set(Object.values(compsPorCurso).flat())];
  const pareceDisciplina = (t) => ehTexto(t) && !NAO_DISCIPLINA.test(norm(t)) && todosComps.some((c) => semelhanca(t, c) >= 0.5);

  const achadas = [], zeradas = [];
  let cabs = [], mapa = null, usouCab = false;
  for (const l of linhas) {
    const nomeCel = l.find((c) => ehTexto(c.t));
    const valores = l.filter((c) => c !== nomeCel && (lerNota(c.t) != null || lerConceito(c.t)));
    const papeis = l.map((c) => papelDaColuna(c.t)).filter(Boolean);
    const ehCab = !valores.filter((c) => lerNota(c.t) != null).length && !l.some((c) => pareceDisciplina(c.t))
      && (papeis.length >= 2 || papeis.some((p) => /^b\d$|^final$|^media$/.test(p)));
    if (ehCab) { cabs = [...cabs.slice(-2), l]; mapa = mapaDeColunas(cabs, tol); continue; }
    const numeros = valores.filter((c) => lerNota(c.t) != null);
    // Linha de notas no meio da tabela cujo nome a leitura da imagem perdeu: entra sem nome, para a pessoa escolher a disciplina
    const semNome = !nomeCel && numeros.length >= 3 && (mapa || achadas.length);
    if (!semNome && (!nomeCel || !valores.length)) { if (!valores.length && !nomeCel) cabs = []; continue; }
    if (!semNome && !pareceDisciplina(nomeCel.t) && (numeros.length < 2 || NAO_DISCIPLINA.test(norm(nomeCel.t)))) continue;
    const r = { texto: semNome ? '(nome não lido — veja no papel)' : nomeCel.t.replace(/\s+/g, ' ').trim(), sem_nome: !!semNome, b1: '', b2: '', b3: '', b4: '', final: '' };
    let porCab = false;
    if (mapa) {
      let media = '';
      for (const c of valores) {
        const col = mapa.filter((m) => c.x >= m.x0 - tol && c.x <= m.x1 + tol).sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x))[0];
        const k = col?.papel;
        if (!k || !/^b\d$|^final$|^media$/.test(k) || (k === 'media' ? media : r[k])) continue;
        const v = lerNota(c.t) ?? lerConceito(c.t);
        if (v == null) continue;
        if (k === 'media') media = v; else r[k] = v;
        porCab = true;
      }
      if (!r.final && media) r.final = media;
    }
    if (!porCab) {
      // Sem cabeçalho que dê para entender: as 4 primeiras notas são os bimestres e a 5ª, a nota final
      const ns = numeros.map((c) => lerNota(c.t));
      ['b1', 'b2', 'b3', 'b4', 'final'].forEach((k, i) => { if (ns[i] != null) r[k] = ns[i]; });
    } else usouCab = true;
    const ks = ['b1', 'b2', 'b3', 'b4', 'final'].filter((k) => r[k]);
    // Eletiva que o aluno não fez: o ACADESC imprime "*0,0" em tudo. Fica de fora (senão viraria "Retido").
    if (ks.length && ks.every((k) => r[k] === '0')) { zeradas.push(r.texto); continue; }
    if (ks.length) achadas.push(r);
  }

  // Boletim do meio do ano (ex.: só 1º e 2º bimestres): a "média"/"M.F." dele é parcial e NÃO é a nota final do ano.
  // Entram só os bimestres; a nota final sai sozinha quando os 4 estiverem lançados.
  const ateBim = Math.max(0, ...achadas.map((r) => Math.max(0, ...[1, 2, 3, 4].filter((n) => r['b' + n]))));
  const emAndamento = ateBim > 0 && ateBim < 4;
  if (emAndamento) for (const r of achadas) r.final = '';
  const sugestoes = Object.fromEntries(Object.entries(compsPorCurso).map(([k, comps]) => [k, casarDisciplinas(achadas.map((r) => (r.sem_nome ? '' : r.texto)), comps)]));
  const avisos = [];
  const confere = nomeConfere(txt, nome);
  if (confere === false) avisos.push('O nome do aluno não aparece no documento. Confira se é o boletim certo.');
  if (doc.ocr) avisos.push('O texto foi reconhecido a partir da imagem: confira cada nota com o papel antes de colocar no histórico.');
  if (zeradas.length) avisos.push(`Ficaram de fora ${zeradas.length === 1 ? 'a disciplina' : 'as disciplinas'} com 0,0 em tudo (eletivas que o aluno não fez): ${zeradas.join(', ')}.`);
  if (emAndamento) avisos.push(`O boletim vai só até o ${ateBim}º bimestre (ano em andamento): entram as notas dos bimestres; a média do boletim é parcial e não foi usada como nota final.`);
  if (doc.paginas > 6) avisos.push(`O PDF tem ${doc.paginas} páginas; só as 6 primeiras foram lidas.`);
  if (achadas.length && !usouCab) avisos.push('Não achei o cabeçalho dos bimestres: as notas foram colocadas na ordem em que aparecem (1º, 2º, 3º, 4º bimestre e nota final).');
  if (!achadas.length) avisos.push(doc.ocr ? 'Não achei notas na imagem. Tire a foto de novo com boa luz, de cima e com o papel inteiro aparecendo.'
    : 'Não achei notas por disciplina neste arquivo. Confira se é mesmo o boletim.');
  return {
    origem: doc.origem, ocr: !!doc.ocr, serie: descobrirSerie(txt), ano_letivo: descobrirAno(txt, anoMax), nome_confere: confere,
    linhas: achadas.map((r, i) => ({ ...r, sugestao: Object.fromEntries(Object.keys(sugestoes).map((k) => [k, sugestoes[k][i]])) })), avisos,
  };
}

// ───────────── 3. Matriz curricular (5.6.1) ─────────────
// Lê o documento da matriz ("Matriz Curricular – Ensino Médio - 2026", "Matrizes Fund I e II 2026") e devolve as
// AULAS ANUAIS de cada disciplina em cada série — é o número que o histórico do Médio traz na coluna "Carga Horária".
// Cabeçalho: uma célula por série ("1ª Série", "6ºAno") e, na faixa de cada série, a coluna "Aulas Anuais" ou "C.H.".
// Um documento pode ter mais de uma tabela (Fund II e Fund I): cada cabeçalho novo recomeça o mapa.
function lerMatriz(doc, compsPorCurso) {
  const linhas = doc.linhas || [];
  const txt = linhas.map((l) => l.map((c) => c.t).join(' ')).join('\n');
  const serieDe = (t, medio) => {
    const r = norm(t).replace(/[º°ª]/g, ' ').replace(/\s+/g, ' ').trim();
    const m = r.match(/^([1-9])\s*(?:o|a)?\s*(ano|serie)$/);
    if (!m) return null;
    return m[2] === 'serie' || medio ? (+m[1] <= 3 ? 'EM' + m[1] : null) : 'F' + m[1];
  };
  const ehAnual = (t) => /aulas?\s*anua|^c\s*\.?\s*h\s*\.?$/.test(norm(t));
  const tol = doc.grade ? 0.5 : 8;
  let medio = false, ano = null, mapa = null, colNome = null, area = '';
  const saida = [];
  for (const l of linhas) {
    const t = l.map((c) => c.t).join(' ');
    // Título da tabela: diz o curso e o ano da matriz
    // (só o que vem depois de "Matriz Curricular": o timbre da escola cita "ENSINO MÉDIO" mesmo na matriz do Fundamental)
    const iMatriz = t.search(/matriz\s+curricular/i);
    if (iMatriz >= 0) { const tit = t.slice(iMatriz, iMatriz + 90); medio = /m[ée]dio/i.test(tit); const a = tit.match(/\b(20\d\d)\b/); if (a) ano = +a[1]; }
    const series = l.map((c) => ({ c, s: serieDe(c.t, medio) })).filter((x) => x.s);
    if (series.length >= 2) {
      // Cabeçalho: cada série e a faixa dela (até a próxima série)
      mapa = series.map((x, i) => ({ serie: x.s, x0: x.c.x0, x1: i + 1 < series.length ? series[i + 1].c.x0 - 0.01 : Infinity, col: null }));
      colNome = l.find((c) => /disciplina|componente/i.test(c.t)) || colNome;
      for (const c of l) if (ehAnual(c.t)) { const m = mapa.find((s) => c.x >= s.x0 && c.x <= s.x1); if (m && m.col == null) m.col = c.x; }
      continue;
    }
    if (mapa && mapa.some((s) => s.col == null) && l.some((c) => ehAnual(c.t))) {
      // Sub-cabeçalho (Médio): "Aulas Semanais | Aulas Anuais | Horas Anuais" embaixo de cada série
      for (const c of l) if (ehAnual(c.t)) { const m = mapa.find((s) => c.x >= s.x0 - tol && c.x <= s.x1); if (m && m.col == null) m.col = c.x; }
      if (!colNome) colNome = l.find((c) => /disciplina|componente/i.test(c.t));
      continue;
    }
    if (!mapa || !mapa.some((s) => s.col != null)) continue;
    // Linha de disciplina: o nome fica na coluna "Disciplina/Componente"; a área, quando vem, fica antes dela
    const nomeCel = colNome ? l.find((c) => c.x0 <= colNome.x + tol && c.x1 >= colNome.x - tol && ehTexto(c.t)) : l.find((c) => ehTexto(c.t));
    if (!nomeCel) { const a = l.find((c) => ehTexto(c.t)); if (a && l.length === 1) area = a.t; continue; }
    const antes = l.find((c) => c !== nomeCel && c.x1 < nomeCel.x0 && ehTexto(c.t));
    if (antes) area = antes.t;
    if (/^(total|carga|dura|parecer|data)/i.test(norm(nomeCel.t))) continue;
    const aulas = {};
    for (const s of mapa) {
      if (s.col == null) continue;
      const cel = l.find((c) => s.col >= c.x0 - tol && s.col <= c.x1 + tol && c !== nomeCel);
      const n = cel ? Number(String(cel.t).replace(/[^\d]/g, '')) : NaN;
      if (cel && /^\s*\d{1,4}\s*$/.test(cel.t) && n > 0 && n <= 2000) aulas[s.serie] = n;
    }
    if (Object.keys(aulas).length) saida.push({ texto: nomeCel.t.replace(/\s+/g, ' ').trim(), area: area.replace(/\s+/g, ' ').trim(), aulas });
  }
  const cursoDa = (s) => (s.startsWith('EM') ? 'medio' : 'fund');
  // Aqui cada linha procura a sua disciplina sozinha: a mesma disciplina aparece nas tabelas do Fund I e do Fund II
  const melhor = (nome, comps) => comps.map((c) => ({ nome: c, certeza: Math.round(semelhanca(nome, c) * 100) })).filter((x) => x.certeza >= 50)
    .sort((a, b) => b.certeza - a.certeza)[0] || null;
  const series = [...new Set(saida.flatMap((r) => Object.keys(r.aulas)))].sort((a, b) => (a.startsWith('EM') - b.startsWith('EM')) || +a.replace(/\D/g, '') - +b.replace(/\D/g, ''));
  return {
    origem: doc.origem, ano: ano || descobrirAno(txt, new Date().getFullYear() + 1), series,
    linhas: saida.map((r) => ({ ...r, curso: cursoDa(Object.keys(r.aulas)[0]), sugestao: melhor(r.texto, compsPorCurso[cursoDa(Object.keys(r.aulas)[0])] || []) })),
    avisos: saida.length ? [] : ['Não achei a tabela da matriz (as séries no cabeçalho e a coluna "Aulas Anuais" ou "C.H."). Confira se é o documento da matriz curricular.'],
  };
}

module.exports = { lerDocumento, interpretar, lerMatriz, lerNota, papelDaColuna, semelhanca, linhasDoOcr };
