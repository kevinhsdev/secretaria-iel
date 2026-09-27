// Secretaria IEL — Histórico escolar para imprimir (4.10.0)
// Reproduz os modelos Word da escola: "HISTORICO FUNDAMENTAL I e II", "HISTÓRICO ENSINO MÉDIO" e
// "HISTORICO ESCOLAR-TRANSFÊRENCIA BIMESTRE". Duas folhas por aluno:
//   1) cabeçalho, identificação, notas por ano, carga horária e estudos realizados;
//   2) transferência durante o período letivo (bimestres), definição operacional, certificado/declaração,
//      assinaturas e o quadro da Resolução 25/81 para a escola que recebe o aluno.
// Usa as funções de doc.js (esc, dataBR, folha, titulo). Carregado antes dele em doc.html.
'use strict';

const HIST_EXTENSO = { 5: 'cinco', 6: 'seis', 7: 'sete', 8: 'oito' };

// "8" → "8,0"; "7,25" → "7,25"; conceito fica como está; vazio → "-"
function notaImpressa(n) {
  const t = String(n ?? '').trim();
  if (!t) return '-';
  if (/^\d{1,2}([.,]\d{1,2})?$/.test(t)) return Number(t.replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  return t;
}
const traco = (v) => (v == null || String(v).trim() === '' ? '-' : String(v));

// Nome da série do jeito dos modelos: "9º ano Ensino Fundamental II", "3ª série do Ensino Médio"
function serieExtensa(ch) {
  const n = +ch.replace(/\D/g, '');
  return ch.startsWith('EM') ? `${n}ª série do Ensino Médio` : `${n}º ano Ensino Fundamental ${n <= 5 ? 'I' : 'II'}`;
}
const serieDo = (ch) => { const n = +ch.replace(/\D/g, ''); return ch.startsWith('EM') ? `${n}ª série do Ensino Médio` : `${n}º ano do Ensino Fundamental ${n <= 5 ? 'I' : 'II'}`; };
function serieSeguinte(ch) {
  const n = +ch.replace(/\D/g, '');
  if (ch.startsWith('EM')) return n < 3 ? `na ${n + 1}ª série do Ensino Médio` : 'no Ensino Superior';
  return n < 9 ? `no ${n + 1}º ano do Ensino Fundamental ${n + 1 <= 5 ? 'I' : 'II'}` : 'do Ensino Médio';
}
const artigo = (ch) => (ch.startsWith('EM') ? 'a' : 'o');

// Cabeçalho do papel do histórico (é diferente do timbre das declarações)
function cabecalhoHistorico(medio) {
  return `<header class="h-cab"><img src="logo.png" alt=""><div>
    <div>ORDEM AUXILIADORA DAS SENHORAS EVANGÉLICAS – OASE</div>
    <div class="h-cab-escola">INSTITUTO EDUCACIONAL LUTERANO</div>
    ${medio ? '' : '<div>DIRETORIA DE ENSINO DE SUZANO</div>'}
    <div class="h-cab-peq">Rua Herman Teles Ribeiro, 162 - Vila Romanópolis, CEP: 08529-100 Ferraz de Vasconcelos / SP</div>
    ${medio ? '' : '<div class="h-cab-peq">CRIAÇÃO: PROCESSO 2154/93</div>'}
    <div class="h-cab-peq">Autorização: Portaria da DRE - 5 - Leste de 13/01/1994, public. DOE 15/01/94</div></div></header>`;
}

// Letras uma embaixo da outra ("TRANSFERE-SE" em pé na coluna do ano, como no modelo)
const emPe = (txt) => [...txt].map((l) => `<span>${esc(l)}</span>`).join('');

function folhasHistorico(a, v) {
  const h = a.hist, cur = h.cursos[v.curso], cf = h.config, dd = h.dados || {};
  const medio = v.curso === 'medio';
  const anos = new Map(h.anos.map((x) => [x.serie_chave, x]));
  const transf = h.transf && cur.series.some((s) => s.chave === h.transf.serie_chave) ? h.transf : null;
  const cursadas = cur.series.filter((s) => anos.has(s.chave));
  const aprovado = (x) => !!x && /^Aprovado/.test(x.resultado || '');
  const concluiu = cur.series.every((s) => aprovado(anos.get(s.chave)));
  const tipo = v.tipo !== 'auto' ? v.tipo : transf ? 'transferencia' : concluiu ? 'conclusao' : 'declaracao';
  const nome = a.nome.toUpperCase();
  const rgTxt = a.rg ? a.rg + (dd.rg_uf ? (medio ? ' ' : '/') + dd.rg_uf : '') : ''; // sem RG não sai só o estado

  // Grupos de disciplinas (Base Nacional Comum / Parte Diversificada…), na ordem da matriz
  const grupos = [];
  for (const c of cur.componentes) {
    const g = grupos[grupos.length - 1];
    if (g && g.area === c.area) g.itens.push(c); else grupos.push({ area: c.area || '', itens: [c] });
  }
  const nComps = cur.componentes.length;
  const semNotas = (ch) => !Object.keys(anos.get(ch)?.notas || {}).length;
  const colTransf = transf && semNotas(transf.serie_chave) ? transf.serie_chave : null;

  // ── Folha 1 ──
  const ident = medio
    ? `<table class="h-tab h-ident"><tbody>
        <tr><td class="rot" style="width:17%">ALUNO:</td><td colspan="3" class="h-nome">${esc(nome)}</td><td class="rot c">RG</td><td class="c">${esc(rgTxt || '-')}</td></tr>
        <tr><td class="rot" rowspan="2">LOCAL DE<br>NASCIMENTO</td><td class="c peq">CIDADE</td><td class="c peq">UF</td><td class="c peq">NACIONALIDADE</td><td class="c peq" colspan="2">DATA DE NASCIMENTO</td></tr>
        <tr><td class="c">${esc((dd.naturalidade || '-').toUpperCase())}</td><td class="c">${esc(dd.uf_nasc || '-')}</td><td class="c">${esc(dd.nacionalidade || 'Brasileira')}</td>
          <td class="c" colspan="2">${esc(dataBR(a.dt_nasc) || '-')}</td></tr></tbody></table>`
    : `<table class="h-tab h-ident"><tbody>
        <tr><td class="rot" style="width:15%">ALUNO:</td><td colspan="7" class="h-nome">${esc(nome)}</td></tr>
        <tr><td class="rot" rowspan="2">LOCAL DE<br>NASCIMENTO</td><td class="c rot" colspan="2">CIDADE</td><td class="c rot">UF</td><td class="c rot">NACIONALIDADE</td><td class="c rot" colspan="3">DATA DE NASCIMENTO</td></tr>
        <tr><td class="c b" colspan="2">${esc(dd.naturalidade || '-')}</td><td class="c b">${esc(dd.uf_nasc || '-')}</td><td class="c b">${esc(dd.nacionalidade || 'Brasileira')}</td>
          <td class="c b" colspan="3">${esc(dataBR(a.dt_nasc) || '-')}</td></tr>
        <tr class="peq"><td class="rot">Documento de Identidade – RG</td><td class="c b">${esc(a.rg || '-')}</td><td class="rot">Data de Expedição</td>
          <td class="c b">${esc(dd.rg_expedicao ? dataBR(dd.rg_expedicao) : '-')}</td><td class="rot">Órgão Expedidor</td><td class="c b">${esc(dd.rg_orgao || '-')}</td>
          <td class="rot">Estado</td><td class="c b">${esc(dd.rg_uf || '-')}</td></tr></tbody></table>`;

  let notas;
  if (!medio) {
    const linhas = grupos.map((g, gi) => g.itens.map((c, i) => `<tr>${i === 0 ? `<td class="h-area" rowspan="${g.itens.length}"><div>${esc(g.area)}</div></td>` : ''}
      <td class="h-comp">${esc(c.nome)}</td>${cur.series.map((s) => {
        if (s.chave === colTransf) return gi === 0 && i === 0 ? `<td class="c h-transf" rowspan="${nComps + grupos.length - 1}">${emPe('TRANSFERE-SE')}</td>` : '';
        return `<td class="c b">${notaImpressa(anos.get(s.chave)?.notas?.[c.nome])}</td>`;
      }).join('')}</tr>`).join('') + (gi < grupos.length - 1 ? `<tr class="h-sep"><td></td><td></td>${cur.series.map((s) => (s.chave === colTransf ? '' : '<td></td>')).join('')}</tr>` : '')).join('');
    const tot = (rot, campo, cls = '') => `<tr class="h-tot ${cls}"><td colspan="2">${esc(rot)}</td>${cur.series.map((s) => `<td class="c">${esc(traco(anos.get(s.chave)?.[campo]))}</td>`).join('')}</tr>`;
    notas = `<table class="h-tab h-notas"><thead>
        <tr><th colspan="${2 + cur.series.length}">RESULTADO DE ESTUDOS REALIZADOS NO ENSINO FUNDAMENTAL - Lei Federal 9394/96</th></tr>
        <tr><th colspan="2"></th>${cur.series.map((s) => `<th class="c">${s.chave.slice(1)}º</th>`).join('')}</tr></thead><tbody>
        ${linhas}
        ${tot('Total de carga horária - Base Nacional Comum', 'carga_bnc')}
        ${tot('Total de carga horária – Parte Diversificada', 'carga_pd')}
        ${tot('TOTAL DA CARGA HORÁRIA', 'carga', 'h-total')}</tbody></table>`;
  } else {
    // Médio: nota e carga horária de cada disciplina em cada série; o total é o digitado ou a soma das cargas
    const total = (s) => { const x = anos.get(s.chave); if (!x) return null; return x.carga ?? (Object.values(x.cargas || {}).reduce((t, n) => t + (Number(n) || 0), 0) || null); };
    const linhas = grupos.map((g) => g.itens.map((c, i) => `<tr>${i === 0 ? `<td class="h-area" rowspan="${g.itens.length}"><div>${esc(g.area)}</div></td>` : ''}
      <td class="h-comp">${esc(c.nome.toUpperCase())}</td>
      ${cur.series.map((s) => (s.chave === colTransf ? (g === grupos[0] && i === 0 ? `<td class="c h-transf" rowspan="${nComps}">${emPe('TRANSFERE-SE')}</td>` : '')
        : `<td class="c b">${notaImpressa(anos.get(s.chave)?.notas?.[c.nome])}</td>`)).join('')}
      ${cur.series.map((s) => `<td class="c b">${esc(traco(anos.get(s.chave)?.cargas?.[c.nome]))}</td>`).join('')}</tr>`).join('')).join('');
    notas = `<div class="h-lei">RESULTADOS DOS ESTUDOS REALIZADOS NO ENSINO MÉDIO - Lei Federal 9394/96 - Parecer CNB/CEB 03/98 Resolução SE 7/98 e Resolução SE 10/98.</div>
      <table class="h-tab h-notas h-medio"><thead>
        <tr><th rowspan="2" style="width:6%"></th><th rowspan="2">COMPONENTES CURRICULARES</th>${cur.series.map((s) => `<th class="c">${esc(anos.get(s.chave)?.ano_letivo || '')}</th>`).join('')}<th colspan="3" class="c">Carga Horária</th></tr>
        <tr>${cur.series.map((s) => `<th class="c"><i>${s.chave.slice(2)}ª</i></th>`).join('')}${cur.series.map((s) => `<th class="c"><i>${s.chave.slice(2)}ª</i></th>`).join('')}</tr></thead><tbody>
        ${linhas}
        <tr class="h-tot"><td colspan="2">PARTE DIVERSIFICADA – Total da Carga Horária</td>${cur.series.map((s) => `<td class="c">${esc(traco(anos.get(s.chave)?.carga_pd))}</td>`).join('').repeat(2)}</tr>
        <tr class="h-tot h-total"><td colspan="2">CARGA HORÁRIA TOTAL DO CURSO</td>${cur.series.map((s) => `<td class="c">${esc(traco(total(s)))}</td>`).join('').repeat(2)}</tr>
      </tbody></table>`;
  }

  // Estudos realizados: uma linha por ano; as linhas que sobram ficam riscadas (ninguém acrescenta nada depois)
  const linhaEstudo = (s) => {
    const x = anos.get(s.chave) || {};
    const t = transf && transf.serie_chave === s.chave;
    const ano = x.ano_letivo || (t ? transf.ano_letivo : '');
    const escola = x.escola || (t ? h.escola.escola : '');
    return { tem: !!(ano || escola), html: `<tr><td class="c b">${medio ? s.chave.slice(2) + 'ª' : s.chave.slice(1) + 'º'}</td><td class="c b">${esc(ano || '')}</td>
      <td class="c b">${esc(escola ? (medio ? escola.toUpperCase() : escola) + (t && !semNotas(s.chave) ? '' : t ? ' - Transfere-se' : '') : '')}</td>
      <td class="c b">${esc(medio ? (x.cidade || (t ? h.escola.cidade : '')).toUpperCase() : x.cidade || (t ? h.escola.cidade : ''))}</td><td class="c b">${esc(x.uf || (t ? h.escola.uf : ''))}</td></tr>` };
  };
  const ests = cur.series.map(linhaEstudo);
  const ultimaComDado = ests.map((e) => e.tem).lastIndexOf(true);
  const visiveis = ests.slice(0, ultimaComDado + 1).map((e) => e.html).join('');
  const sobram = cur.series.length - (ultimaComDado + 1);
  const riscado = sobram ? `<tr><td colspan="5" class="h-risco" style="height:${sobram * 5.2}mm"></td></tr>` : '';
  const cabEst = `<tr><th style="width:11%">${medio ? 'SÉRIE' : 'ANO/ SÉRIE'}</th><th style="width:8%">ANO</th><th>ESTABELECIMENTO</th><th style="width:28%">MUNICÍPIO</th><th style="width:9%">ESTADO</th></tr>`;
  const fc = h.fund_conclusao || {};
  const estudos = medio
    ? `<table class="h-tab h-estudos"><thead><tr><th colspan="5">ESTUDOS REALIZADOS NO ENSINO FUNDAMENTAL</th></tr>
        <tr><th colspan="2">ANO DE CONCLUSÃO</th><th>ESTABELECIMENTO</th><th>MUNICÍPIO</th><th>ESTADO</th></tr></thead>
        <tbody><tr><td colspan="2" class="c b">${esc(fc.ano || '-')}</td><td class="c b">${esc((fc.escola || '-').toUpperCase())}</td><td class="c b">${esc((fc.cidade || '-').toUpperCase())}</td><td class="c b">${esc(fc.uf || '-')}</td></tr></tbody>
        <thead><tr><th colspan="5">ESTUDOS REALIZADOS NO ENSINO MÉDIO</th></tr>${cabEst}</thead><tbody>${visiveis}${riscado}</tbody></table>`
    : `<table class="h-tab h-estudos"><thead><tr><th colspan="5">ESTUDOS REALIZADOS NO ENSINO FUNDAMENTAL</th></tr>${cabEst}</thead><tbody>${visiveis}${riscado}</tbody></table>`;

  const folha1 = folha(`${cabecalhoHistorico(medio)}
    <div class="h-titulo">HISTÓRICO ESCOLAR<small>${esc(cur.nome)}</small></div>
    ${ident}${notas}${estudos}`, medio ? 'h-folha h-folha-medio' : 'h-folha');

  // ── Folha 2 ──
  const ensino = medio ? 'Ensino Médio' : transf ? `Fundamental ${+transf.serie_chave.slice(1) <= 5 ? 'I' : 'II'}` : '';
  const fundI = !medio && transf && +transf.serie_chave.slice(1) <= 5;
  // Disciplinas da página 2: as que têm nota na transferência; sem transferência, a base comum e as da parte diversificada do último ano
  const ultimo = [...cursadas].reverse()[0];
  // (sem transferência a tabela sai em branco e riscada; limita a parte diversificada para caber na folha)
  const base = (c) => c.area === grupos[0]?.area;
  // Notas dos bimestres: as digitadas na transferência ou, se não houver, as lançadas durante o ano (notas por bimestre)
  const bimsDe = (c) => { const x = transf?.notas?.[c.nome]; if (x && Object.values(x).some((v) => v != null && v !== '')) return x; return anos.get(transf?.serie_chave)?.bims?.[c.nome] || null; };
  let compsT = transf ? cur.componentes.filter((c) => bimsDe(c)) : [];
  if (!compsT.length) {
    const pdComNota = cur.componentes.filter((c) => !base(c) && anos.get(ultimo?.chave)?.notas?.[c.nome]).slice(0, 4);
    compsT = cur.componentes.filter((c) => base(c) || pdComNota.includes(c));
  }
  const gruposT = [];
  for (const c of compsT) {
    const g = gruposT[gruposT.length - 1];
    if (g && g.base === base(c)) g.itens.push(c); else gruposT.push({ base: base(c), itens: [c] });
  }
  // Bimestres que o aluno não cursou saem riscados (e, do 1º ao 5º ano, também as colunas de faltas e aulas dadas)
  const bim = transf ? Math.min(4, Math.max(1, Number(transf.bimestres) || 4)) : 0;
  const risco = (n) => `<td colspan="${n}" rowspan="${compsT.length}" class="h-risco"></td>`;
  const linhasT = gruposT.map((g, gi) => g.itens.map((c, i) => {
    const x = (transf && bimsDe(c)) || {};
    const primeira = gi === 0 && i === 0;
    const cel = !transf ? (primeira ? risco(6) : '')
      : ['b1', 'b2', 'b3', 'b4'].slice(0, bim).map((k) => `<td class="c b">${esc(notaImpressa(x[k]).replace(/^-$/, ''))}</td>`).join('')
        + (fundI ? (primeira ? risco(4 - bim + 2) : '')
          : (primeira && bim < 4 ? risco(4 - bim) : '') + `<td class="c b">${esc(x.faltas ?? '')}</td><td class="c b">${esc(x.aulas ?? '')}</td>`);
    return `<tr>${i === 0 ? `<td class="h-area2" rowspan="${g.itens.length}">${g.base ? 'BASE<br>COMUM' : 'PARTE<br>DIVERSIFICADA'}</td>` : ''}<td class="h-comp b">${esc(c.nome.toUpperCase())}</td>${cel}</tr>`;
  }).join('')).join('');
  const media = Number(cf.media) || 7;
  const mediaTxt = `${notaImpressa(media)} (${HIST_EXTENSO[media] || media})`;
  const abaixo = notaImpressa(Math.max(0, media - 0.5));
  const assina = `<div class="h-assina"><div class="h-data"><b>${esc(dataBR(v.data))}</b><br>Data</div>
      <div><span></span><b>${esc(v.diretor || '')}</b></div><div><span></span><b>${esc(v.secretario || '')}</b></div></div>`;

  const serieUlt = [...cursadas].reverse().find((s) => anos.get(s.chave).resultado);
  let tituloCert, textoCert;
  const quem = `<b>${esc(nome)}</b>${rgTxt ? `, RG: ${esc(rgTxt)}` : ''}`;
  if (tipo === 'transferencia' && (transf || serieUlt)) {
    const ch = transf ? transf.serie_chave : serieUlt.chave;
    const ano = transf ? transf.ano_letivo : anos.get(ch).ano_letivo;
    tituloCert = 'DECLARAÇÃO';
    textoCert = `O Diretor do <u>INSTITUTO EDUCACIONAL LUTERANO</u> de acordo com o artigo 24 inciso VII da Lei Nº 9394/96, declara que, ${quem},
      transfere-se ${artigo(ch)} ${esc(serieExtensa(ch))}${ano ? ` no ano de ${esc(ano)}` : ''} estando apto (a) ao prosseguimento dos estudos
      ${ch.startsWith('EM') ? 'na' : 'no'} ${esc(serieDo(ch))}${ano ? ` no ano de ${esc(ano)}` : ''}.`;
  } else if (tipo === 'conclusao') {
    const fim = cur.series[cur.series.length - 1].chave, ano = anos.get(fim)?.ano_letivo;
    tituloCert = 'CERTIFICADO';
    textoCert = medio
      ? `O Diretor do <u>INSTITUTO EDUCACIONAL LUTERANO</u> de acordo com a Lei Federal N.º 9394/96 e Parecer CNE/CEB 3/98, certifica que ${quem},
        concluiu a 3ª série do Ensino Médio${ano ? ` no ano letivo de ${esc(ano)}` : ''}, estando apto (a) ao prosseguimento dos estudos no Ensino Superior.`
      : `O Diretor do <u>INSTITUTO EDUCACIONAL LUTERANO</u> de acordo com o artigo 24 inciso VII da Lei Nº 9394/96, declara que ${quem},
        concluiu o 9º ano Ensino Fundamental II${ano ? ` no ano de ${esc(ano)}` : ''}, estando apto (a) ao prosseguimento dos estudos do Ensino Médio${ano ? ` no ano de ${esc(Number(ano) + 1)}` : ''}.`;
  } else if (serieUlt) {
    const x = anos.get(serieUlt.chave), ano = x.ano_letivo;
    tituloCert = 'DECLARAÇÃO';
    textoCert = `O Diretor do <u>INSTITUTO EDUCACIONAL LUTERANO</u> de acordo com o artigo 24 inciso VII da Lei Nº 9394/96, declara que ${quem}, `
      + (aprovado(x) ? `concluiu ${artigo(serieUlt.chave)} ${esc(serieExtensa(serieUlt.chave))}${ano ? ` no ano de ${esc(ano)}` : ''}, estando apto (a) ao prosseguimento dos estudos ${esc(serieSeguinte(serieUlt.chave))}${ano ? ` no ano de ${esc(Number(ano) + 1)}` : ''}.`
        : x.resultado === 'Cursando' ? `está cursando ${artigo(serieUlt.chave)} ${esc(serieExtensa(serieUlt.chave))}${ano ? ` no ano de ${esc(ano)}` : ''}.`
          : `cursou ${artigo(serieUlt.chave)} ${esc(serieExtensa(serieUlt.chave))}${ano ? ` no ano de ${esc(ano)}` : ''}, devendo cursá-l${artigo(serieUlt.chave)} novamente.`);
  } else { tituloCert = 'DECLARAÇÃO'; textoCert = 'Declaramos que os dados acima conferem com os registros desta unidade escolar.'; }

  const obs = [dd.obs, v.obs].filter((x) => String(x || '').trim()).map(esc).join('<br>');
  const folha2 = folha(`<table class="h-tab h-p2"><tbody>
      <tr><th colspan="8">TRANSFERÊNCIA DURANTE O PERÍODO LETIVO</th></tr>
      <tr><td colspan="8" class="c b">Rendimento Escolar do Aluno no Ano Letivo de ${esc(transf?.periodo || '')}<br>
        ${medio ? 'Série: ' + esc(transf ? transf.serie_chave.slice(2) + 'ª' : '') + ' &nbsp; ' : ''}Turma: ${esc(transf?.turma || '')} &nbsp; Turno: ${esc(transf?.turno || '')} &nbsp; Ensino: ${esc(ensino)}</td></tr>
      <tr><th colspan="2" rowspan="2">COMPONENTE CURRICULAR</th><th colspan="4">MENÇÕES OU NOTAS</th><th colspan="2" class="peq">${medio ? '' : '5ª. A 8ª. Série'}</th></tr>
      <tr class="peq"><th>1º.Bim</th><th>2º.Bim</th><th>3º.Bim</th><th>4º.Bim</th><th>FALTAS</th><th>Aulas dadas</th></tr>
      ${linhasT}
      ${medio ? '' : `<tr><td colspan="2" class="b">1º ao 5º Ano</td><td colspan="3" class="c b">FALTAS &nbsp; ${esc(fundI ? transf.faltas || '' : '')}</td><td colspan="3" class="c b">DIAS LETIVOS &nbsp; ${esc(fundI ? transf.dias_letivos || '' : '')}</td></tr>`}
      <tr><th colspan="8">OBSERVAÇÕES</th></tr>
      ${obs ? `<tr><td colspan="8" class="h-obs">${obs}</td></tr>` : ''}
      <tr><th colspan="8" class="h-grande">DEFINIÇÃO OPERACIONAL</th></tr>
      <tr><td colspan="4" class="b">CONCEITOS: NOTAS: 0,0 a 10,0</td><td colspan="4" class="c b">Definição Operacional</td></tr>
      <tr><td colspan="4" class="b">0,0 a ${abaixo} = Rendimento Insatisfatório</td><td colspan="4" class="c b">Média Mínima Satisfatória no Bimestre: ${mediaTxt}.</td></tr>
      <tr><td colspan="4" class="b">${notaImpressa(media)} a 10,0 = Rendimento Satisfatório</td><td colspan="4" class="c b">Média para Aprovação: igual ou superior a ${mediaTxt}.</td></tr>
      <tr><th colspan="8">ESTE DOCUMENTO NÃO CONTÉM EMENDA NEM RASURA</th></tr>
      <tr><th colspan="8">Deixa de constar filiação de acordo com a deliberação CEE 04/95 D.O 13/06/95 Seção I-pág,12.</th></tr>
      <tr><th colspan="8" class="h-grande"><u>${tituloCert}</u></th></tr>
      <tr><td colspan="8" class="h-cert">${textoCert}</td></tr>
      <tr><td colspan="8" class="h-assina-cel">${assina}</td></tr>
      <tr><td colspan="8" class="peq">RESOLUÇÃO N.º 25 / 81 - artigo 3º, 4º Parágrafo</td></tr>
    </tbody></table>
    <table class="h-tab h-receptora"><tbody>
      <tr><td rowspan="4" style="width:16%">Para uso da escola Receptora em caso de matrícula no Ensino Médio${medio ? ' ou no Ensino Superior' : ''}.</td>
        <td rowspan="4" style="width:14%"><b>DOE</b><br>Suplemento</td><td style="width:26%">N.º</td><td style="width:22%">OBSERVAÇÕES</td><td>ASSINATURA</td></tr>
      <tr><td>DATA:</td><td rowspan="3"></td><td rowspan="3"></td></tr><tr><td>CADERNO:</td></tr><tr><td>PÁGINA:</td></tr></tbody></table>`, 'h-folha');
  return folha1 + folha2;
}
