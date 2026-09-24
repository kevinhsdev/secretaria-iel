// Secretaria IEL — documentos para impressão (declarações, termos, carteirinhas, livro ponto, listas)
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = new URLSearchParams(location.search);
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const hojeIso = () => new Date().toLocaleDateString('sv-SE');
const dataBR = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const dataExtenso = (iso) => { const [a, m, d] = (iso || hojeIso()).split('-'); return `${+d} de ${MESES[+m - 1]} de ${a}`; };
const moeda = (n) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\s(De|Da|Do|Dos|Das|E)\s/g, (m) => m.toLowerCase());

async function api(metodo, url, corpo, bruto) {
  const op = { method: metodo, headers: { 'X-IEL': '1' } };
  if (bruto) op.body = bruto; else if (corpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
  const r = await fetch(url, op);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'Erro ' + r.status);
  return d;
}

// Valor por extenso (reais)
function extenso(valor) {
  const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = (n) => {
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(C[c]);
    if (r) p.push(r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' e ' + U[r % 10] : ''));
    return p.join(' e ');
  };
  const inteiro = Math.floor(valor), cent = Math.round((valor - inteiro) * 100);
  const partes = [];
  const mil = Math.floor(inteiro / 1000), resto = inteiro % 1000;
  if (mil) partes.push(mil === 1 ? 'mil' : ate999(mil) + ' mil');
  if (resto) partes.push(ate999(resto));
  let txt = partes.length === 2 && (resto < 100 || resto % 100 === 0) ? partes.join(' e ') : partes.join(' ');
  if (inteiro) txt += inteiro === 1 ? ' real' : ' reais';
  if (cent) txt += (inteiro ? ' e ' : '') + ate999(cent) + (cent === 1 ? ' centavo' : ' centavos');
  return txt || 'zero real';
}

const TIMBRE = `<header class="timbre"><img src="logo.png" alt=""><div><b>ORDEM AUXILIADORA DAS SENHORAS EVANGÉLICAS – OASE</b><br>DIRETORIA DE ENSINO DE SUZANO<br>
  Autorização: Portaria da DRE - 5 - Leste de 13/01/1994, public. DOE 15/01/94<br><b>INSTITUTO EDUCACIONAL LUTERANO</b><br>
  Rua Herman Teles Ribeiro, 162 - Centro · 08529-100 · Fone: (011) 4678-1461 · Ferraz de Vasconcelos / SP</div></header>`;

const folha = (conteudo, cls = '') => `<section class="folha ${cls}">${conteudo}</section>`;
const cabDecl = (v, cfg, tituloDoc, comInep = true) => `${TIMBRE}<p class="local-data">Ferraz de Vasconcelos, ${dataExtenso(v.data)}.</p>
  ${comInep ? `<p class="inep">Código no INEP ${esc(cfg.inep)}</p>` : ''}<h2 class="titulo-doc">${esc(tituloDoc)}</h2>`;
const identificacao = (v) => (v.ident && v.ident !== 'nenhum' && v.ident_valor ? `, ${v.ident}: ${esc(v.ident_valor)}` : '');
const assinatura = (rotulo = 'Secretaria Escolar') => `<p style="margin-top:34px">Atenciosamente,</p><div class="assinatura">${esc(rotulo)}</div>`;
const obsRodape = (t) => `<p class="obs-rodape">Obs.: ${esc(t)}</p>`;

// Opções de identificação disponíveis para o aluno
function opcoesIdent(a) {
  const o = [];
  if (a.ra) o.push(['R.A.', a.ra]);
  if (a.rg) o.push(['RG', a.rg]);
  if (a.cpf && !/^0{3}\.0{3}/.test(a.cpf)) o.push(['CPF', a.cpf]);
  o.push(['RG', ''], ['R.A.', '']);
  return o;
}
function camposIdent(a) {
  const o = opcoesIdent(a);
  return [
    { id: 'ident', rot: 'Identificação do aluno', tipo: 'select', opcoes: [...new Set(o.map((x) => x[0]))].map((x) => [x, x]).concat([['nenhum', 'Não mostrar']]), valor: o[0][0] },
    { id: 'ident_valor', rot: 'Número', valor: o[0][1], dica: o[0][1] ? '' : 'Preencha o número (não está cadastrado no app)' },
  ];
}
const SERIES_EXT = ['Maternal da Educação Infantil', 'Jardim I da Educação Infantil', 'Jardim II da Educação Infantil',
  ...[1, 2, 3, 4, 5].map((n) => `${n}º ano do Ensino Fundamental I`), ...[6, 7, 8, 9].map((n) => `${n}º ano do Ensino Fundamental II`),
  ...[1, 2, 3].map((n) => `${n}ª Série do Ensino Médio`)];
const respOpcoes = (a) => [...new Set([a.nome_resp, a.nome_mae, a.nome_pai].filter(Boolean))].map((n) => [titulo(n), titulo(n)]);

// ───────────── Definição dos documentos ─────────────
const alunosDaUrl = async () => api('GET', '/api/documentos/alunos?ids=' + encodeURIComponent(P.get('ids') || P.get('aluno') || ''));

const DOCS = {
  escolaridade: {
    nome: 'Declaração de escolaridade',
    carregar: alunosDaUrl,
    campos: ({ alunos: [a] }) => [
      { id: 'nome', rot: 'Nome do aluno', valor: a.nome.toUpperCase() }, ...camposIdent(a),
      { id: 'serie', rot: 'Série / ano', tipo: 'select', opcoes: SERIES_EXT.map((s) => [s, s]), valor: a.serie_extenso },
      { id: 'horario', rot: 'Horário', valor: a.horario }, { id: 'ano', rot: 'Ano letivo', valor: a.ano_letivo_atual },
      { id: 'data', rot: 'Data', tipo: 'date', valor: hojeIso() },
    ],
    render: (v, { config }) => folha(`${cabDecl(v, config, 'DECLARAÇÃO DE ESCOLARIDADE')}<div class="corpo">
      <p class="sem-recuo">O Instituto Educacional Luterano declara que,</p>
      <p><span class="nome-destaque">${esc(v.nome)}</span>${identificacao(v)}, é aluno(a) regularmente matriculado(a) nesta unidade escolar cursando o ${esc(v.serie)}, no horário ${esc(v.horario)}, no ano letivo de ${esc(v.ano)}.</p></div>
      ${assinatura()}${obsRodape('Esta declaração só será válida sem rasura.')}`),
  },
  vaga: {
    nome: 'Declaração de vaga',
    carregar: alunosDaUrl,
    campos: ({ alunos: [a] }) => [
      { id: 'nome', rot: 'Nome do aluno', valor: a.nome.toUpperCase() }, ...camposIdent(a),
      { id: 'serie', rot: 'Série garantida', tipo: 'select', opcoes: SERIES_EXT.map((s) => [s, s]), valor: a.destino_extenso || a.serie_extenso },
      { id: 'ano', rot: 'Ano letivo', valor: a.ano_matricula }, { id: 'horario', rot: 'Horário', valor: a.destino_horario || a.horario },
      { id: 'data', rot: 'Data', tipo: 'date', valor: hojeIso() },
    ],
    aviso: 'Confira se a rematrícula do aluno está concluída antes de emitir.',
    render: (v, { config }) => folha(`${cabDecl(v, config, 'DECLARAÇÃO DE VAGA')}<div class="corpo">
      <p class="sem-recuo">O Instituto Educacional Luterano declara que,</p>
      <p><span class="nome-destaque">${esc(v.nome)}</span>${identificacao(v)}, tem vaga garantida nesta unidade escolar para cursar o ${esc(v.serie)} no ano letivo de ${esc(v.ano)}, no horário ${esc(v.horario)}.</p></div>
      ${assinatura()}${obsRodape('Esta declaração só é válida sem rasuras e tendo somente um campo assinado.')}`),
  },
  transferencia: {
    nome: 'Declaração de transferência',
    carregar: alunosDaUrl,
    campos: ({ alunos: [a] }) => [
      { id: 'nome', rot: 'Nome do aluno', valor: a.nome.toUpperCase() }, ...camposIdent(a),
      { id: 'serie', rot: 'Com direito a matricular-se no', tipo: 'select', opcoes: SERIES_EXT.map((s) => [s, s]), valor: a.serie_extenso },
      { id: 'data', rot: 'Data', tipo: 'date', valor: hojeIso() },
    ],
    aviso: 'Se o ano letivo já terminou e o aluno foi aprovado, escolha a série seguinte.',
    render: (v, { config }) => folha(`${cabDecl(v, config, 'DECLARAÇÃO DE TRANSFERÊNCIA')}<div class="corpo">
      <p class="sem-recuo">O Instituto Educacional Luterano declara que,</p>
      <p><span class="nome-destaque">${esc(v.nome)}</span>${identificacao(v)}, solicitou sua transferência para outra unidade escolar, com direito a matricular-se no ${esc(v.serie)}.</p></div>
      ${assinatura()}${obsRodape('Esta declaração só é válida sem rasuras e tendo somente um campo assinado.')}`),
  },
  conclusao: {
    nome: 'Declaração de conclusão',
    carregar: alunosDaUrl,
    campos: ({ alunos: [a] }) => [
      { id: 'nome', rot: 'Nome do aluno', valor: a.nome.toUpperCase() }, ...camposIdent(a),
      { id: 'serie', rot: 'Concluiu o(a)', tipo: 'select', opcoes: SERIES_EXT.map((s) => [s, s]), valor: a.serie_extenso },
      { id: 'ano', rot: 'Ano de conclusão', valor: a.ano_letivo_atual },
      { id: 'prosseguimento', rot: 'Apto(a) ao prosseguimento dos estudos', valor: a.serie_chave === 'EM3' ? 'no Ensino Superior' : a.serie_chave === 'F9' ? 'no Ensino Médio' : 'na série seguinte' },
      { id: 'data', rot: 'Data', tipo: 'date', valor: hojeIso() },
    ],
    render: (v, { config }) => folha(`${cabDecl(v, config, 'DECLARAÇÃO DE CONCLUSÃO')}<div class="corpo">
      <p class="sem-recuo">A Direção do Instituto Educacional Luterano declara que,</p>
      <p><span class="nome-destaque">${esc(v.nome)}</span>${identificacao(v)}, concluiu o(a) ${esc(v.serie)} no ano de ${esc(v.ano)}, estando apto(a) ao prosseguimento dos estudos ${esc(v.prosseguimento)}.</p></div>
      ${assinatura('Instituto Educacional Luterano')}${obsRodape('Esta declaração só será válida sem rasura.')}`),
  },
  comparecimento: {
    nome: 'Declaração de comparecimento',
    carregar: alunosDaUrl,
    campos: ({ alunos: [a] }) => [
      { id: 'resp', rot: 'Responsável que compareceu', tipo: 'select', opcoes: respOpcoes(a), valor: titulo(a.nome_resp || a.nome_mae || a.nome_pai), livre: true },
      { id: 'rg', rot: 'RG do responsável', valor: a.rg_resp || '' }, { id: 'cpf', rot: 'CPF do responsável', valor: a.cpf_resp || '' },
      { id: 'ini', rot: 'Chegada', tipo: 'time', valor: '' }, { id: 'fim', rot: 'Saída', tipo: 'time', valor: new Date().toTimeString().slice(0, 5) },
      { id: 'motivo', rot: 'Finalidade', tipo: 'textarea', valor: `efetivação da matrícula de seu(sua) filho(a) ${a.nome.toUpperCase()}, para o ano letivo de ${a.ano_matricula}` },
      { id: 'data', rot: 'Data', tipo: 'date', valor: hojeIso() },
    ],
    render: (v, { config }) => folha(`${cabDecl(v, config, 'DECLARAÇÃO DE COMPARECIMENTO')}<div class="corpo">
      <p>O Instituto Educacional Luterano declara que o(a) Sr.(ª) <span class="nome-destaque">${esc(v.resp)}</span>${v.rg ? ', RG: ' + esc(v.rg) : ''}${v.cpf ? ', CPF: ' + esc(v.cpf) : ''},
      compareceu nesta unidade escolar${v.ini ? ` no horário das ${esc(v.ini.replace(':', 'h'))} às ${esc((v.fim || '').replace(':', 'h'))}` : ''}, para ${esc(v.motivo)}.</p></div>
      ${assinatura()}${obsRodape('Esta declaração só será válida sem rasura.')}`),
  },
  pagamento: {
    nome: 'Declaração de pagamento',
    carregar: async () => { const d = await alunosDaUrl(); d.pagamentos = []; return d; },
    campos: ({ alunos: [a] }) => [
      { id: 'arquivo', rot: 'Exportação "Consulta Pagamentos" do ACADESC (.xlsx)', tipo: 'arquivo' },
      { id: 'resp', rot: 'Responsável financeiro', tipo: 'select', opcoes: respOpcoes(a), valor: titulo(a.nome_resp || a.nome_mae || a.nome_pai), livre: true },
      { id: 'cpf', rot: 'CPF do responsável', valor: a.cpf_resp || '' },
      { id: 'referencia', rot: 'Referência (título)', valor: `Demonstrativo de Pagamentos – ${a.ano_letivo_atual}` },
      { id: 'serie', rot: 'Série', tipo: 'select', opcoes: SERIES_EXT.map((s) => [s, s]), valor: a.serie_extenso },
      { id: 'ano', rot: 'Ano letivo', valor: a.ano_letivo_atual },
      { id: 'frequencia', rot: 'Incluir frase de frequência superior a 97%', tipo: 'checkbox', valor: false },
      { id: 'data', rot: 'Data', tipo: 'date', valor: hojeIso() },
      { id: 'linhas', rot: 'Parcelas a incluir', tipo: 'pagamentos' },
    ],
    aviso: 'No ACADESC, exporte a "Consulta Pagamentos" do aluno para Excel e selecione o arquivo aqui. Só as parcelas pagas vêm marcadas.',
    render: (v, d) => {
      const a = d.alunos[0];
      const sel = d.pagamentos.filter((p, i) => v.linhas.includes(i));
      const tot = sel.reduce((s, p) => ({ valor: s.valor + p.valor, juros: s.juros + p.juros, desc: s.desc + p.desconto, pago: s.pago + (p.recebido || p.valor + p.juros - p.desconto) }), { valor: 0, juros: 0, desc: 0, pago: 0 });
      return folha(`${TIMBRE}<p class="local-data">Ferraz de Vasconcelos, ${dataExtenso(v.data)}.</p><p class="inep">Código no INEP ${esc(d.config.inep)}<br>Ref.: ${esc(v.referencia)}</p>
        <h2 class="titulo-doc">DECLARAÇÃO DE PAGAMENTO</h2><div class="corpo">
        <p>Declaramos, para os devidos fins, que <b>${esc(v.resp)}</b>${v.cpf ? ', CPF: ' + esc(v.cpf) : ''}, responsável financeiro(a) do(a) aluno(a) <b>${esc(titulo(a.nome))}</b>, matrícula nº ${esc(a.mat)},
        devidamente matriculado(a) no ${esc(v.serie)} no ano letivo de ${esc(v.ano)}, efetuou o pagamento das mensalidades abaixo relacionadas, no valor total de
        <b>R$ ${moeda(tot.pago)}</b> (${esc(extenso(tot.pago))}).</p>
        ${v.frequencia ? '<p>Declaramos também que o(a) aluno(a) teve frequência escolar superior a 97% durante todo o período mencionado.</p>' : ''}</div>
        ${sel.length ? `<table class="doc"><thead><tr><th>Descrição</th><th>Vencimento</th><th>Pagamento</th><th>Valor</th><th>Encargos</th><th>Desconto</th><th>Total pago</th></tr></thead><tbody>
          ${sel.map((p) => `<tr><td>${esc(p.descricao)}</td><td>${dataBR(p.venc)}</td><td>${dataBR(p.pagto)}</td><td class="n">${moeda(p.valor)}</td><td class="n">${moeda(p.juros)}</td><td class="n">${moeda(p.desconto)}</td><td class="n">${moeda(p.recebido || p.valor + p.juros - p.desconto)}</td></tr>`).join('')}
          <tr><th colspan="3" style="text-align:right">Total</th><th class="n">${moeda(tot.valor)}</th><th class="n">${moeda(tot.juros)}</th><th class="n">${moeda(tot.desc)}</th><th class="n">${moeda(tot.pago)}</th></tr></tbody></table>`
          : '<p class="aviso">Selecione o arquivo da Consulta Pagamentos no painel ao lado.</p>'}
        <div class="assinatura">Instituto Educacional Luterano</div>${obsRodape('Esta declaração só será válida sem rasura.')}`);
    },
  },
  termo_canc_matricula: termoCancelamento('SOLICITAÇÃO DE CANCELAMENTO DE MATRÍCULA', 'CANCELAMENTO DE MATRÍCULA', true),
  termo_canc_bolsa: termoCancelamento('SOLICITAÇÃO DE CANCELAMENTO DE BOLSA DE ESTUDOS', 'CANCELAMENTO DE BOLSA DE ESTUDOS', false),
  termo_canc_extra: termoCancelamento('CANCELAMENTO DE MATRÍCULA EM ATIVIDADE EXTRA', 'CANCELAMENTO DE ATIVIDADE EXTRA', true, true),
  termo_saida: {
    nome: 'Autorização de saída sem o responsável',
    carregar: alunosDaUrl,
    campos: ({ alunos: [a] }) => [
      { id: 'resp', rot: 'Responsável legal', tipo: 'select', opcoes: respOpcoes(a), valor: titulo(a.nome_resp || a.nome_mae || a.nome_pai), livre: true },
      { id: 'aluno', rot: 'Aluno', valor: a.nome.toUpperCase() }, { id: 'turma', rot: 'Ano/período', valor: a.turma_rotulo },
      { id: 'ano', rot: 'Ano', valor: new Date().getFullYear() },
    ],
    render: (v) => folha(`${TIMBRE}<h2 class="titulo-doc" style="font-size:13pt">TERMO DE AUTORIZAÇÃO PARA SAÍDA DE ALUNOS SEM O RESPONSÁVEL LEGAL</h2><div class="corpo">
      <p>Eu, <b>${esc(v.resp)}</b>, na condição de responsável legal pelo(a) aluno(a) <b>${esc(v.aluno)}</b>, matriculado(a) no(a) ${esc(v.turma)}, autorizo a sua saída no horário de encerramento das aulas.</p>
      <p>Estou ciente de que assumo quaisquer riscos que possam ocorrer no trajeto da escola até o local de destino.</p>
      <p class="sem-recuo"><b>Saída da escola:</b></p>
      <p class="sem-recuo">(&nbsp;&nbsp;&nbsp;) sozinho(a).</p>
      <p class="sem-recuo">(&nbsp;&nbsp;&nbsp;) acompanhado(a) de: ____________________________________________________</p>
      <p class="sem-recuo" style="margin-top:26px">Ferraz de Vasconcelos, ______ de _________________ de ${esc(v.ano)}.</p></div>
      <div class="assinatura">Responsável legal</div>
      <p class="nota">Lembramos que o(a) aluno(a) que não tiver o termo de autorização de saída preenchido só poderá sair da escola com o responsável.
      Caso haja extravio da autorização, em último caso, ela poderá ser enviada pelo WhatsApp (11) 4678-1461. Não será aceita autorização feita por telefone.</p>`),
  },
  carteirinha: {
    nome: 'Carteirinha olímpica',
    carregar: async () => (P.get('serie') ? api('GET', `/api/documentos/turma?serie=${encodeURIComponent(P.get('serie'))}&turma=${encodeURIComponent(P.get('turma') || '')}`) : alunosDaUrl()),
    campos: ({ config, alunos }) => [
      { id: 'titulo', rot: 'Evento', valor: config.olimpiada_titulo },
      { id: 'ano', rot: 'Ano', valor: new Date().getFullYear() },
      { id: 'validade', rot: 'Validade', tipo: 'date', valor: config.olimpiada_validade },
      { id: 'categoria', rot: 'Categoria padrão', valor: 'C', dica: 'Pode mudar a categoria de cada aluno na lista abaixo' },
      { id: 'sel', rot: `Alunos (${alunos.length})`, tipo: 'lista-cat', alunos },
    ],
    aviso: 'As fotos são buscadas pela matrícula nas pastas "fotos alunos", "FOTOS - ALUNOS" e ACADESC. Sem foto, a carteirinha sai com o espaço para colar.',
    render: (v, { alunos }) => {
      const sel = alunos.filter((a) => v.sel[a.id]?.on);
      const cartao = (a) => `<div class="cart"><div class="topo-c"><b>${esc(v.titulo)}</b>INSTITUTO EDUCACIONAL LUTERANO · IDENTIFICAÇÃO OLÍMPICA ${esc(v.ano)}</div>
        <div class="foto">${a.tem_foto ? `<img src="/api/foto/${encodeURIComponent(a.mat)}" alt="">` : 'foto digitalizada<br>ou colada'}</div>
        <div class="dados"><div>Aluno:<br><b>${esc(titulo(a.nome))}</b></div><div>RG: ${esc(a.rg || '______________')}</div><div>Nasc.: ${dataBR(a.dt_nasc) || '___/___/_____'}</div>
          <div>Turma: ${esc(a.turma_rotulo)}</div><div class="cat">CATEGORIA: "${esc(v.sel[a.id].cat || v.categoria)}"</div></div>
        <div class="rod"><span>Carimbo da escola · Válido somente se carimbado</span><span>Validade: ${dataBR(v.validade)}</span></div></div>`;
      const pags = [];
      for (let i = 0; i < sel.length; i += 8) pags.push(folha(`<div class="grade-cart">${sel.slice(i, i + 8).map(cartao).join('')}</div>
        <p style="font-size:8pt;text-align:center;margin-top:6mm">A veracidade do documento é de responsabilidade da escola.</p>`));
      return pags.join('') || folha('<p>Nenhum aluno selecionado.</p>');
    },
    emissao: (v, { alunos }) => ({ tipo: 'Carteirinha olímpica', alunos: alunos.filter((a) => v.sel[a.id]?.on).map((a) => a.id) }),
  },
  ponto: {
    nome: 'Livro ponto',
    carregar: async () => ({ funcionarios: (await api('GET', '/api/funcionarios')).filter((f) => f.ativo), feriados: await api('GET', '/api/feriados') }),
    campos: ({ funcionarios }) => {
      const d = new Date();
      return [
        { id: 'mes', rot: 'Mês', tipo: 'select', opcoes: MESES.map((m, i) => [i + 1, m[0].toUpperCase() + m.slice(1)]), valor: +P.get('mes') || d.getMonth() + 1 },
        { id: 'ano', rot: 'Ano', valor: +P.get('ano') || d.getFullYear() },
        { id: 'func', rot: `Funcionários (${funcionarios.length})`, tipo: 'lista', itens: funcionarios.map((f) => [f.id, f.nome]) },
      ];
    },
    aviso: 'Sábados, domingos e feriados são marcados automaticamente. Os feriados podem ser ajustados em Documentos › Livro ponto.',
    render: (v, { funcionarios, feriados }) => {
      const mes = +v.mes, ano = +v.ano, ultimo = new Date(ano, mes, 0).getDate();
      const fer = Object.fromEntries(feriados.map((f) => [f.data, f.nome]));
      const linhas = Array.from({ length: ultimo }, (_, i) => {
        const dia = i + 1, iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`, ds = new Date(ano, mes - 1, dia).getDay();
        const bloqueio = ds === 0 ? 'Domingo' : ds === 6 ? 'Sábado' : fer[iso] ? 'Feriado – ' + fer[iso] : '';
        return bloqueio ? `<tr class="fds"><td>${String(dia).padStart(2, '0')}</td><td colspan="7" style="text-align:center">${esc(bloqueio)}</td></tr>`
          : `<tr><td>${String(dia).padStart(2, '0')}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
      }).join('');
      return funcionarios.filter((f) => v.func.includes(f.id)).map((f) => folha(`<div style="text-align:center"><b style="font-size:13pt">INSTITUTO EDUCACIONAL LUTERANO</b><br>Horário de Trabalho</div>
        <p style="margin:10px 0 6px;font-size:11pt">Colaborador(a): <b>${esc(f.nome)}</b>${f.cargo ? ' · ' + esc(f.cargo) : ''}<span style="float:right">Mês: <b>${esc(MESES[mes - 1][0].toUpperCase() + MESES[mes - 1].slice(1))} de ${ano}</b></span></p>
        <table class="doc" style="font-size:9pt"><thead><tr><th style="width:9mm">Dia</th><th>Entrada manhã</th><th>Assinatura</th><th>Saída manhã</th><th>Entrada tarde</th><th>Assinatura</th><th>Saída tarde</th><th>Quant. horas</th></tr></thead>
        <tbody>${linhas}</tbody></table>
        <p style="margin-top:16px">Assinatura do(a) colaborador(a): ______________________________________</p>
        <p>Horas extras: ______________________________________</p><p>Assinatura da Diretora: ______________________________________</p>`)).join('') || folha('<p>Selecione ao menos um funcionário.</p>');
    },
    emissao: (v) => ({ tipo: 'Livro ponto', alunos: [null], descricao: `${v.func.length} funcionário(s) · ${v.mes}/${v.ano}` }),
  },
  chamada: {
    nome: 'Lista de chamada — atividade extra',
    carregar: async () => {
      const ano = P.get('ano') || new Date().getFullYear();
      const [lista, ativs] = await Promise.all([api('GET', `/api/inscricoes?atividade=${P.get('atividade')}&status=ativa&ano=${ano}`), api('GET', '/api/atividades?ano=' + ano)]);
      return { lista, atividade: ativs.find((t) => t.id === +P.get('atividade')) || {}, ano };
    },
    campos: ({ atividade }) => [
      { id: 'titulo', rot: 'Título', valor: `${atividade.nome || ''} — ${atividade.dias || ''} ${atividade.horario ? '· ' + atividade.horario : ''}` },
      { id: 'prof', rot: 'Professor(a)', valor: atividade.professor || '' },
      { id: 'mes', rot: 'Mês de referência', valor: MESES[new Date().getMonth()][0].toUpperCase() + MESES[new Date().getMonth()].slice(1) },
      { id: 'cols', rot: 'Colunas de datas', tipo: 'number', valor: 8 },
    ],
    render: (v, { lista, ano }) => folha(`${TIMBRE}<h2 class="titulo-doc" style="margin:6px 0 10px;font-size:13pt">LISTA DE CHAMADA — ${esc(v.titulo)}</h2>
      <p style="font-size:10.5pt">Professor(a): <b>${esc(v.prof)}</b> · Mês: <b>${esc(v.mes)}/${ano}</b> · ${lista.length} aluno(s)</p>
      <table class="doc"><thead><tr><th>#</th><th>Aluno</th><th>Turma</th><th>Responsável / telefone</th>${Array.from({ length: +v.cols || 0 }, () => '<th style="width:11mm">&nbsp;/&nbsp;</th>').join('')}</tr></thead>
      <tbody>${lista.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(titulo(l.aluno))}</td><td>${esc(l.turma_rotulo)}</td><td style="font-size:8.5pt">${esc(titulo(l.responsavel))}<br>${esc(l.cel_mae || l.cel_pai || '')}</td>${Array.from({ length: +v.cols || 0 }, () => '<td></td>').join('')}</tr>`).join('')}</tbody></table>`),
    emissao: () => ({ tipo: 'Lista de chamada', alunos: [null] }),
  },
  ingressos: {
    nome: 'Lista de retirada de ingressos',
    carregar: async () => api('GET', `/api/eventos/${P.get('evento')}/ingressos?filtro=${encodeURIComponent(P.get('filtro') || 'ballet')}`),
    campos: ({ evento }) => [
      { id: 'titulo', rot: 'Título', valor: evento.nome.toUpperCase() },
      { id: 'so_com', rot: 'Somente quem tem ingressos lançados', tipo: 'checkbox', valor: false },
    ],
    render: (v, { alunos }) => {
      const l = alunos.filter((a) => !v.so_com || a.quantidade > 0);
      return folha(`${TIMBRE}<h2 class="titulo-doc" style="margin:6px 0 12px;font-size:13pt">${esc(v.titulo)}</h2>
        <table class="doc"><thead><tr><th>Nome do aluno</th><th>Turma</th><th style="width:22mm">Quantidade de ingressos</th><th style="width:26mm">Data de retirada</th><th style="width:60mm">Assinatura do responsável</th></tr></thead>
        <tbody>${l.map((a) => `<tr><td>${esc(titulo(a.nome))}</td><td>${esc(a.turma_rotulo)}</td><td style="text-align:center">${a.quantidade || ''}</td><td>${a.retirado_em ? dataBR(a.retirado_em) : '&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;/'}</td><td style="height:9mm"></td></tr>`).join('')}</tbody></table>`);
    },
    emissao: () => ({ tipo: 'Lista de ingressos', alunos: [null] }),
  },

  // ── Etapa 3 ──
  protocolo_boletos: {
    nome: 'Protocolo de entrega de boletos',
    carregar: async () => api('GET', '/api/remessas/' + P.get('remessa')),
    campos: ({ remessa, alunos }) => [
      { id: 'titulo', rot: 'Título', valor: 'PROTOCOLO DE ENTREGA DE BOLETOS — ' + remessa.nome.toUpperCase() },
      { id: 'turma', rot: 'Turma', tipo: 'select', opcoes: [['', 'Todas as turmas'], ...turmasDe(alunos)], valor: P.get('turma') || '' },
      { id: 'pendentes', rot: 'Somente quem ainda não recebeu', tipo: 'checkbox', valor: false },
      { id: 'data', rot: 'Data da entrega (deixe em branco para preencher à mão)', tipo: 'date', valor: '' },
    ],
    aviso: 'Uma folha por turma. O responsável (ou o aluno maior) assina ao receber o boleto.',
    render: (v, { alunos }) => {
      const l = alunos.filter((a) => (!v.turma || a.turma_rotulo === v.turma) && (!v.pendentes || !a.entregue_em));
      return grupoPorTurma(l).map(([turma, itens]) => folha(`${TIMBRE}<h2 class="titulo-doc" style="margin:6px 0 4px;font-size:12pt">${esc(v.titulo)}</h2>
        <p style="font-size:10.5pt;margin:0 0 8px">Turma: <b>${esc(turma)}</b> · ${itens.length} aluno(s)</p>
        <table class="doc"><thead><tr><th style="width:6mm">#</th><th>Aluno</th><th>Responsável</th><th style="width:22mm">Data</th><th style="width:58mm">Assinatura de quem recebeu</th></tr></thead>
        <tbody>${itens.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(titulo(a.nome))}</td><td style="font-size:9pt">${esc(titulo(a.responsavel))}</td>
          <td style="text-align:center">${a.entregue_em ? dataBR(a.entregue_em) : v.data ? dataBR(v.data) : '___/___/____'}</td>
          <td style="height:9mm">${a.entregue_em && a.recebido_por ? `<small>${esc(titulo(a.recebido_por))}</small>` : ''}</td></tr>`).join('')}</tbody></table>
        <p class="nota">Recebi o(s) boleto(s) referente(s) a ${esc(P.get('ref') || 'este lote')}. Entregue por: ______________________________ (secretaria).</p>`)).join('')
        || folha('<p>Nenhum aluno nesta seleção.</p>');
    },
    emissao: (v) => ({ tipo: 'Protocolo de entrega de boletos', alunos: [null], descricao: v.turma || 'todas as turmas' }),
  },
  conferencia_boletos: {
    nome: 'Conferência de descontos dos boletos',
    carregar: async () => api('GET', '/api/boletos/conferencia?ano=' + encodeURIComponent(P.get('ano') || '')),
    campos: ({ ano, linhas }) => [
      { id: 'titulo', rot: 'Título', valor: `CONFERÊNCIA DE DESCONTOS — BOLETOS ${ano}` },
      { id: 'turma', rot: 'Turma', tipo: 'select', opcoes: [['', 'Todas as turmas'], ...turmasDe(linhas)], valor: P.get('turma') || '' },
      { id: 'filtro', rot: 'Mostrar', tipo: 'select', valor: P.get('filtro') || 'desconto', opcoes: [['', 'Todos os alunos'], ['desconto', 'Só com desconto'],
        ['extras', 'Só com atividade extra'], ['alerta', 'Só com ponto de atenção'], ['pendente', 'Ainda não conferidos']] },
    ],
    aviso: 'Leve esta lista para conferir com o ACADESC antes de gerar a massa de boletos.',
    render: (v, d) => {
      const l = d.linhas.filter((x) => (!v.turma || x.turma_rotulo === v.turma)
        && (v.filtro === '' || (v.filtro === 'desconto' && x.desconto_esperado > 0) || (v.filtro === 'extras' && (x.extras.length || x.extras_anterior.length))
          || (v.filtro === 'alerta' && x.alertas.length) || (v.filtro === 'pendente' && !x.conferido)));
      return folha(`${TIMBRE}<h2 class="titulo-doc" style="margin:6px 0 4px;font-size:12pt">${esc(v.titulo)}</h2>
        <p style="font-size:10pt;margin:0 0 8px">${l.length} aluno(s) · isenção de filho de funcionário: ${d.desconto_funcionario}% · os descontos não somam, vale o maior · impresso em ${dataBR(hojeIso())}</p>
        <table class="doc" style="font-size:9pt"><thead><tr><th>Aluno</th><th>Turma → ${d.ano}</th><th>Motivo do desconto</th><th style="width:14mm">%</th><th>Atividades extras</th><th style="width:16mm">No ACADESC</th><th style="width:10mm">OK</th></tr></thead>
        <tbody>${l.map((x) => `<tr><td>${esc(titulo(x.nome))}<br><small>Mat. ${esc(x.mat || '—')}</small></td><td>${esc(x.turma_rotulo)} → ${esc(x.destino)}</td>
          <td>${esc(x.origem)}${x.alertas.length ? `<br><small>⚠ ${esc(x.alertas.join(' '))}</small>` : ''}</td>
          <td style="text-align:center"><b>${x.desconto_esperado}%</b></td>
          <td>${esc(x.extras.map((e) => e.atividade).join(', ') || (x.extras_anterior.length ? `(${d.ano - 1}: ${x.extras_anterior.join(', ')})` : '—'))}</td>
          <td style="text-align:center">${x.desconto_acadesc != null ? x.desconto_acadesc + '%' : ''}</td>
          <td style="text-align:center">${x.conferido ? '✓' : '(   )'}</td></tr>`).join('')}</tbody></table>
        <p class="nota">Conferido por: ______________________________  Data: ____/____/______</p>`);
    },
    emissao: (v) => ({ tipo: 'Conferência de descontos', alunos: [null], descricao: v.turma || 'todas as turmas' }),
  },
  mutirao_fotos: {
    nome: 'Lista do mutirão de fotos',
    carregar: async () => api('GET', '/api/fotos/mutirao'),
    campos: ({ linhas }) => [
      { id: 'titulo', rot: 'Título', valor: 'MUTIRÃO DE FOTOS — CONTROLE POR TURMA' },
      { id: 'turma', rot: 'Turma', tipo: 'select', opcoes: [['', 'Todas as turmas'], ...turmasDe(linhas)], valor: P.get('turma') || '' },
      { id: 'filtro', rot: 'Mostrar', tipo: 'select', valor: P.get('filtro') || '', opcoes: [['', 'Todos os alunos'], ['sem', 'Só quem está sem foto'],
        ['incompleto', 'Só quem falta em algum sistema'], ['completo', 'Só os completos']] },
    ],
    aviso: 'Uma folha por turma, para marcar à caneta durante o mutirão e depois lançar no app.',
    render: (v, d) => {
      const [S1, S2, S3] = d.sistemas;
      const l = d.linhas.filter((x) => (!v.turma || x.turma_rotulo === v.turma)
        && (!v.filtro || (v.filtro === 'sem' && !x.tirada) || (v.filtro === 'completo' && x.completo) || (v.filtro === 'incompleto' && x.tirada && !x.completo)));
      return grupoPorTurma(l).map(([turma, itens]) => folha(`${TIMBRE}<h2 class="titulo-doc" style="margin:6px 0 4px;font-size:12pt">${esc(v.titulo)}</h2>
        <p style="font-size:10.5pt;margin:0 0 8px">Turma: <b>${esc(turma)}</b> · ${itens.length} aluno(s) · impresso em ${dataBR(hojeIso())}</p>
        <table class="doc"><thead><tr><th style="width:6mm">#</th><th>Aluno</th><th style="width:16mm">Mat.</th><th style="width:20mm">Foto tirada</th>
          <th style="width:20mm">${esc(S1)}</th><th style="width:20mm">${esc(S2)}</th><th style="width:22mm">${esc(S3)}</th></tr></thead>
        <tbody>${itens.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(titulo(x.nome))}</td><td>${esc(x.mat || '—')}</td>
          ${['tirada', 'acadesc', 'sed', 'lanche'].map((k) => `<td style="text-align:center">${x[k] ? '✓' : '(   )'}</td>`).join('')}</tr>`).join('')}</tbody></table>`)).join('')
        || folha('<p>Nenhum aluno nesta seleção.</p>');
    },
    emissao: (v) => ({ tipo: 'Lista do mutirão de fotos', alunos: [null], descricao: v.turma || 'todas as turmas' }),
  },
  saida_turma: {
    nome: 'Lista de saída por turma (portão)',
    carregar: async () => api('GET', '/api/saida/turmas'),
    campos: ({ alunos }) => [
      { id: 'titulo', rot: 'Título', valor: 'AUTORIZAÇÃO DE SAÍDA — CONSULTA DO PORTÃO' },
      { id: 'turma', rot: 'Turma', tipo: 'select', opcoes: [['', 'Todas as turmas'], ...turmasDe(alunos)], valor: P.get('turma') || '' },
      { id: 'avisos', rot: 'Incluir os avisos de hoje', tipo: 'checkbox', valor: true },
    ],
    aviso: 'Imprima e deixe no portão. Confira sempre o documento de quem vai buscar.',
    render: (v, d) => {
      const l = d.alunos.filter((a) => !v.turma || a.turma_rotulo === v.turma);
      return grupoPorTurma(l).map(([turma, itens]) => folha(`${TIMBRE}<h2 class="titulo-doc" style="margin:6px 0 4px;font-size:12pt">${esc(v.titulo)}</h2>
        <p style="font-size:10.5pt;margin:0 0 8px">Turma: <b>${esc(turma)}</b> · lista de ${dataBR(d.data)}</p>
        <table class="doc" style="font-size:9pt"><thead><tr><th>Aluno</th><th style="width:22mm">Sai sozinho</th><th>Quem pode buscar</th>${v.avisos ? '<th style="width:45mm">Aviso de hoje</th>' : ''}</tr></thead>
        <tbody>${itens.map((a) => `<tr><td>${esc(titulo(a.nome))}${a.transporte ? `<br><small>🚐 ${esc(a.transporte)}</small>` : ''}</td>
          <td style="text-align:center">${a.sai_sozinho ? 'SIM' : 'não'}</td>
          <td>${a.autorizados.length ? a.autorizados.map((x) => `${esc(titulo(x.nome))}${x.parentesco ? ` (${esc(x.parentesco)})` : ''}${x.documento ? ` — ${esc(x.documento)}` : ''}`).join('<br>') : '<small>somente o responsável legal</small>'}</td>
          ${v.avisos ? `<td>${a.avisos.map((x) => `<b>${esc(titulo(x.quem))}</b>${x.parentesco ? ` (${esc(x.parentesco)})` : ''}`).join('<br>')}</td>` : ''}</tr>`).join('')}</tbody></table>
        <p class="nota">Aluno sem termo de autorização só sai com o responsável legal. Autorização por telefone não é aceita.</p>`)).join('')
        || folha('<p>Nenhum aluno nesta seleção.</p>');
    },
    emissao: (v) => ({ tipo: 'Lista de saída (portão)', alunos: [null], descricao: v.turma || 'todas as turmas' }),
  },
  dados_aluno: {
    nome: 'Dados guardados sobre o aluno (LGPD)',
    carregar: async () => api('GET', `/api/alunos/${encodeURIComponent(P.get('aluno') || '')}/dados-pessoais`),
    campos: ({ cadastro }) => [
      { id: 'titulo', rot: 'Título', valor: 'RELATÓRIO DE DADOS PESSOAIS' },
      { id: 'solicitante', rot: 'Quem pediu', valor: '', dica: 'Nome de quem solicitou (responsável legal)' },
      { id: 'data', rot: 'Data', tipo: 'date', valor: hojeIso() },
      { id: 'tudo', rot: 'Incluir também o histórico de alterações e consultas', tipo: 'checkbox', valor: true },
    ],
    aviso: 'Entregue este relatório quando a família pedir os dados do aluno (art. 18 da LGPD). Confira antes de imprimir.',
    render: (v, d) => {
      const a = d.cadastro;
      const tab = (titulo2, colunas, linhas) => !linhas.length ? '' : `<h3 class="sec">${esc(titulo2)} <span style="font-weight:400">(${linhas.length})</span></h3>
        <table class="doc" style="font-size:9pt"><thead><tr>${colunas.map((c) => `<th>${esc(c[0])}</th>`).join('')}</tr></thead>
        <tbody>${linhas.map((l) => `<tr>${colunas.map((c) => `<td>${esc(c[1](l) ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      const dado = (rot, valor) => (valor == null || valor === '' ? '' : `<div><b>${esc(rot)}:</b> ${esc(valor)}</div>`);
      const sim = (x) => (x ? 'sim' : 'não');
      return folha(`${TIMBRE}<p class="local-data">Ferraz de Vasconcelos, ${dataExtenso(v.data)}.</p>
        <h2 class="titulo-doc" style="font-size:13pt">${esc(v.titulo)}</h2>
        <div class="corpo"><p class="sem-recuo">Em atendimento ao art. 18 da Lei nº 13.709/2018 (LGPD), o Instituto Educacional Luterano
          informa abaixo <b>todos os dados</b> que mantém em seu sistema de secretaria sobre o(a) aluno(a)
          <b>${esc(titulo(a.nome))}</b>${a.mat ? `, matrícula ${esc(a.mat)}` : ''}${v.solicitante ? `, a pedido de <b>${esc(v.solicitante)}</b>` : ''}.</p></div>
        <h3 class="sec">Cadastro</h3>
        <div class="grade-dados">
          ${dado('Nome', titulo(a.nome))}${dado('Nome social', a.nome_social)}${dado('Matrícula', a.mat)}${dado('Nascimento', dataBR(a.dt_nasc))}
          ${dado('CPF', a.cpf)}${dado('RG', a.rg)}${dado('R.A.', a.ra)}${dado('NIS', a.nis)}
          ${dado('Série', [a.descricao, a.serie, a.turma].filter(Boolean).join(' '))}${dado('Turno', a.turno)}${dado('Ano letivo', a.ano_letivo)}
          ${dado('Mãe', titulo(a.nome_mae))}${dado('Pai', titulo(a.nome_pai))}${dado('Responsável', titulo(a.nome_resp))}
          ${dado('Telefones', [a.telefone, a.tel_mae, a.cel_mae, a.tel_pai, a.cel_pai, a.tel_resp].filter(Boolean).join(' · '))}
          ${dado('E-mails', [a.email, a.email_mae, a.email_pai].filter(Boolean).join(' · '))}
          ${dado('Endereço', [a.endereco, a.bairro, a.cidade, a.uf, a.cep].filter(Boolean).join(', '))}
          ${dado('CPF do responsável', a.cpf_resp)}${dado('RG do responsável', a.rg_resp)}
          ${dado('Filho(a) de funcionário', sim(a.filho_funcionario))}${dado('Observações', a.obs)}
        </div>
        ${tab('Matrículas', [['Ano', (l) => l.ano], ['Situação', (l) => l.status], ['Série destino', (l) => l.serie_destino],
          ['Data da matrícula', (l) => dataBR(l.data_matricula)], ['Observação', (l) => l.obs]], d.matriculas)}
        ${tab('Documentos entregues', [['Ano', (l) => l.ano], ['Documento', (l) => l.documento], ['Entregue', (l) => sim(l.entregue)],
          ['Data', (l) => dataBR(l.data_entrega)]], d.documentos_entregues.filter((l) => l.entregue))}
        ${tab('Atividades extras', [['Ano', (l) => l.ano], ['Atividade', (l) => l.atividade], ['Inscrição', (l) => dataBR(l.data_inscricao)],
          ['Parcelas', (l) => `${l.parcelas || '?'}x ${l.valor_parcela != null ? 'R$ ' + moeda(l.valor_parcela) : ''}`], ['Situação', (l) => l.status]], d.atividades_extras)}
        ${tab('Bolsa de estudos', [['Ano', (l) => l.ano], ['Tipo', (l) => l.tipo], ['Etapa', (l) => l.status], ['Ofertado', (l) => (l.ofertado != null ? l.ofertado + '%' : '')],
          ['Aprovado', (l) => (l.aprovado != null ? l.aprovado + '%' : '')], ['Renda per capita', (l) => (l.per_capita != null ? 'R$ ' + moeda(l.per_capita) : '')]], d.bolsas)}
        ${tab('Quem pode buscar', [['Nome', (l) => titulo(l.nome)], ['Parentesco', (l) => l.parentesco], ['Documento', (l) => l.documento], ['Telefone', (l) => l.telefone]], d.quem_pode_buscar)}
        ${tab('Avisos de saída', [['Data', (l) => dataBR(l.data)], ['Quem buscou', (l) => titulo(l.quem)], ['Parentesco', (l) => l.parentesco], ['Como avisaram', (l) => l.canal]], d.avisos_de_saida)}
        ${tab('Atendimentos', [['Data', (l) => dataBR(l.data)], ['Canal', (l) => l.canal], ['Quem procurou', (l) => titulo(l.pessoa)],
          ['Assunto', (l) => l.assunto], ['Resolvido', (l) => sim(l.resolvido)]], d.atendimentos)}
        ${tab('Documentos emitidos', [['Quando', (l) => dataBR(l.quando)], ['Documento', (l) => l.tipo], ['Emitido por', (l) => l.usuario]], d.documentos_emitidos)}
        ${tab('Boletos entregues', [['Remessa', (l) => l.remessa], ['Entregue em', (l) => dataBR(l.entregue_em)], ['Recebido por', (l) => titulo(l.recebido_por)]], d.boletos_entregues)}
        ${d.foto ? `<h3 class="sec">Foto</h3><div class="grade-dados">${dado('Foto tirada', sim(d.foto.tirada))}${dado('Data', dataBR(d.foto.data_foto))}
          ${dado('Inserida no ACADESC', sim(d.foto.acadesc))}${dado('Inserida na SED', sim(d.foto.sed))}${dado('Inserida no Lanche Card', sim(d.foto.lanche))}</div>` : ''}
        ${tab('Excluídos, ainda na lixeira', [['Excluído em', (l) => dataBR(l.excluido_em)], ['O quê', (l) => l.tipo], ['Descrição', (l) => titulo(l.rotulo || '')], ['Por', (l) => l.usuario]], d.na_lixeira || [])}
        ${v.tudo ? tab('Quem consultou esta ficha', [['Data', (l) => dataBR(l.data)], ['Pessoa', (l) => l.usuario], ['Vezes', (l) => l.vezes]], d.quem_consultou) : ''}
        ${v.tudo ? tab('Alterações registradas', [['Quando', (l) => new Date(l.quando).toLocaleString('pt-BR')], ['Pessoa', (l) => l.usuario], ['O que foi feito', (l) => l.acao]], d.alteracoes) : ''}
        <p class="nota">Relatório gerado pelo sistema da secretaria em ${new Date(d.gerado_em).toLocaleString('pt-BR')} por ${esc(d.gerado_por)}.
          Os dados são tratados para a execução do contrato educacional e para o cumprimento de obrigações legais da escola.
          Para corrigir, atualizar ou solicitar a eliminação de algum dado, procure a secretaria.</p>
        <div class="assinatura">Secretaria Escolar</div>`);
    },
    emissao: (v, d) => ({ tipo: 'Relatório de dados pessoais (LGPD)', alunos: [d.cadastro.id], descricao: v.solicitante || '' }),
  },
  fechamento: {
    nome: 'Relatório de fechamento',
    carregar: async () => api('GET', '/api/relatorios?ano=' + encodeURIComponent(P.get('ano') || '')),
    campos: ({ ano }) => [
      { id: 'titulo', rot: 'Título', valor: `RELATÓRIO DA SECRETARIA — ${ano}` },
      { id: 'para', rot: 'Destinatário', valor: 'À Direção e à mantenedora (OASE)' },
      { id: 'assinante', rot: 'Assina', valor: 'Secretaria Escolar' },
      { id: 'data', rot: 'Data', tipo: 'date', valor: hojeIso() },
      { id: 'obs', rot: 'Observações finais', tipo: 'textarea', valor: '' },
    ],
    aviso: 'Este é o retrato do ano em uma folha. Confira os números e leve impresso à reunião.',
    render: (v, d) => {
      const r = d.rematricula, a = d.alunos, at = d.atendimentos;
      const linha = (rot, valor, det = '') => `<tr><td>${esc(rot)}</td><td class="n"><b>${esc(valor)}</b></td><td style="font-size:8.5pt">${esc(det)}</td></tr>`;
      const bloco = (titulo2, linhas) => `<h3 class="sec">${esc(titulo2)}</h3><table class="doc" style="font-size:9.5pt"><tbody>${linhas.join('')}</tbody></table>`;
      const canais = { balcao: 'Balcão', telefone: 'Telefone', whatsapp: 'WhatsApp', email: 'E-mail' };
      const pc = (n, t) => (t ? Math.round((100 * n) / t) + '%' : '—');
      return folha(`${TIMBRE}<p class="local-data">Ferraz de Vasconcelos, ${dataExtenso(v.data)}.</p>
        <p class="inep">Código no INEP ${esc(d.escola.inep)}<br>${esc(v.para)}</p>
        <h2 class="titulo-doc" style="font-size:14pt">${esc(v.titulo)}</h2>
        <div class="duas-colunas">
          ${bloco('Alunos', [
            linha('Alunos ativos', a.ativos),
            ...Object.entries(a.por_segmento).map(([s, n]) => linha('• ' + s, n, pc(n, a.ativos) + ' do total')),
            linha('Alunos novos em ' + d.ano, a.novos),
            linha('Concluintes (3ª série EM)', a.concluintes),
            linha('Filhos de funcionários', a.filhos_funcionarios, 'isentos de mensalidade'),
          ])}
          ${bloco('Matrícula ' + d.ano, [
            linha('Veteranos a rematricular', r.veteranos),
            linha('Rematrículas concluídas', r.concluidas, r.percentual + '% dos veteranos'),
            linha('Em andamento', r.reservada || 0),
            linha('Não iniciadas', r.pendente || 0),
            linha('Não renovam / transferidos', (r.nao_renova || 0) + (r.transferido || 0)),
            linha('Interessados no SIG', d.interessados.total, d.interessados.matriculados + ' matriculados'),
          ])}
          ${bloco('Atendimento às famílias (' + at.ano + ')', [
            linha('Atendimentos registrados', at.total),
            ...at.por_canal.map(([k, n]) => linha('• ' + (canais[k] || k), n, pc(n, at.total))),
            linha('Resolvidos na hora', at.resolvidos, pc(at.resolvidos, at.total)),
            linha('Mês mais movimentado', at.pico.mes, at.pico.n + ' atendimentos'),
            linha('Documentos emitidos', d.documentos.emitidos, 'declarações, termos e listas'),
          ])}
          ${bloco('Financeiro', [
            linha('Alunos com boleto em ' + d.boletos.ano, d.boletos.matriculados),
            linha('Descontos conferidos', d.boletos.conferidos, pc(d.boletos.conferidos, d.boletos.matriculados)),
            linha('Já lançados no ACADESC', d.boletos.lancados),
            linha('Inscrições em atividades extras', d.extras.inscricoes_ativas, 'R$ ' + moeda(d.extras.receita_mensal) + '/mês'),
            linha('Inscrições canceladas', d.extras.canceladas),
          ])}
          ${bloco('Bolsas de estudo (CEBAS ' + d.bolsas.ano + ')', [
            linha('Processos abertos', d.bolsas.total),
            linha('Bolsas concedidas', d.bolsas.concedidas),
            linha('• de 100%', d.bolsas.cem_por_cento),
            linha('• de 50%', d.bolsas.cinquenta),
            linha('Contratos assinados', d.bolsas.contratos),
            linha('Prestação de contas', dataBR(d.bolsas.prestacao_contas)),
          ])}
          ${bloco('Organização e cuidado com os dados', [
            linha('Fotos nos 3 sistemas', d.fotos.completos, d.fotos.faltando + ' pendentes'),
            linha('Alunos com autorização de saída', d.saida.alunos_com_autorizado, d.saida.autorizados + ' pessoas autorizadas'),
            linha('Avisos de saída no ano', d.saida.avisos_ano),
            linha('Lembretes do calendário cumpridos', `${d.equipe.lembretes_concluidos}/${d.equipe.lembretes_total}`),
            linha('Tarefas do dia concluídas', d.equipe.tarefas_concluidas),
            linha('Fichas de ex-alunos anonimizadas', a.anonimizados, 'descarte previsto na LGPD'),
          ])}
        </div>
        ${v.obs ? `<h3 class="sec">Observações</h3><p style="font-size:10pt;text-align:justify">${esc(v.obs)}</p>` : ''}
        <p class="nota">Números extraídos do sistema da secretaria em ${dataBR(d.gerado_em)}. Os dados de alunos e famílias
          ficam restritos à secretaria e são tratados conforme a LGPD.</p>
        <div class="assinatura">${esc(v.assinante)}</div>`);
    },
    emissao: () => ({ tipo: 'Relatório de fechamento', alunos: [null] }),
  },
};

// Turmas disponíveis numa lista de alunos, na ordem em que o servidor mandou
function turmasDe(lista) {
  const vistas = new Map();
  for (const l of lista) if (!vistas.has(l.turma_rotulo)) vistas.set(l.turma_rotulo, l.ordem ?? 99);
  return [...vistas.entries()].sort((a, b) => a[1] - b[1] || String(a[0]).localeCompare(String(b[0]))).map(([t]) => [t, t]);
}
function grupoPorTurma(lista) {
  const g = new Map();
  for (const l of lista) {
    if (!g.has(l.turma_rotulo)) g.set(l.turma_rotulo, []);
    g.get(l.turma_rotulo).push(l);
  }
  // Na ordem das séries (Maternal → 3ª EM), e não na ordem alfabética dos alunos
  const ordem = (itens) => Math.min(...itens.map((x) => x.ordem ?? 99));
  return [...g.entries()].sort((a, b) => ordem(a[1]) - ordem(b[1]) || String(a[0]).localeCompare(String(b[0])));
}

function termoCancelamento(tituloDoc, acao, comMatricula, extra) {
  return {
    nome: tituloDoc.charAt(0) + tituloDoc.slice(1).toLowerCase(),
    carregar: alunosDaUrl,
    campos: ({ alunos: [a] }) => [
      { id: 'resp', rot: 'Responsável', tipo: 'select', opcoes: respOpcoes(a), valor: titulo(a.nome_resp || a.nome_mae || a.nome_pai), livre: true },
      { id: 'rg', rot: 'RG do responsável', valor: a.rg_resp || '' }, { id: 'cpf', rot: 'CPF do responsável', valor: a.cpf_resp || '' },
      { id: 'aluno', rot: 'Aluno', valor: a.nome.toUpperCase() }, { id: 'serie', rot: 'Ano/série', valor: a.turma_rotulo }, { id: 'mat', rot: 'Nº de matrícula', valor: a.mat || '' },
      ...(extra ? [{ id: 'atividade', rot: 'Atividade', tipo: 'select', opcoes: [...new Set(a.inscricoes.map((i) => i.atividade))].map((x) => [x, x]).concat([['', '(marcar à mão)']]), valor: P.get('atividade_nome') || a.inscricoes[0]?.atividade || '' }] : []),
      { id: 'motivo', rot: 'Motivo (deixe em branco para o responsável escrever)', tipo: 'textarea', valor: P.get('motivo') || '' },
      { id: 'datado', rot: 'Já preencher a data de hoje', tipo: 'checkbox', valor: true },
    ],
    render: (v) => {
      const hoje = new Date();
      const linhasMotivo = v.motivo ? `<p class="sem-recuo" style="border-bottom:1px solid #000;padding-bottom:4px">${esc(v.motivo)}</p>` : '<div class="linhas-motivo"></div>'.repeat(5);
      const ativ = ['Recreação', 'Bilíngue', 'Judô', 'Ballet', 'Futsal', 'Vôlei', 'Violão', 'Xadrez'];
      return folha(`${TIMBRE}<h2 class="titulo-doc" style="font-size:13pt">${esc(tituloDoc)}</h2><div class="corpo">
        <p>Eu, <b>${esc(v.resp)}</b>, RG: ${esc(v.rg) || '____________________'}, CPF: ${esc(v.cpf) || '____________________'}, responsável pelo(a) aluno(a) <b>${esc(v.aluno)}</b>,
        matriculado(a) no ano/série ${esc(v.serie)}${comMatricula ? ` sob o número ${esc(v.mat) || '________'}` : ''}, solicito o ${esc(acao)} no referido ano pelos motivos de:</p>
        ${extra ? `<p class="sem-recuo">${ativ.map((x) => `<span class="check">(${v.atividade && v.atividade.toLowerCase().includes(x.toLowerCase().slice(0, 4)) ? '&nbsp;X&nbsp;' : '&nbsp;&nbsp;&nbsp;'}) ${x}</span>`).join('')}
          ${v.atividade && !ativ.some((x) => v.atividade.toLowerCase().includes(x.toLowerCase().slice(0, 4))) ? `<span class="check">( X ) ${esc(v.atividade)}</span>` : ''}</p>` : ''}
        ${linhasMotivo}
        <p class="sem-recuo" style="margin-top:22px">Ferraz de Vasconcelos, ${v.datado ? `${hoje.getDate()} de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}` : '_____ de ___________________ de ______'}.</p></div>
        <div class="assinatura">Assinatura do responsável</div>
        <div class="protocolo"><b>PROTOCOLO</b><br>CIENTE: ______/______/_______.</div>
        <div class="assinatura" style="margin-top:40px">Assinatura e carimbo da escola</div>
        ${comMatricula ? '<p class="nota">Senhores responsáveis, o cancelamento dos boletos no nosso sistema ACADESC é realizado de imediato no ato do cancelamento. Na instituição financeira, os boletos são cancelados automaticamente após 30 dias do seu vencimento, sem prejuízo.</p>' : ''}`);
    },
  };
}

// ───────────── Painel e pré-visualização ─────────────
let DEF, DADOS, CAMPOS;

function campoHtml(c) {
  const id = 'c_' + c.id;
  const rot = `<label for="${id}">${esc(c.rot)}</label>`;
  const dica = c.dica ? `<small style="color:var(--aviso-txt)">${esc(c.dica)}</small>` : '';
  switch (c.tipo) {
    case 'select': {
      const ops = c.opcoes.map(([val, txt]) => `<option value="${esc(val)}" ${String(val) === String(c.valor) ? 'selected' : ''}>${esc(txt)}</option>`).join('');
      if (c.livre) return `${rot}<input id="${id}" list="${id}_l" value="${esc(c.valor)}"><datalist id="${id}_l">${ops}</datalist>${dica}`;
      return `${rot}<select id="${id}">${ops}</select>${dica}`;
    }
    case 'textarea': return `${rot}<textarea id="${id}">${esc(c.valor)}</textarea>`;
    case 'checkbox': return `<label class="chk"><input type="checkbox" id="${id}" ${c.valor ? 'checked' : ''}> ${esc(c.rot)}</label>`;
    case 'arquivo': return `${rot}<input type="file" id="${id}" accept=".xlsx,.csv">`;
    case 'pagamentos': return `${rot}<div class="lista-sel" id="${id}"><small>Nenhum arquivo lido ainda.</small></div>`;
    case 'lista': return `${rot}<div class="lista-sel" id="${id}">${c.itens.map(([v, t]) => `<label><input type="checkbox" value="${esc(v)}" checked> ${esc(t)}</label>`).join('')}</div>`;
    case 'lista-cat': return `${rot}<div class="lista-sel" id="${id}">${c.alunos.map((a) => `<label title="${a.tem_foto ? 'com foto' : 'sem foto'}"><input type="checkbox" data-a="${a.id}" checked>
        <input type="text" data-cat="${a.id}" placeholder="cat."> ${esc(titulo(a.nome))} ${a.tem_foto ? '📷' : ''}</label>`).join('')}</div>`;
    default: return `${rot}<input id="${id}" type="${c.tipo || 'text'}" value="${esc(c.valor)}">${dica}`;
  }
}

function lerValores() {
  const v = {};
  for (const c of CAMPOS) {
    const el = $('#c_' + c.id);
    if (c.tipo === 'checkbox') v[c.id] = el.checked;
    else if (c.tipo === 'lista') v[c.id] = $$('input:checked', el).map((i) => +i.value);
    else if (c.tipo === 'pagamentos') v[c.id] = $$('input:checked', el).map((i) => +i.value);
    else if (c.tipo === 'lista-cat') { v[c.id] = {}; $$('[data-a]', el).forEach((i) => { v[c.id][i.dataset.a] = { on: i.checked, cat: $(`[data-cat="${i.dataset.a}"]`, el).value.trim() }; }); }
    else if (c.tipo === 'arquivo') continue;
    else v[c.id] = el.value;
  }
  return v;
}

function atualizar() { $('#previa').innerHTML = DEF.render(lerValores(), DADOS); }

async function iniciar() {
  const tipo = P.get('tipo');
  DEF = DOCS[tipo];
  if (!DEF) { $('#painel').innerHTML = '<p>Documento desconhecido.</p>'; return; }
  document.title = DEF.nome + ' — Secretaria IEL';
  try { DADOS = await DEF.carregar(); } catch (e) { $('#painel').innerHTML = `<h1>${esc(DEF.nome)}</h1><p class="aviso">${esc(e.message)}</p>`; return; }
  // Atenção: em alguns documentos (relatórios) "alunos" é um resumo, não uma lista
  const lista = Array.isArray(DADOS.alunos) ? DADOS.alunos : null;
  if (lista && !lista.length) { $('#painel').innerHTML = `<h1>${esc(DEF.nome)}</h1><p class="aviso">Nenhum aluno encontrado.</p>`; return; }
  CAMPOS = DEF.campos(DADOS);
  const a = lista && lista.length === 1 ? lista[0] : null;
  $('#painel').innerHTML = `<h1>${esc(DEF.nome)}</h1><p class="sub">${a ? esc(titulo(a.nome)) + ' · ' + esc(a.turma_rotulo) : 'Confira os campos e imprima.'}</p>
    ${CAMPOS.map(campoHtml).join('')}${DEF.aviso ? `<p class="aviso">${esc(DEF.aviso)}</p>` : ''}
    <div class="botoes"><button class="btn" id="fechar">Fechar</button><button class="btn pri" id="imprimir">🖨️ Imprimir</button></div>`;
  $('#painel').addEventListener('input', atualizar);
  $('#painel').addEventListener('change', atualizar);
  $('#fechar').onclick = () => window.close();
  $('#imprimir').onclick = async () => {
    const v = lerValores();
    const em = DEF.emissao ? DEF.emissao(v, DADOS) : { tipo: DEF.nome, alunos: [a?.id ?? null] };
    try { await api('POST', '/api/emissoes', { tipo: em.tipo, alunos: em.alunos, descricao: em.descricao || '' }); } catch { /* não impede a impressão */ }
    window.print();
  };
  const arq = CAMPOS.find((c) => c.tipo === 'arquivo');
  if (arq) $('#c_' + arq.id).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const box = $('#c_linhas');
    box.innerHTML = '<small>Lendo…</small>';
    try {
      const r = await api('POST', `/api/documentos/ler-pagamentos?mat=${encodeURIComponent(a.mat)}&arquivo=${encodeURIComponent(f.name)}`, undefined, f);
      DADOS.pagamentos = r.linhas;
      box.innerHTML = r.linhas.length ? r.linhas.map((p, i) => `<label><input type="checkbox" value="${i}" ${p.pagto ? 'checked' : ''}> ${esc(p.descricao)} · ${p.pagto ? 'pago ' + dataBR(p.pagto) : 'em aberto'} · R$ ${moeda(p.valor)}</label>`).join('')
        : '<small>Nenhuma parcela desta matrícula no arquivo.</small>';
    } catch (err) { box.innerHTML = `<small style="color:var(--erro)">${esc(err.message)}</small>`; }
    atualizar();
  };
  atualizar();
}

iniciar();
