// Séries no formato do ACADESC (Descricao + Serie) e a progressão para o ano seguinte.
'use strict';

// Ordem oficial das séries, com o nome que o ACADESC usa em "Descricao" e "Serie"
const SERIES = [
  { chave: 'MAT', descricao: 'Maternal', serie: '', rotulo: 'Maternal', segmento: 'Educação Infantil' },
  { chave: 'JD1', descricao: 'Jardim I', serie: '', rotulo: 'Jardim I', segmento: 'Educação Infantil' },
  { chave: 'JD2', descricao: 'Jardim II', serie: '', rotulo: 'Jardim II', segmento: 'Educação Infantil' },
  ...[1, 2, 3, 4, 5].map((n) => ({ chave: 'F' + n, descricao: 'Ens. Fund. 9 anos', serie: n + 'º', rotulo: `${n}º Ano Fund. I`, segmento: 'Fundamental I' })),
  ...[6, 7, 8, 9].map((n) => ({ chave: 'F' + n, descricao: 'Ens. Fund. 9 anos', serie: n + 'º', rotulo: `${n}º Ano Fund. II`, segmento: 'Fundamental II' })),
  ...[1, 2, 3].map((n) => ({ chave: 'EM' + n, descricao: 'Ensino Médio', serie: n + 'º', rotulo: `${n}ª Série EM`, segmento: 'Ensino Médio' })),
];
const CONCLUINTE = { chave: 'CONC', descricao: 'Concluinte', serie: '', rotulo: 'Concluinte (formado)', segmento: '—' };

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Identifica a série a partir dos campos do ACADESC (ou de um texto livre como "5º ANO B")
function identificar(descricao, serie) {
  const d = norm(descricao), s = norm(serie);
  const num = (s.match(/\d+/) || d.match(/(\d+)\s*[ºoa°]?\s*(ano|serie|série)?/) || [])[0];
  if (d.startsWith('matern') || d.startsWith('mt')) return SERIES[0];
  if (/jardim ii|jd ii|jardim 2|jd 2/.test(d)) return SERIES[2];
  if (/jardim i|jd i|jardim 1|jd 1/.test(d)) return SERIES[1];
  const n = parseInt(num, 10);
  if (/medio|em\b|serie em/.test(d) && n >= 1 && n <= 3) return SERIES.find((x) => x.chave === 'EM' + n);
  if (n >= 1 && n <= 9) return SERIES.find((x) => x.chave === 'F' + n);
  return null;
}

// "DescClasse" do ACADESC: "E.F. 9 1ª A", "JD II 1ª B", "E.M 1° A", "MT II 1ª A"
function identificarClasse(desc) {
  const d = norm(desc).replace(/[º°ª]/g, '');
  if (!d) return null;
  const turma = (d.match(/\s([a-z])$/) || [])[1];
  let s = null;
  if (/^(mt|maternal)/.test(d)) s = SERIES[0];
  else if (/^(jd|jardim)\s*ii\b|^(jd|jardim)\s*2\b/.test(d)) s = SERIES[2];
  else if (/^(jd|jardim)\s*i\b|^(jd|jardim)\s*1\b/.test(d)) s = SERIES[1];
  else if (/^e\.?\s*m/.test(d)) { const n = +(d.match(/^e\.?\s*m\.?\s*(\d)/) || [])[1]; if (n >= 1 && n <= 3) s = SERIES.find((x) => x.chave === 'EM' + n); }
  else if (/^e\.?\s*f/.test(d)) { const n = +(d.match(/^e\.?\s*f\.?\s*9\s+(\d)/) || [])[1]; if (n >= 1 && n <= 9) s = SERIES.find((x) => x.chave === 'F' + n); }
  return s ? { serie: s, turma: turma ? turma.toUpperCase() : null } : null;
}

// Segmento para horários e textos das declarações
function segmento(chave) {
  if (!chave) return null;
  if (['MAT', 'JD1', 'JD2'].includes(chave)) return 'infantil';
  if (chave.startsWith('EM')) return 'medio';
  return +chave.slice(1) <= 5 ? 'fund1' : 'fund2';
}

// Nome por extenso usado nas declarações: "2º ano do Ensino Fundamental I"
function extenso(chave) {
  const s = porChave(chave);
  if (!s) return '';
  if (['MAT', 'JD1', 'JD2'].includes(chave)) return `${s.rotulo} da Educação Infantil`;
  if (chave.startsWith('EM')) return `${chave.slice(2)}ª Série do Ensino Médio`;
  const n = +chave.slice(1);
  return `${n}º ano do Ensino Fundamental ${n <= 5 ? 'I' : 'II'}`;
}

function porChave(chave) {
  return SERIES.find((s) => s.chave === chave) || (chave === 'CONC' ? CONCLUINTE : null);
}

function proxima(chave) {
  const i = SERIES.findIndex((s) => s.chave === chave);
  if (i < 0) return null;
  return SERIES[i + 1] || CONCLUINTE;
}

module.exports = { SERIES, CONCLUINTE, identificar, identificarClasse, segmento, extenso, porChave, proxima, norm };
