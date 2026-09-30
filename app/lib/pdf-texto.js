// 5.6.0 — Tira o texto de um PDF gerado por sistema (boletim do ACADESC, por exemplo), com a posição de cada pedaço.
// Sem bibliotecas: lê os objetos do PDF, abre os fluxos compactados (zlib), entende as fontes (ToUnicode, WinAnsi)
// e acompanha os comandos de texto (Tm, Td, Tj, TJ…). O resultado tem o mesmo formato do reconhecimento de imagem
// do Windows ({ t, x, y, w, h, l }), para o boletim ser interpretado do mesmo jeito venha de onde vier.
// PDF escaneado (só imagem) não tem texto: aí quem lê é o reconhecimento de imagem (ler-boletim.ps1).
'use strict';
const zlib = require('zlib');

// ── Objetos ──
function lerObjetos(buf) {
  const s = buf.toString('latin1');
  const objs = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(s))) {
    const ini = re.lastIndex;
    const fim = s.indexOf('endobj', ini);
    if (fim < 0) break;
    let corpo = s.slice(ini, fim), fluxo = null;
    const st = corpo.search(/\bstream\r?\n/);
    if (st >= 0) {
      const dIni = ini + st + corpo.slice(st).match(/^stream\r?\n/)[0].length;
      let dFim = s.indexOf('endstream', dIni);
      if (dFim < 0) dFim = fim;
      fluxo = buf.subarray(dIni, dFim);
      corpo = corpo.slice(0, st);
    }
    objs.set(+m[1], { dic: corpo, fluxo });
    re.lastIndex = fim + 6;
  }
  // Objetos guardados dentro de "object streams" (PDF 1.5+)
  for (const o of [...objs.values()]) {
    if (!/\/Type\s*\/ObjStm/.test(o.dic)) continue;
    const dados = abrirFluxo(o, objs);
    if (!dados) continue;
    const txt = dados.toString('latin1');
    const n = +(o.dic.match(/\/N\s+(\d+)/) || [])[1], primeiro = +(o.dic.match(/\/First\s+(\d+)/) || [])[1];
    const nums = txt.slice(0, primeiro).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++) {
      const num = nums[2 * i], off = primeiro + nums[2 * i + 1], prox = i + 1 < n ? primeiro + nums[2 * i + 3] : txt.length;
      if (!objs.has(num)) objs.set(num, { dic: txt.slice(off, prox), fluxo: null });
    }
  }
  return objs;
}
function abrirFluxo(o, objs) {
  if (!o || !o.fluxo) return null;
  let dados = Buffer.from(o.fluxo);
  let tam = o.dic.match(/\/Length\s+(\d+)(\s+\d+\s+R)?/);
  if (tam) { const t = tam[2] ? +(objs.get(+tam[1])?.dic.trim() || NaN) : +tam[1]; if (t > 0 && t <= dados.length) dados = dados.subarray(0, t); }
  const filtros = [...(o.dic.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/) || [, ''])[1].matchAll(/\/(\w+)/g)].map((x) => x[1]);
  for (const f of filtros) {
    if (f === 'FlateDecode' || f === 'Fl') {
      try { dados = zlib.inflateSync(dados, { finishFlush: zlib.constants.Z_SYNC_FLUSH }); } catch { try { dados = zlib.inflateRawSync(dados.subarray(2), { finishFlush: zlib.constants.Z_SYNC_FLUSH }); } catch { return null; } }
    } else return null; // imagem (DCT etc.): não é texto
  }
  return dados;
}
const ref = (txt, chave) => { const m = String(txt || '').match(new RegExp('/' + chave + '\\s+(\\d+)\\s+\\d+\\s+R')); return m ? +m[1] : null; };
// Valor de uma chave que pode vir direto (<< … >> ou [ … ]) ou como referência "12 0 R"
function valor(txt, chave, objs) {
  const i = String(txt || '').search(new RegExp('/' + chave + '(?![A-Za-z])'));
  if (i < 0) return null;
  let resto = txt.slice(i + chave.length + 1).trimStart();
  const r = resto.match(/^(\d+)\s+\d+\s+R/);
  if (r) return objs.get(+r[1])?.dic ?? null;
  const abre = resto.startsWith('<<') ? ['<<', '>>'] : resto.startsWith('[') ? ['[', ']'] : null;
  if (!abre) return (resto.match(/^[^\s/>\]]+|^\/\w+/) || [''])[0];
  let prof = 0;
  for (let k = 0; k < resto.length; k++) {
    if (resto.startsWith(abre[0], k)) { prof++; k += abre[0].length - 1; } else if (resto.startsWith(abre[1], k)) { prof--; k += abre[1].length - 1; if (!prof) return resto.slice(0, k + 1); }
  }
  return resto;
}

// ── Fontes: código → texto e largura ──
const WIN = { 128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰', 138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•', 150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ' };
const hexTxt = (h) => { let s = ''; for (let i = 0; i + 3 < h.length + 0; i += 4) s += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); return s; };
function lerCMap(txt) {
  const mapa = new Map();
  let bytes = 1;
  const cs = txt.match(/begincodespacerange\s*<([0-9a-fA-F]+)>/);
  if (cs) bytes = cs[1].length / 2;
  for (const b of txt.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const x of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) mapa.set(parseInt(x[1], 16), hexTxt(x[2].padStart(4, '0')));
  for (const b of txt.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const x of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]+)>|\[([^\]]*)\])/g)) {
      const a = parseInt(x[1], 16), z = parseInt(x[2], 16);
      if (x[4] != null) { const base = parseInt(x[4], 16); for (let c = a; c <= z && c - a < 5000; c++) mapa.set(c, String.fromCodePoint(base + c - a)); } else {
        [...x[5].matchAll(/<([0-9a-fA-F]+)>/g)].forEach((h, i) => mapa.set(a + i, hexTxt(h[1])));
      }
    }
  }
  return { mapa, bytes };
}
function lerFonte(dic, objs) {
  const f = { bytes: 1, mapa: null, larguras: new Map(), padrao: 500 };
  const tu = ref(dic, 'ToUnicode');
  if (tu) { const d = abrirFluxo(objs.get(tu), objs); if (d) Object.assign(f, lerCMap(d.toString('latin1'))); }
  if (/\/Subtype\s*\/Type0/.test(dic)) {
    f.bytes = 2;
    // DescendantFonts pode ser "[ 12 0 R ]" ou a fonte escrita ali mesmo "[ << … >> ]" (é assim no PDF do ACADESC).
    // No segundo caso, as referências lá dentro (Ordering 4 0 R…) NÃO são a fonte.
    const desc = valor(dic, 'DescendantFonts', objs) || '';
    const dRef = desc.match(/^\[\s*(\d+)\s+\d+\s+R/);
    const dd = dRef ? objs.get(+dRef[1])?.dic || '' : desc;
    f.padrao = +(dd.match(/\/DW\s+(\d+)/) || [, 1000])[1];
    const w = valor(dd, 'W', objs);
    if (w) {
      const toks = w.trim().replace(/^\[|\]$/g, '').match(/\[|\]|[-\d.]+/g) || [];
      for (let i = 0; i < toks.length;) {
        const c = +toks[i++];
        if (toks[i] === '[') { i++; let k = c; while (toks[i] !== ']' && i < toks.length) f.larguras.set(k++, +toks[i++]); i++; } else { const c2 = +toks[i++], wd = +toks[i++]; for (let k = c; k <= c2 && k - c < 5000; k++) f.larguras.set(k, wd); }
      }
    }
  } else {
    const fc = +(dic.match(/\/FirstChar\s+(\d+)/) || [, 0])[1];
    const w = valor(dic, 'Widths', objs);
    if (w) (w.match(/[-\d.]+/g) || []).forEach((x, i) => f.larguras.set(fc + i, +x));
  }
  return f;
}
function decodificar(fonte, bytes) {
  const saida = [];
  for (let i = 0; i + fonte.bytes <= bytes.length; i += fonte.bytes) {
    const c = fonte.bytes === 2 ? (bytes[i] << 8) | bytes[i + 1] : bytes[i];
    let t = fonte.mapa && fonte.mapa.has(c) ? fonte.mapa.get(c) : fonte.bytes === 1 ? WIN[c] || String.fromCharCode(c) : '';
    saida.push({ c, t, w: (fonte.larguras.get(c) ?? fonte.padrao) / 1000 });
  }
  return saida;
}

// ── Conteúdo da página ──
function* fichas(d) {
  const n = d.length;
  let i = 0;
  const branco = (c) => c === 32 || c === 10 || c === 13 || c === 9 || c === 12 || c === 0;
  const delim = (c) => '()<>[]{}/%'.includes(String.fromCharCode(c));
  while (i < n) {
    const c = d[i];
    if (branco(c)) { i++; continue; }
    if (c === 37) { while (i < n && d[i] !== 10 && d[i] !== 13) i++; continue; } // % comentário
    if (c === 40) { // ( string )
      const out = []; let prof = 1; i++;
      while (i < n && prof) {
        let b = d[i++];
        if (b === 92) {
          const e = d[i++];
          const esc = { 110: 10, 114: 13, 116: 9, 98: 8, 102: 12 }[e];
          if (esc != null) out.push(esc);
          else if (e >= 48 && e <= 55) { let o = e - 48; for (let k = 0; k < 2 && d[i] >= 48 && d[i] <= 55; k++) o = o * 8 + d[i++] - 48; out.push(o & 255); } else if (e === 13) { if (d[i] === 10) i++; } else if (e !== 10) out.push(e);
          continue;
        }
        if (b === 40) prof++; else if (b === 41 && !--prof) break;
        out.push(b);
      }
      yield { s: Buffer.from(out) }; continue;
    }
    if (c === 60 && d[i + 1] === 60) { yield { op: '<<' }; i += 2; continue; }
    if (c === 62 && d[i + 1] === 62) { yield { op: '>>' }; i += 2; continue; }
    if (c === 60) { // <hex>
      let j = d.indexOf(62, i); if (j < 0) j = n;
      let h = d.subarray(i + 1, j).toString('latin1').replace(/\s/g, ''); if (h.length % 2) h += '0';
      yield { s: Buffer.from(h, 'hex') }; i = j + 1; continue;
    }
    if (c === 91 || c === 93) { yield { op: c === 91 ? '[' : ']' }; i++; continue; }
    if (c === 47) { let j = i + 1; while (j < n && !branco(d[j]) && !delim(d[j])) j++; yield { nome: d.subarray(i + 1, j).toString('latin1') }; i = j; continue; }
    let j = i; while (j < n && !branco(d[j]) && !delim(d[j])) j++;
    if (j === i) { i++; continue; }
    const w = d.subarray(i, j).toString('latin1');
    i = j;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) { yield { n: +w }; continue; }
    if (w === 'BI') { const k = d.indexOf('EI', i); i = k < 0 ? n : k + 2; continue; } // imagem embutida
    yield { op: w };
  }
}
const mult = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];

function textoDaPagina(conteudo, fontes, altura) {
  const pedacos = [];
  let ctm = [1, 0, 0, 1, 0, 0]; const pilha = [];
  let tm = [1, 0, 0, 1, 0, 0], tlm = [1, 0, 0, 1, 0, 0];
  let fonte = null, tam = 12, tc = 0, tw = 0, th = 1, tl = 0, rise = 0;
  let args = [], arr = null;
  const mostrar = (bytes) => {
    if (!fonte) return;
    const gl = decodificar(fonte, bytes);
    // Cada trecho vira um pedaço; espaços em sequência (colunas alinhadas com espaço) quebram em pedaços separados
    let atual = null;
    const fechar = () => { if (atual && atual.t.trim()) pedacos.push(atual); atual = null; };
    let brancos = 0;
    for (const g of gl) {
      const m = mult([tam * th, 0, 0, tam, 0, rise], mult(tm, ctm));
      const x = m[4], y = m[5], esc = Math.hypot(m[2], m[3]) || tam;
      const avanco = (g.w * tam + tc + (g.c === 32 && fonte.bytes === 1 ? tw : 0)) * th;
      if (g.t === ' ' || g.t === ' ') { brancos++; if (brancos >= 2) fechar(); else if (atual) atual.t += ' '; } else {
        brancos = 0;
        if (!atual) atual = { t: '', x0: x, y: altura - y, h: esc };
        atual.t += g.t;
      }
      tm = mult([1, 0, 0, 1, avanco, 0], tm);
      // O fim do pedaço é o fim da última letra (sem o espaço), para a distância até o próximo pedaço contar o espaço
      if (atual && brancos === 0) atual.x1 = mult([tam * th, 0, 0, tam, 0, rise], mult(tm, ctm))[4];
    }
    fechar();
  };
  for (const f of fichas(conteudo)) {
    if (f.op === '[') { arr = []; continue; }
    if (f.op === ']') { args.push(arr); arr = null; continue; }
    if (arr) { if (f.s || f.n != null) arr.push(f.s || f.n); continue; }
    if (!f.op || f.op === '<<' || f.op === '>>') { args.push(f.s ?? f.n ?? f.nome); continue; }
    const a = args; args = [];
    switch (f.op) {
      case 'q': pilha.push(ctm); break;
      case 'Q': ctm = pilha.pop() || [1, 0, 0, 1, 0, 0]; break;
      case 'cm': if (a.length >= 6) ctm = mult(a.slice(-6), ctm); break;
      case 'BT': tm = [1, 0, 0, 1, 0, 0]; tlm = tm; break;
      case 'Tf': fonte = fontes.get(a[a.length - 2]) || null; tam = a[a.length - 1] || tam; break;
      case 'Tc': tc = a[0] || 0; break;
      case 'Tw': tw = a[0] || 0; break;
      case 'Tz': th = (a[0] ?? 100) / 100; break;
      case 'TL': tl = a[0] || 0; break;
      case 'Ts': rise = a[0] || 0; break;
      case 'Tm': if (a.length >= 6) { tm = a.slice(-6); tlm = tm; } break;
      case 'Td': tlm = mult([1, 0, 0, 1, a[0] || 0, a[1] || 0], tlm); tm = tlm; break;
      case 'TD': tl = -(a[1] || 0); tlm = mult([1, 0, 0, 1, a[0] || 0, a[1] || 0], tlm); tm = tlm; break;
      case 'T*': tlm = mult([1, 0, 0, 1, 0, -tl], tlm); tm = tlm; break;
      case 'Tj': if (Buffer.isBuffer(a[0])) mostrar(a[0]); break;
      case "'": tlm = mult([1, 0, 0, 1, 0, -tl], tlm); tm = tlm; if (Buffer.isBuffer(a[0])) mostrar(a[0]); break;
      case '"': tw = a[0]; tc = a[1]; tlm = mult([1, 0, 0, 1, 0, -tl], tlm); tm = tlm; if (Buffer.isBuffer(a[2])) mostrar(a[2]); break;
      case 'TJ':
        for (const x of a[0] || []) {
          if (Buffer.isBuffer(x)) mostrar(x);
          else tm = mult([1, 0, 0, 1, (-x / 1000) * tam * th, 0], tm);
        }
        break;
      default:
    }
  }
  return pedacos;
}

// PDF → páginas no formato do reconhecimento de imagem. Devolve null se o PDF não tiver texto (escaneado).
function lerTextoPdf(buf, maxPaginas = 6) {
  const objs = lerObjetos(buf);
  const paginas = [];
  const visitar = (num, herdado, vistos = new Set()) => {
    if (vistos.has(num) || paginas.length >= maxPaginas) return;
    vistos.add(num);
    const o = objs.get(num); if (!o) return;
    const res = valor(o.dic, 'Resources', objs) || herdado;
    if (/\/Type\s*\/Pages\b/.test(o.dic)) {
      const kids = valor(o.dic, 'Kids', objs) || '';
      for (const k of kids.matchAll(/(\d+)\s+\d+\s+R/g)) visitar(+k[1], res, vistos);
    } else if (/\/Type\s*\/Page\b/.test(o.dic)) paginas.push({ o, res });
  };
  const raiz = [...objs.values()].find((o) => /\/Type\s*\/Catalog\b/.test(o.dic));
  const pagesRef = raiz && ref(raiz.dic, 'Pages');
  if (pagesRef) visitar(pagesRef, null);
  else for (const [n, o] of objs) if (/\/Type\s*\/Page\b/.test(o.dic) && paginas.length < maxPaginas) paginas.push({ o, res: valor(o.dic, 'Resources', objs) });
  const total = [...objs.values()].filter((o) => /\/Type\s*\/Page\b/.test(o.dic)).length;

  const saida = [];
  for (const { o, res } of paginas) {
    const caixa = (valor(o.dic, 'MediaBox', objs) || '[0 0 612 792]').match(/[-\d.]+/g).map(Number);
    const altura = caixa[3] || 792;
    const fontes = new Map();
    const dicFontes = valor(res || '', 'Font', objs) || '';
    for (const f of dicFontes.matchAll(/\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g)) {
      const fo = objs.get(+f[2]);
      if (fo) fontes.set(f[1], lerFonte(fo.dic, objs));
    }
    const cont = valor(o.dic, 'Contents', objs);
    const refs = [...String(o.dic.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/)?.[1] || '').matchAll(/(\d+)\s+\d+\s+R/g)].map((x) => +x[1]);
    const partes = refs.map((n) => abrirFluxo(objs.get(n), objs)).filter(Boolean);
    if (!partes.length && cont == null) continue;
    const pedacos = textoDaPagina(Buffer.concat(partes.flatMap((p) => [p, Buffer.from('\n')])), fontes, altura);
    saida.push({ palavras: pedacos.map((p, i) => ({ t: p.t.trim(), x: p.x0, y: p.y - p.h * 0.8, w: Math.max(1, (p.x1 ?? p.x0) - p.x0), h: p.h, l: i })) });
  }
  const letras = saida.reduce((s, p) => s + p.palavras.reduce((k, w) => k + w.t.length, 0), 0);
  return letras >= 20 ? { paginas: saida, total } : null;
}

module.exports = { lerTextoPdf };
