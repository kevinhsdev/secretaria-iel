// Secretaria IEL — interface (sem bibliotecas externas: funciona sem internet)
'use strict';

// ───────────── utilitários ─────────────
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dataBR = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const hojeIso = () => new Date().toLocaleDateString('sv-SE');
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\s(De|Da|Do|Dos|Das|E)\s/g, (m) => m.toLowerCase());

let EU = null;
const STATUS = { pendente: 'Não iniciada', reservada: 'Em andamento', concluida: 'Concluída', nao_renova: 'Não vai renovar', transferido: 'Transferido' };
const STATUS_INT = { novo: 'Novo contato', contatado: 'Contatado', visita: 'Visita agendada', matriculado: 'Matriculado', desistiu: 'Desistiu' };
const SITUACAO = { vencida: 'Vencida', vencendo: 'Vence em até 7 dias', no_prazo: 'No prazo', sem_prazo: 'Sem data' };

async function api(metodo, url, corpo, bruto) {
  const op = { method: metodo, headers: { 'X-IEL': '1' } };
  if (bruto) op.body = bruto;
  else if (corpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
  const r = await fetch(url, op);
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login') { EU = null; telaLogin(); throw new Error(dados.erro || 'Sessão expirada'); }
  if (r.status === 428) { telaTrocarSenha(true); throw new Error(dados.erro); }
  if (!r.ok) throw new Error(dados.erro || 'Erro ' + r.status);
  return dados;
}

let toastTimer;
function toast(msg, erro) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); document.body.appendChild(t); }
  t.className = 'toast' + (erro ? ' erro' : '');
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), erro ? 5000 : 2600);
}
const tentar = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

function modal(tituloTxt, corpoHtml, { onAbrir } = {}) {
  const f = document.createElement('div');
  f.className = 'fundo-modal';
  f.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h2><span>${esc(tituloTxt)}</span><button class="x" aria-label="Fechar">×</button></h2>${corpoHtml}</div>`;
  const fechar = () => { f.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); };
  f.addEventListener('click', (e) => { if (e.target === f || e.target.closest('.x') || e.target.closest('[data-fechar]')) fechar(); });
  document.addEventListener('keydown', tecla);
  document.body.appendChild(f);
  onAbrir && onAbrir(f, fechar);
  return { el: f, fechar };
}

// Confirmação dentro da página (sem confirm() do navegador)
function confirmar(msg, textoBtn = 'Confirmar') {
  return new Promise((ok) => {
    modal('Confirmar', `<p>${esc(msg)}</p><div class="rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="sim">${esc(textoBtn)}</button></div>`,
      { onAbrir: (el, fechar) => { $('#sim', el).onclick = () => { fechar(); ok(true); }; el.addEventListener('click', (e) => { if (e.target.closest('[data-fechar]') || e.target === el || e.target.closest('.x')) ok(false); }); } });
  });
}

function preencherModelo(texto, d) {
  return texto.replace(/\{(\w+)\}/g, (m, k) => (d[k] != null && d[k] !== '' ? d[k] : m));
}

function linkWhats(numero, texto) {
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : '';
}

// Janela para escolher modelo, revisar a mensagem e abrir o WhatsApp
async function janelaWhats(dados, modeloPreferido = 0) {
  const modelos = await api('GET', '/api/modelos');
  if (!modelos.length) return toast('Cadastre um modelo de mensagem primeiro', true);
  const opcoes = modelos.map((m, i) => `<option value="${i}" ${i === modeloPreferido ? 'selected' : ''}>${esc(m.titulo)}</option>`).join('');
  modal('Mensagem para ' + (dados.responsavel || 'o responsável'), `
    <div class="campo"><label>Modelo</label><select id="mod">${opcoes}</select></div>
    <div class="campo" style="margin-top:10px"><label>Mensagem (pode editar antes de enviar)</label><textarea id="txt"></textarea></div>
    <div class="campo" style="margin-top:10px"><label>WhatsApp (com DDD)</label><input id="num" value="${esc(dados.whatsapp ? dados.whatsapp.replace(/^55/, '') : '')}" placeholder="11999998888"></div>
    <div class="rodape"><button class="btn" id="copiar">📋 Copiar texto</button><button class="btn zap" id="abrir">Abrir no WhatsApp</button></div>`,
  { onAbrir: (el) => {
    const atualizar = () => { $('#txt', el).value = preencherModelo(modelos[+$('#mod', el).value].texto, dados); };
    $('#mod', el).onchange = atualizar; atualizar();
    $('#copiar', el).onclick = async () => { try { await navigator.clipboard.writeText($('#txt', el).value); toast('Texto copiado'); } catch { $('#txt', el).select(); document.execCommand('copy'); toast('Texto copiado'); } };
    $('#abrir', el).onclick = () => {
      let n = $('#num', el).value.replace(/\D/g, '');
      if (!n) return toast('Informe o número de WhatsApp', true);
      if (n.length <= 11) n = '55' + n;
      window.open(linkWhats(n, $('#txt', el).value), '_blank', 'noopener');
    };
  } });
}

// ───────────── login ─────────────
function telaLogin() {
  document.title = 'Entrar — Secretaria IEL';
  $('#raiz').innerHTML = `
  <div class="login"><form id="f" autocomplete="on">
    <img src="logo.png" alt="Instituto Educacional Luterano">
    <h1>Secretaria IEL</h1><p>Gestão da secretaria escolar</p>
    <div class="campo"><label for="l">Usuário</label><input id="l" name="username" autocomplete="username" required autofocus></div>
    <div class="campo"><label for="s">Senha</label><input id="s" type="password" name="password" autocomplete="current-password" required></div>
    <div class="erro" id="e"></div>
    <button class="btn pri">Entrar</button>
  </form></div>`;
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    try { await api('POST', '/api/login', { login: $('#l').value.trim(), senha: $('#s').value }); iniciar(); }
    catch (e) { $('#e').textContent = e.message; }
  };
}

function telaTrocarSenha(obrigatoria) {
  $('#raiz').innerHTML = `
  <div class="login"><form id="f">
    <img src="logo.png" alt="">
    <h1>Crie sua senha</h1><p>${obrigatoria ? 'Primeiro acesso: troque a senha inicial por uma só sua.' : 'Trocar senha'}</p>
    <div class="campo"><label>Senha atual</label><input id="a" type="password" autocomplete="current-password" required></div>
    <div class="campo"><label>Nova senha (mín. 6 caracteres)</label><input id="n" type="password" autocomplete="new-password" minlength="6" required></div>
    <div class="campo"><label>Repita a nova senha</label><input id="n2" type="password" autocomplete="new-password" required></div>
    <div class="erro" id="e"></div>
    <button class="btn pri">Salvar senha</button>
  </form></div>`;
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    if ($('#n').value !== $('#n2').value) return ($('#e').textContent = 'As senhas não conferem');
    try { await api('POST', '/api/trocar-senha', { atual: $('#a').value, nova: $('#n').value }); toast('Senha alterada!'); iniciar(); }
    catch (e) { $('#e').textContent = e.message; }
  };
}

// ───────────── estrutura ─────────────
const MENU = [
  { rota: '', ic: '🏠', nome: 'Início' },
  { rota: 'alunos', ic: '👩‍🎓', nome: 'Alunos' },
  { sep: 'Matrícula ' },
  { rota: 'rematricula', ic: '📝', nome: 'Rematrícula' },
  { rota: 'pendencias', ic: '📄', nome: 'Pendências', badge: 'pend' },
  { rota: 'interessados', ic: '🤝', nome: 'Interessados (SIG)' },
  { sep: 'Secretaria' },
  { rota: 'documentos', ic: '🖨️', nome: 'Documentos' },
  { rota: 'extras', ic: '🩰', nome: 'Atividades extras' },
  { rota: 'bolsas', ic: '🎓', nome: 'Bolsas (CEBAS)', admin: true },
  { sep: 'Ferramentas' },
  { rota: 'mensagens', ic: '💬', nome: 'Modelos de mensagem' },
  { rota: 'config', ic: '⚙️', nome: 'Configurações', admin: true },
];

async function iniciar() {
  try { EU = await api('GET', '/api/eu'); } catch { return; }
  if (EU.trocar_senha) return telaTrocarSenha(true);
  const ano = EU.config.ano_matricula;
  MENU[2].sep = 'Matrícula ' + ano;
  $('#raiz').innerHTML = `
  <div class="app">
    <nav class="lateral" aria-label="Menu principal">
      <div class="marca"><img src="icone.png" alt=""><div><b>Secretaria IEL</b><small>Instituto Educacional Luterano</small></div></div>
      <ul class="menu">${MENU.filter((m) => !m.admin || EU.perfil === 'admin').map((m) => m.sep ? `<li class="sep">${esc(m.sep)}</li>`
        : `<li><a href="#/${m.rota}" data-rota="${m.rota}"><span class="ic">${m.ic}</span>${esc(m.nome)}${m.badge ? `<span class="num" id="badge-${m.badge}" hidden></span>` : ''}</a></li>`).join('')}</ul>
      <div class="usuario"><span class="av">${esc(EU.nome[0])}</span><span>${esc(EU.nome)}<br><small style="color:var(--azul-claro)">${EU.perfil === 'admin' ? 'Administração' : 'Aprendiz'}</small></span>
        <button id="sair" title="Sair">Sair</button></div>
    </nav>
    <div class="principal">
      <header class="topo">
        <span class="saudacao" id="saudacao"></span>
        <div class="busca"><input id="busca" placeholder="Buscar aluno, responsável, matrícula ou CPF…" autocomplete="off" aria-label="Buscar aluno"><div class="resultados" id="res" hidden></div></div>
      </header>
      <main class="conteudo" id="conteudo"></main>
    </div>
  </div>`;
  const h = new Date().getHours();
  $('#saudacao').textContent = `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}, ${EU.nome.split(' ')[0]}`;
  $('#sair').onclick = tentar(async () => { await api('POST', '/api/logout'); EU = null; telaLogin(); });
  configurarBusca();
  window.onhashchange = rotear;
  rotear();
}

let cacheAlunos = null;
async function alunosBusca() { if (!cacheAlunos) cacheAlunos = await api('GET', '/api/alunos'); return cacheAlunos; }
const invalidar = () => { cacheAlunos = null; };

function configurarBusca() {
  const inp = $('#busca'), res = $('#res');
  let sel = -1;
  const mostrar = async () => {
    const q = norm(inp.value.trim());
    if (q.length < 2) { res.hidden = true; return; }
    const lista = (await alunosBusca()).filter((a) => [a.nome, a.mat, a.nome_mae, a.nome_pai, a.nome_resp, a.cpf].some((v) => norm(v).includes(q))).slice(0, 12);
    sel = -1;
    res.innerHTML = lista.length ? lista.map((a) => `<a href="#/aluno/${a.id}"><b>${esc(titulo(a.nome))}</b><br><small>${esc(a.turma_rotulo)} · Mat. ${esc(a.mat || '—')} · Mãe: ${esc(titulo(a.nome_mae) || '—')}</small></a>`).join('')
      : '<div class="vazio">Nenhum aluno encontrado</div>';
    res.hidden = false;
  };
  inp.oninput = tentar(mostrar);
  inp.onkeydown = (e) => {
    const itens = $$('a', res);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(itens.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); itens.forEach((a, i) => a.classList.toggle('sel', i === sel)); }
    if (e.key === 'Enter' && itens.length) { location.hash = (itens[sel] || itens[0]).getAttribute('href'); fecharBusca(); }
    if (e.key === 'Escape') fecharBusca();
  };
  res.onclick = () => fecharBusca();
  document.addEventListener('click', (e) => { if (!e.target.closest('.busca')) res.hidden = true; });
  function fecharBusca() { res.hidden = true; inp.value = ''; inp.blur(); }
}

const TELAS = {};
async function rotear() {
  const [rota, arg] = location.hash.replace(/^#\/?/, '').split('/');
  $$('.menu a').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === (rota === 'aluno' ? 'alunos' : rota)));
  const c = $('#conteudo');
  c.innerHTML = '<p class="sub">Carregando…</p>';
  try { await (TELAS[rota] || TELAS[''])(c, arg); }
  catch (e) { c.innerHTML = `<div class="cartao"><h2>Ops!</h2><p>${esc(e.message)}</p></div>`; }
  atualizarBadge();
  window.scrollTo(0, 0);
}

async function atualizarBadge() {
  try {
    const p = await api('GET', '/api/painel');
    const b = $('#badge-pend');
    if (b) { const n = p.pendencias.vencidas + p.pendencias.vencendo; b.hidden = !n; b.textContent = n; b.title = 'Vencidas ou vencendo em 7 dias'; }
  } catch { /* silencioso */ }
}

const faixaDemo = (p) => (p.demo ? '<div class="faixa-demo">⚠️ <b>Modo demonstração:</b> os alunos exibidos são fictícios. Para usar dados reais, apague a demonstração e importe o ACADESC em Configurações.</div>' : '');

// ───────────── Início ─────────────
TELAS[''] = async (c) => {
  const p = await api('GET', '/api/painel');
  const cfg = EU.config;
  const s = p.porStatus, v = p.veteranos || 1;
  const pct = (n) => (100 * n / v).toFixed(1) + '%';
  const datas = [
    ['Início das matrículas', cfg.data_inicio], ['Fim do desconto (plantão de sábado)', cfg.data_desconto],
    ['Fim da garantia de vaga', cfg.data_garantia_vaga], ['Encerramento das matrículas', cfg.data_fim],
  ];
  const diasAte = (iso) => Math.round((Date.parse(iso) - Date.parse(hojeIso())) / 86400000);
  c.innerHTML = `${faixaDemo(p)}
  <h1>Painel da secretaria</h1><p class="sub">Matrícula e rematrícula ${p.ano} · ${p.total_alunos} alunos ativos cadastrados</p>
  <div class="grade g4">
    <div class="cartao kpi destaque"><div class="rot">Rematrículas concluídas</div><div class="val">${s.concluida}<small style="font-size:14px;color:var(--texto-2)"> / ${p.veteranos}</small></div><div class="det">${pct(s.concluida)} dos veteranos (sem 3ª série EM)</div></div>
    <div class="cartao kpi"><div class="rot">Em andamento</div><div class="val">${s.reservada}</div><div class="det">pagaram matrícula, falta concluir</div></div>
    <div class="cartao kpi"><div class="rot">Ainda não iniciaram</div><div class="val">${s.pendente}</div><div class="det">famílias para contatar</div></div>
    <div class="cartao kpi ${p.pendencias.vencidas ? 'alerta' : ''}"><div class="rot">Pendências de documentos</div><div class="val">${p.pendencias.total}</div><div class="det">${p.pendencias.vencidas} vencidas · ${p.pendencias.vencendo} vencendo em 7 dias</div></div>
  </div>
  <div class="cartao" style="margin-top:14px">
    <h3>Andamento da rematrícula ${p.ano}</h3>
    <div class="barra" role="img" aria-label="Concluídas ${s.concluida}, em andamento ${s.reservada}, não vão renovar ${s.nao_renova + s.transferido}">
      <i class="b-concl" style="width:${pct(s.concluida)}"></i><i class="b-and" style="width:${pct(s.reservada)}"></i><i class="b-nao" style="width:${pct(s.nao_renova + s.transferido)}"></i></div>
    <div class="legenda"><span><i class="b-concl"></i>Concluídas ${s.concluida}</span><span><i class="b-and"></i>Em andamento ${s.reservada}</span><span><i class="b-nao"></i>Não renovam ${s.nao_renova + s.transferido}</span><span><i style="background:var(--cinza-claro)"></i>Não iniciadas ${s.pendente}</span>
      <span>· Alunos novos matriculados: <b>${p.novos}</b></span><span>· Concluintes (3ª EM): <b>${p.concluintes}</b></span></div>
  </div>
  <div class="grade g2" style="margin-top:14px">
    <div class="cartao"><h3>⚠️ Documentos vencidos ou vencendo</h3>
      ${p.urgentes.length ? `<table><tbody>${p.urgentes.map((u) => `<tr class="clic" data-id="${u.aluno_id}"><td><b>${esc(titulo(u.nome))}</b><br><small class="dado">${esc(u.turma)} · falta: ${esc(u.faltam.join(', '))}</small></td>
        <td class="num-col"><span class="tag t-${u.situacao}">${u.dias == null ? 'sem data' : u.dias < 0 ? `venceu há ${-u.dias}d` : u.dias === 0 ? 'vence hoje' : `em ${u.dias}d`}</span></td></tr>`).join('')}</tbody></table>
        <p style="margin:10px 0 0"><a href="#/pendencias">Ver todas as pendências →</a></p>` : '<p class="vazio">Nenhuma pendência urgente 🎉</p>'}
    </div>
    <div class="cartao"><h3>📅 Datas da campanha ${p.ano}</h3><div class="datas">
      ${datas.map(([rot, d]) => { const n = diasAte(d); return `<div class="data-item ${n < 0 ? 'passou' : ''}"><span>${esc(rot)}</span><span><b>${dataBR(d)}</b> ${n > 0 ? `· ${n === 1 ? 'falta' : 'faltam'} ${plural(n, 'dia', 'dias')}` : n === 0 ? '· hoje' : ''}</span></div>`; }).join('')}
      </div>
      <h3 style="margin-top:16px">🤝 Interessados (SIG)</h3>
      <div class="kanban-mini">${Object.entries(STATUS_INT).map(([k, r]) => `<span class="tag t-${k === 'matriculado' ? 'concluida' : k === 'desistiu' ? 'nao_renova' : 'novo'}">${r}: ${p.interessados[k] || 0}</span>`).join('')}</div>
    </div>
  </div>`;
  $$('tr[data-id]', c).forEach((tr) => (tr.onclick = () => (location.hash = '#/aluno/' + tr.dataset.id)));
};

// ───────────── Alunos ─────────────
TELAS.alunos = async (c) => {
  invalidar();
  const lista = await alunosBusca();
  const turmas = [...new Map(lista.map((a) => [a.turma_rotulo, a.ordem])).entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map((t) => t[0]);
  c.innerHTML = `
  <div class="acoes" style="justify-content:space-between"><div><h1>Alunos</h1><p class="sub">${lista.length} alunos ativos</p></div>
    <button class="btn ama" id="novo">＋ Cadastrar aluno novo ${esc(EU.config.ano_matricula)}</button></div>
  <div class="filtros">
    <input id="q" placeholder="Filtrar por nome, mãe, pai, matrícula…" style="flex:1;min-width:220px">
    <select id="t"><option value="">Todas as turmas</option>${turmas.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
    <select id="s"><option value="">Qualquer situação</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <label><input type="checkbox" id="nv"> Só alunos novos</label>
  </div>
  <div class="cartao tabela-wrap" style="padding:0"><table><thead><tr><th>Mat.</th><th>Aluno</th><th>Turma ${Number(EU.config.ano_matricula) - 1}</th><th>Vai para</th><th>Rematrícula</th><th>Responsável</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const desenhar = () => {
    const q = norm($('#q').value), t = $('#t').value, s = $('#s').value, nv = $('#nv').checked;
    const f = lista.filter((a) => (!q || [a.nome, a.mat, a.nome_mae, a.nome_pai, a.nome_resp].some((v) => norm(v).includes(q))) && (!t || a.turma_rotulo === t) && (!s || a.status === s) && (!nv || a.novo));
    $('#tb').innerHTML = f.length ? f.map((a) => `<tr class="clic" data-id="${a.id}"><td class="mono">${esc(a.mat || '—')}</td><td><b>${esc(titulo(a.nome))}</b> ${a.novo ? '<span class="tag t-novo">novo</span>' : ''}</td>
      <td>${esc(a.novo ? '—' : a.turma_rotulo)}</td><td>${esc(a.destino)}</td><td><span class="tag t-${a.status}">${STATUS[a.status]}</span></td><td>${esc(titulo(a.nome_resp || a.nome_mae || ''))}</td></tr>`).join('')
      : '<tr><td colspan="6" class="vazio">Nenhum aluno com esses filtros</td></tr>';
    $$('tr[data-id]').forEach((tr) => (tr.onclick = () => (location.hash = '#/aluno/' + tr.dataset.id)));
  };
  ['q', 't', 's', 'nv'].forEach((id) => ($('#' + id).oninput = desenhar));
  desenhar();
  $('#novo').onclick = () => formAluno();
};

function formAluno(a) {
  const novo = !a;
  a = a || {};
  const opSerie = (window.__series || []).map((s) => `<option value="${s.chave}" ${a.serie_chave === s.chave ? 'selected' : ''}>${esc(s.rotulo)}</option>`).join('');
  const campo = (id, rot, tipo = 'text') => `<div class="campo"><label>${rot}</label><input id="f_${id}" type="${tipo}" value="${esc(a[id] ?? '')}"></div>`;
  modal(novo ? 'Cadastrar aluno novo' : 'Editar dados do aluno', `
    <form id="fa"><div class="campos">
      ${campo('nome', 'Nome completo do aluno *')}${campo('mat', 'Matrícula (ACADESC)')}
      <div class="campo"><label>${novo ? 'Série que vai cursar *' : 'Série atual'}</label><select id="f_serie_chave">${opSerie}</select></div>
      ${campo('turma', 'Turma (A, B…)')}${campo('dt_nasc', 'Data de nascimento', 'date')}${campo('cpf', 'CPF do aluno')}
      ${campo('nome_mae', 'Nome da mãe')}${campo('cel_mae', 'Celular da mãe')}${campo('email_mae', 'E-mail da mãe', 'email')}
      ${campo('nome_pai', 'Nome do pai')}${campo('cel_pai', 'Celular do pai')}${campo('email_pai', 'E-mail do pai', 'email')}
      ${campo('nome_resp', 'Responsável financeiro')}${campo('cpf_resp', 'CPF do responsável')}${campo('rg_resp', 'RG do responsável')}
      ${campo('telefone', 'Outro telefone')}${campo('ra', 'R.A. (SED)')}${campo('rg', 'RG do aluno')}
      ${campo('endereco', 'Endereço')}${campo('bairro', 'Bairro')}${campo('cidade', 'Cidade')}${campo('cep', 'CEP')}
    </div>
    ${novo ? '<div class="dica">Aluno novo: lembre de fazer a consulta SPC/SERASA e de cadastrá-lo também no ACADESC. Depois de importar o ACADESC, os dados serão atualizados pela matrícula.</div>' : ''}
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Salvar</button></div></form>`,
  { onAbrir: (el, fechar) => {
    $('#fa', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      const b = {};
      ['nome', 'mat', 'serie_chave', 'turma', 'dt_nasc', 'cpf', 'nome_mae', 'cel_mae', 'email_mae', 'nome_pai', 'cel_pai', 'email_pai', 'nome_resp', 'telefone',
        'cpf_resp', 'rg_resp', 'ra', 'rg', 'endereco', 'bairro', 'cidade', 'cep'].forEach((k) => { b[k] = $('#f_' + k, el).value.trim(); });
      if (novo) {
        const r = await api('POST', '/api/alunos', b);
        await api('PUT', `/api/alunos/${r.id}/rematricula`, { status: 'reservada' });
        fechar(); invalidar(); toast('Aluno cadastrado'); location.hash = '#/aluno/' + r.id;
      } else {
        delete b.mat;
        await api('PUT', '/api/alunos/' + a.id, b);
        fechar(); invalidar(); toast('Dados salvos'); rotear();
      }
    });
  } });
}

// Lista de séries (vem junto da ficha; guardamos para o formulário de aluno novo)
window.__series = [
  ['MAT', 'Maternal'], ['JD1', 'Jardim I'], ['JD2', 'Jardim II'], ...[1, 2, 3, 4, 5].map((n) => ['F' + n, `${n}º Ano Fund. I`]),
  ...[6, 7, 8, 9].map((n) => ['F' + n, `${n}º Ano Fund. II`]), ...[1, 2, 3].map((n) => ['EM' + n, `${n}ª Série EM`]),
].map(([chave, rotulo]) => ({ chave, rotulo }));

// ───────────── Ficha do aluno ─────────────
TELAS.aluno = async (c, id) => {
  const f = await api('GET', '/api/alunos/' + id);
  const a = f.aluno, r = f.rematricula, ano = EU.config.ano_matricula;
  const obrig = f.docs.filter((d) => d.obrigatorio);
  const faltam = obrig.filter((d) => !d.entregue);
  const matriculado = ['reservada', 'concluida'].includes(r.status);
  const diasPrazo = f.prazo ? Math.round((Date.parse(f.prazo) - Date.parse(hojeIso())) / 86400000) : null;
  const sit = diasPrazo == null ? '' : diasPrazo < 0 ? 'vencida' : diasPrazo <= 7 ? 'vencendo' : 'no_prazo';
  const dadosMsg = {
    aluno: titulo(a.nome), responsavel: titulo((a.nome_resp || a.nome_mae || a.nome_pai || '').split(' ')[0]), serie: a.turma_rotulo,
    serie_destino: f.destino?.rotulo || '', documentos: faltam.map((d) => d.nome).join(', '), prazo: f.prazo ? dataBR(f.prazo) : '(a combinar)', whatsapp: a.whatsapp,
  };
  const dado = (rot, v) => `<div class="dado">${rot}<b>${esc(v || '—')}</b></div>`;
  c.innerHTML = `
  <p class="nao-imprimir" style="margin:0 0 10px"><a href="#/alunos">← Alunos</a></p>
  <div class="ficha-topo">
    <div class="info"><h1>${esc(titulo(a.nome))} ${a.novo ? '<span class="tag t-novo">aluno novo</span>' : ''} ${a.filho_funcionario ? '<span class="tag t-func">filho(a) de funcionário</span>' : ''} ${a.demo ? '<span class="tag t-demo">fictício</span>' : ''}</h1>
      <p class="sub" style="margin:0">Mat. <b class="mono">${esc(a.mat || '—')}</b> · ${a.novo ? 'Ingresso ' + ano : esc(a.turma_rotulo) + (a.turno ? ` (${a.turno === 'M' ? 'manhã' : 'tarde'})` : '')} → <b>${esc(f.destino?.rotulo || '?')}</b> em ${ano}</p></div>
    <div class="acoes">
      <a class="btn pri" href="/api/alunos/${a.id}/contrato" id="btnContrato">📄 Gerar contrato ${ano}</a>
      <button class="btn zap" id="btnZap">💬 WhatsApp</button>
      <button class="btn" id="btnPasta">📁 Abrir pasta</button>
      <button class="btn" id="btnEditar">✏️ Editar</button>
    </div>
  </div>
  <div class="grade g2">
    <div class="cartao">
      <h2>Rematrícula ${ano}</h2>
      <div class="status-btns" id="stb">${Object.entries(STATUS).map(([k, v]) => `<button data-st="${k}" class="${r.status === k ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="campos" style="margin-top:14px">
        <div class="campo"><label>Série em ${ano}</label><select id="dest">${f.opcoes_serie.map((s) => `<option value="${s.chave}" ${f.destino?.chave === s.chave ? 'selected' : ''}>${esc(s.rotulo)}</option>`).join('')}</select></div>
        <div class="campo"><label>Data da matrícula</label><input type="date" id="dtm" value="${esc(r.data_matricula || '')}" ${matriculado ? '' : 'disabled'}></div>
        ${a.novo ? `<div class="campo"><label>Consulta SPC/SERASA</label><select id="spc"><option value="">Não consultado</option>${['Nada consta', 'Com restrição'].map((o) => `<option ${r.spc === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>` : ''}
      </div>
      <div class="campo" style="margin-top:12px"><label>Observações da rematrícula</label><input id="robs" value="${esc(r.obs || '')}" placeholder="Ex.: pediu para pagar dia 15; aguardando pai assinar…"></div>
      ${matriculado ? `<p style="margin:12px 0 0">Prazo para documentos: <b>${dataBR(f.prazo)}</b> ${sit ? `<span class="tag t-${sit}">${diasPrazo < 0 ? `venceu há ${plural(-diasPrazo, 'dia', 'dias')}` : diasPrazo === 0 ? 'vence hoje' : `${diasPrazo === 1 ? 'falta' : 'faltam'} ${plural(diasPrazo, 'dia', 'dias')}`}</span>` : ''}</p>` : '<p class="dica">Quando a família pagar a matrícula, clique em <b>Em andamento</b>. O prazo de ' + esc(EU.config.prazo_dias) + ' dias para os documentos começa a contar nesse dia.</p>'}
      ${r.atualizado_por ? `<p class="dado" style="margin-top:10px">Última alteração por ${esc(r.atualizado_por)} em ${dataBR(r.atualizado_em)}</p>` : ''}
    </div>
    <div class="cartao">
      <div class="acoes" style="justify-content:space-between"><h2 style="margin:0">Documentos ${ano}</h2>
        <span class="tag ${faltam.length ? 't-vencendo' : 't-concluida'}">${faltam.length ? (faltam.length === 1 ? 'falta 1 obrigatório' : `faltam ${faltam.length} obrigatórios`) : 'completo ✓'}</span></div>
      <ul class="checklist" id="docs">${f.docs.map((d) => `<li class="${d.entregue ? 'ok' : ''}">
        <input type="checkbox" data-doc="${d.id}" ${d.entregue ? 'checked' : ''} aria-label="${esc(d.nome)}">
        <span class="nome"><span>${esc(d.nome)}</span> ${d.obrigatorio ? '' : '<span class="opcional">opcional</span>'}
          <small>${d.entregue ? `Entregue em ${dataBR(d.data_entrega)}${d.atualizado_por ? ' · ' + esc(d.atualizado_por) : ''}` : d.arquivo ? `PDF: <span class="mono">${esc(d.arquivo)}.pdf</span>` : ''}</small></span>
        ${d.pdf ? '<span class="pdf-ok" title="Arquivo encontrado na pasta do prontuário">PDF na pasta ✓</span>' : ''}</li>`).join('')}</ul>
      <div class="acoes" style="margin-top:12px"><button class="btn peq" id="pelosPdfs">🔎 Marcar pelos PDFs da pasta</button>
        ${faltam.length && a.whatsapp !== undefined ? '<button class="btn peq zap" id="cobrar">Cobrar documentos no WhatsApp</button>' : ''}</div>
      <p class="dado" style="margin-top:10px">Pasta do prontuário: ${f.pastas.length ? f.pastas.map((p) => `<span class="mono">${esc(p.turma)}\\${esc(titulo(a.nome))}</span> (${p.arquivos.length} PDFs)`).join(', ') : '<b>nenhuma pasta encontrada com o nome do aluno</b>'}</p>
    </div>
  </div>
  <div class="cartao" style="margin-top:14px"><h2>Dados e contatos</h2>
    <div class="campos">
      ${dado('Nascimento', dataBR(a.dt_nasc))}${dado('CPF do aluno', a.cpf)}${dado('NIS', a.nis)}
      ${dado('Mãe', titulo(a.nome_mae))}${dado('Celular da mãe', a.cel_mae || a.tel_mae)}${dado('E-mail da mãe', a.email_mae)}
      ${dado('Pai', titulo(a.nome_pai))}${dado('Celular do pai', a.cel_pai || a.tel_pai)}${dado('E-mail do pai', a.email_pai)}
      ${dado('Responsável financeiro', titulo(a.nome_resp))}${dado('Telefone', a.telefone)}${dado('E-mail', a.email)}
      ${dado('CPF do responsável', a.cpf_resp)}${dado('RG do responsável', a.rg_resp)}${dado('R.A. / RG do aluno', [a.ra, a.rg].filter(Boolean).join(' · '))}
      ${dado('Endereço', [a.endereco, a.bairro, a.cidade, a.cep].filter(Boolean).join(' · '))}
    </div></div>
  <div id="fichaEtapa2"></div>
  ${f.historico.length ? `<div class="cartao" style="margin-top:14px"><h2>Histórico</h2><table><tbody>${f.historico.map((h) => `<tr><td class="dado" style="width:150px">${new Date(h.quando).toLocaleString('pt-BR')}</td><td>${esc(h.usuario)}</td><td>${esc(h.acao)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;

  const salvarRem = tentar(async (corpo) => { await api('PUT', `/api/alunos/${a.id}/rematricula`, corpo); invalidar(); toast('Rematrícula atualizada'); rotear(); });
  $$('#stb button').forEach((b) => (b.onclick = () => salvarRem({ status: b.dataset.st })));
  $('#dest').onchange = (e) => salvarRem({ serie_destino: e.target.value });
  $('#dtm').onchange = (e) => e.target.value && salvarRem({ status: r.status, data_matricula: e.target.value });
  $('#robs').onchange = (e) => salvarRem({ obs: e.target.value });
  if ($('#spc')) $('#spc').onchange = (e) => salvarRem({ spc: e.target.value });
  $$('#docs input[type=checkbox]').forEach((cb) => (cb.onchange = tentar(async () => {
    await api('PUT', `/api/alunos/${a.id}/documentos/${cb.dataset.doc}`, { entregue: cb.checked });
    toast(cb.checked ? 'Marcado como entregue' : 'Desmarcado'); rotear();
  })));
  $('#pelosPdfs').onclick = tentar(async () => {
    const r2 = await api('POST', `/api/alunos/${a.id}/documentos/pelos-pdfs`);
    toast(r2.marcados.length ? 'Marcados: ' + r2.marcados.join(', ') : 'Nenhum PDF padronizado encontrado para marcar'); rotear();
  });
  if ($('#cobrar')) $('#cobrar').onclick = tentar(() => janelaWhats(dadosMsg, 0));
  $('#btnZap').onclick = tentar(() => janelaWhats(dadosMsg, faltam.length && matriculado ? 0 : r.status === 'concluida' ? 2 : 1));
  $('#btnPasta').onclick = tentar(async () => { const r2 = await api('POST', `/api/alunos/${a.id}/abrir-pasta`); toast('Abrindo ' + r2.pasta); });
  $('#btnEditar').onclick = () => formAluno(a);
  if (window.fichaEtapa2) window.fichaEtapa2($('#fichaEtapa2'), a, f).catch((e) => toast(e.message, true));
  $('#btnContrato').onclick = async (e) => {
    e.preventDefault();
    try {
      const resp = await fetch(`/api/alunos/${a.id}/contrato`);
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).erro || 'Erro ao gerar contrato');
      const blob = await resp.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `CONTRATO EDUCACIONAL ${ano} - ${titulo(a.nome)}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      toast('Contrato gerado! Abra no Excel, confira e imprima.');
    } catch (err) { toast(err.message, true); }
  };
};

// ───────────── Rematrícula ─────────────
TELAS.rematricula = async (c) => {
  const [dados, lista] = await Promise.all([api('GET', '/api/rematricula'), (invalidar(), alunosBusca())]);
  c.innerHTML = `<h1>Rematrícula ${dados.ano}</h1><p class="sub">Por série que o aluno vai cursar em ${dados.ano}. Clique numa série para ver os alunos.</p>
  <div class="grade g4" id="series">${dados.grupos.map((g) => {
    const ocup = g.reservada + g.concluida;
    const base = g.capacidade || ocup + g.pendente || 1;
    const p = (n) => Math.min(100, (100 * n) / base).toFixed(1) + '%';
    return `<div class="cartao kpi clic" data-serie="${g.chave}" style="cursor:pointer" tabindex="0">
      <div class="rot">${esc(g.rotulo)}</div>
      <div class="val" style="font-size:22px">${ocup}${g.capacidade ? `<small style="font-size:13px;color:var(--texto-2)"> / ${g.capacidade} vagas</small>` : ''}</div>
      <div class="det">${g.concluida} concluídas · ${g.reservada} em andamento · ${g.pendente} a contatar${g.novos ? ` · ${g.novos} novos` : ''}</div>
      <div class="barra"><i class="b-concl" style="width:${p(g.concluida)}"></i><i class="b-and" style="width:${p(g.reservada)}"></i></div>
      ${g.capacidade && ocup > g.capacidade ? '<div class="det" style="color:var(--vermelho);margin-top:6px">⚠️ acima da capacidade</div>' : ''}
    </div>`;
  }).join('')}</div>
  ${EU.perfil === 'admin' ? '<p class="dado" style="margin-top:8px">As vagas por série são definidas em Configurações › Vagas (copie da planilha de controle do Google).</p>' : ''}
  <div class="cartao" style="margin-top:16px">
    <div class="filtros"><h2 style="margin:0;flex:1" id="tl">Todos os alunos</h2>
      <select id="fs"><option value="">Qualquer situação</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <button class="btn peq" id="todas">Mostrar todas as séries</button></div>
    <div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Turma atual</th><th>Vai para</th><th>Situação</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>
  </div>`;
  let serie = '';
  const rotulos = Object.fromEntries(dados.grupos.map((g) => [g.chave, g.rotulo]));
  const desenhar = () => {
    const fs = $('#fs').value;
    $('#tl').textContent = serie ? 'Vão para ' + rotulos[serie] : 'Todos os alunos';
    const f = lista.filter((a) => (!serie || a.destino === rotulos[serie]) && (!fs || a.status === fs) && a.destino && !a.destino.startsWith('Concluinte'));
    $('#tb').innerHTML = f.length ? f.map((a) => `<tr><td><a href="#/aluno/${a.id}"><b>${esc(titulo(a.nome))}</b></a> ${a.novo ? '<span class="tag t-novo">novo</span>' : ''}</td>
      <td>${esc(a.novo ? '—' : a.turma_rotulo)}</td><td>${esc(a.destino)}</td>
      <td><select data-id="${a.id}" aria-label="Situação">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${a.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td><span class="tag t-${a.status}">${STATUS[a.status]}</span></td></tr>`).join('') : '<tr><td colspan="5" class="vazio">Nenhum aluno</td></tr>';
    $$('#tb select').forEach((s) => (s.onchange = tentar(async () => {
      await api('PUT', `/api/alunos/${s.dataset.id}/rematricula`, { status: s.value });
      const al = lista.find((x) => x.id === +s.dataset.id); al.status = s.value;
      toast('Atualizado: ' + titulo(al.nome)); desenhar();
    })));
  };
  $$('[data-serie]').forEach((el) => (el.onclick = el.onkeydown = (e) => { if (e.type === 'keydown' && e.key !== 'Enter') return; serie = el.dataset.serie; desenhar(); $('#tl').scrollIntoView({ behavior: 'smooth' }); }));
  $('#todas').onclick = () => { serie = ''; desenhar(); };
  $('#fs').onchange = desenhar;
  desenhar();
};

// ───────────── Pendências ─────────────
TELAS.pendencias = async (c) => {
  const lista = await api('GET', '/api/pendencias');
  const ordemTurma = {};
  lista.forEach((p) => { ordemTurma[p.turma] = p.ordem; });
  const porOrdem = (a, b) => ordemTurma[a] - ordemTurma[b] || a.localeCompare(b);
  const turmas = Object.keys(ordemTurma).sort(porOrdem);
  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Pendências de documentos</h1>
    <p class="sub">Alunos (re)matriculados em ${esc(EU.config.ano_matricula)} com documento obrigatório faltando. Prazo: ${esc(EU.config.prazo_dias)} dias após a matrícula.</p></div>
    <button class="btn" id="imp">🖨️ Imprimir lista</button></div>
  <div class="filtros">
    <select id="fs"><option value="">Todas as situações</option>${Object.entries(SITUACAO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <select id="ft"><option value="">Todas as turmas</option>${turmas.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
    <input id="fq" placeholder="Filtrar por nome ou documento…" style="flex:1;min-width:200px">
  </div>
  <div id="corpo"></div>`;
  const desenhar = () => {
    const fs = $('#fs').value, ft = $('#ft').value, q = norm($('#fq').value);
    const f = lista.filter((p) => (!fs || p.situacao === fs) && (!ft || p.turma === ft) && (!q || norm(p.nome + ' ' + p.faltam.join(' ')).includes(q)));
    const grupos = {};
    f.forEach((p) => (grupos[p.turma] ??= []).push(p));
    $('#corpo').innerHTML = f.length ? `<p class="dado nao-imprimir">${f.length} alunos · ${f.filter((p) => p.situacao === 'vencida').length} vencidos</p>` +
      Object.keys(grupos).sort(porOrdem).map((t, i) => `<div class="cartao ${i ? 'quebra' : ''}" style="margin-bottom:12px;padding:0">
        <h3 style="padding:14px 16px 0">${esc(t)} <span class="dado">(${grupos[t].length})</span><span class="so-impressao dado">Instituto Educacional Luterano · Pendências de documentos ${esc(EU.config.ano_matricula)} · impresso em ${dataBR(hojeIso())}</span></h3>
        <div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Documentos faltantes</th><th>Prazo</th><th class="nao-imprimir"></th></tr></thead><tbody>
        ${grupos[t].map((p) => `<tr><td><a href="#/aluno/${p.aluno_id}"><b>${esc(titulo(p.nome))}</b></a>${p.novo ? ' <span class="tag t-novo">novo</span>' : ''}<br><small class="dado">Resp.: ${esc(titulo(p.responsavel))}</small></td>
          <td>${esc(p.faltam.join(', '))}</td>
          <td>${dataBR(p.prazo)} <span class="tag t-${p.situacao}">${p.dias == null ? '' : p.dias < 0 ? `venceu há ${-p.dias}d` : p.dias === 0 ? 'hoje' : `${p.dias}d`}</span></td>
          <td class="nao-imprimir"><button class="btn peq zap" data-zap="${p.aluno_id}">WhatsApp</button></td></tr>`).join('')}
        </tbody></table></div></div>`).join('') : '<div class="cartao vazio">Nenhuma pendência com esses filtros 🎉</div>';
    $$('[data-zap]').forEach((b) => (b.onclick = tentar(() => {
      const p = lista.find((x) => x.aluno_id === +b.dataset.zap);
      return janelaWhats({ aluno: titulo(p.nome), responsavel: titulo(p.responsavel.split(' ')[0]), serie: p.turma, serie_destino: p.destino, documentos: p.faltam.join(', '), prazo: dataBR(p.prazo), whatsapp: p.whatsapp }, 0);
    })));
  };
  ['fs', 'ft', 'fq'].forEach((id) => ($('#' + id).oninput = desenhar));
  $('#imp').onclick = () => window.print();
  desenhar();
};

// ───────────── Interessados (SIG) ─────────────
TELAS.interessados = async (c) => {
  const lista = await api('GET', '/api/interessados');
  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Interessados (SIG)</h1><p class="sub">Primeiro contato das famílias que querem conhecer a escola.</p></div>
    <div class="acoes"><label class="btn">📥 Importar planilha SIG<input type="file" id="arq" accept=".xlsx,.csv" hidden></label><button class="btn ama" id="novo">＋ Novo contato</button></div></div>
  <div class="filtros"><select id="fs"><option value="">Todos</option>${Object.entries(STATUS_INT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <input id="fq" placeholder="Buscar…" style="flex:1;min-width:200px"></div>
  <div class="cartao tabela-wrap" style="padding:0"><table><thead><tr><th>Data</th><th>Aluno</th><th>Série de interesse</th><th>Responsável / contato</th><th>Escola atual</th><th>Situação</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const desenhar = () => {
    const fs = $('#fs').value, q = norm($('#fq').value);
    const f = lista.filter((i) => (!fs || i.status === fs) && (!q || norm([i.aluno, i.responsavel, i.contato, i.escola_atual].join(' ')).includes(q)));
    $('#tb').innerHTML = f.length ? f.map((i) => `<tr><td class="dado">${dataBR(i.data)}<br><small>${esc(i.tipo_contato || '')}</small></td><td><b>${esc(i.aluno)}</b>${i.obs ? `<br><small class="dado">${esc(i.obs)}</small>` : ''}</td>
      <td>${esc(i.serie_interesse || '—')}</td><td>${esc(i.responsavel || '—')}<br><small class="dado">${esc(i.contato || '')}</small></td><td>${esc(i.escola_atual || '—')}</td>
      <td><select data-id="${i.id}" aria-label="Situação">${Object.entries(STATUS_INT).map(([k, v]) => `<option value="${k}" ${i.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td class="acoes"><button class="btn peq" data-ed="${i.id}">Editar</button>${String(i.contato || '').replace(/\D/g, '').length >= 10 ? `<a class="btn peq zap" target="_blank" rel="noopener" href="https://wa.me/55${esc(String(i.contato).replace(/\D/g, '').slice(-11))}">WhatsApp</a>` : ''}</td></tr>`).join('')
      : '<tr><td colspan="7" class="vazio">Nenhum contato. Cadastre um novo ou importe a planilha Cadastros SIG.</td></tr>';
    $$('#tb select').forEach((s) => (s.onchange = tentar(async () => {
      await api('PUT', '/api/interessados/' + s.dataset.id, { status: s.value, ultimo_contato: hojeIso() });
      lista.find((x) => x.id === +s.dataset.id).status = s.value; toast('Situação atualizada');
    })));
    $$('[data-ed]').forEach((b) => (b.onclick = () => formInteressado(lista.find((x) => x.id === +b.dataset.ed))));
  };
  $('#fs').onchange = desenhar; $('#fq').oninput = desenhar;
  $('#novo').onclick = () => formInteressado();
  $('#arq').onchange = tentar(async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = await api('POST', '/api/interessados/importar?arquivo=' + encodeURIComponent(file.name), undefined, file);
    toast(`${r.importados} contatos importados`); rotear();
  });
  desenhar();
};

function formInteressado(i) {
  const novo = !i; i = i || { data: hojeIso(), status: 'novo' };
  const campo = (id, rot, tipo = 'text') => `<div class="campo"><label>${rot}</label><input id="i_${id}" type="${tipo}" value="${esc(i[id] ?? '')}"></div>`;
  modal(novo ? 'Novo contato' : 'Editar contato', `<form id="fi"><div class="campos">
    ${campo('aluno', 'Nome do aluno *')}${campo('dt_nasc', 'Nascimento', 'date')}
    <div class="campo"><label>Série de interesse</label><select id="i_serie_interesse"><option value=""></option>${window.__series.map((s) => `<option ${i.serie_interesse === s.rotulo ? 'selected' : ''}>${esc(s.rotulo)}</option>`).join('')}</select></div>
    ${campo('responsavel', 'Responsável')}${campo('contato', 'Telefone / WhatsApp')}${campo('email', 'E-mail', 'email')}
    ${campo('escola_atual', 'Escola atual')}${campo('endereco', 'Bairro / CEP')}
    <div class="campo"><label>Como chegou</label><select id="i_tipo_contato">${['', 'Presencial', 'WhatsApp', 'Telefone', 'E-mail', 'Indicação', 'Redes sociais'].map((o) => `<option ${i.tipo_contato === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
    ${campo('data', 'Data do contato', 'date')}${campo('ultimo_contato', 'Último retorno', 'date')}
    <div class="campo"><label>Situação</label><select id="i_status">${Object.entries(STATUS_INT).map(([k, v]) => `<option value="${k}" ${i.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
  </div><div class="campo" style="margin-top:12px"><label>Observação</label><input id="i_obs" value="${esc(i.obs || '')}"></div>
  <div class="rodape">${novo ? '' : '<button type="button" class="btn perigo" id="del" style="margin-right:auto">Excluir</button>'}<button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Salvar</button></div></form>`,
  { onAbrir: (el, fechar) => {
    $('#fi', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      const b = {};
      ['aluno', 'dt_nasc', 'serie_interesse', 'responsavel', 'contato', 'email', 'escola_atual', 'endereco', 'tipo_contato', 'data', 'ultimo_contato', 'status', 'obs'].forEach((k) => { b[k] = $('#i_' + k, el).value.trim(); });
      if (novo) await api('POST', '/api/interessados', b); else await api('PUT', '/api/interessados/' + i.id, b);
      fechar(); toast('Salvo'); rotear();
    });
    if ($('#del', el)) $('#del', el).onclick = tentar(async () => {
      if (!(await confirmar('Excluir o contato de ' + i.aluno + '?', 'Excluir'))) return;
      await api('DELETE', '/api/interessados/' + i.id); fechar(); toast('Excluído'); rotear();
    });
  } });
}

// ───────────── Modelos de mensagem ─────────────
TELAS.mensagens = async (c) => {
  const modelos = await api('GET', '/api/modelos');
  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Modelos de mensagem</h1><p class="sub">Textos prontos para WhatsApp. O app troca as palavras entre chaves pelos dados do aluno.</p></div>
    <button class="btn ama" id="novo">＋ Novo modelo</button></div>
  <div class="dica">Campos disponíveis: <span class="mono">{aluno} {responsavel} {serie} {serie_destino} {documentos} {prazo}</span></div>
  <div class="grade g2">${modelos.map((m) => `<div class="cartao"><div class="acoes" style="justify-content:space-between"><h3 style="margin:0">${esc(m.titulo)}</h3><button class="btn peq" data-ed="${m.id}">Editar</button></div>
    <p style="white-space:pre-wrap;color:var(--texto-2);font-size:13px">${esc(m.texto)}</p></div>`).join('')}</div>`;
  const form = (m) => modal(m ? 'Editar modelo' : 'Novo modelo', `<form id="fm"><div class="campo"><label>Título</label><input id="mt" value="${esc(m?.titulo || '')}" required></div>
    <div class="campo" style="margin-top:10px"><label>Texto</label><textarea id="mx" required>${esc(m?.texto || '')}</textarea></div>
    <div class="rodape">${m ? '<button type="button" class="btn perigo" id="del" style="margin-right:auto">Excluir</button>' : ''}<button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Salvar</button></div></form>`,
  { onAbrir: (el, fechar) => {
    $('#fm', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      const b = { titulo: $('#mt', el).value, texto: $('#mx', el).value };
      if (m) await api('PUT', '/api/modelos/' + m.id, b); else await api('POST', '/api/modelos', b);
      fechar(); toast('Modelo salvo'); rotear();
    });
    if ($('#del', el)) $('#del', el).onclick = tentar(async () => { if (!(await confirmar('Excluir o modelo "' + m.titulo + '"?', 'Excluir'))) return; await api('DELETE', '/api/modelos/' + m.id); fechar(); rotear(); });
  } });
  $('#novo').onclick = () => form();
  $$('[data-ed]').forEach((b) => (b.onclick = () => form(modelos.find((m) => m.id === +b.dataset.ed))));
};

// ───────────── Configurações (admin) ─────────────
TELAS.config = async (c, aba = 'geral') => {
  if (EU.perfil !== 'admin') { c.innerHTML = '<div class="cartao">Somente a administração acessa as configurações.</div>'; return; }
  const d = await api('GET', '/api/admin');
  const ABAS = { geral: 'Geral', importar: 'Importar dados', vagas: 'Vagas', documentos: 'Documentos', usuarios: 'Usuários', log: 'Auditoria' };
  c.innerHTML = `<h1>Configurações</h1><p class="sub">Só a administração vê esta área.</p>
    <div class="abas">${Object.entries(ABAS).map(([k, v]) => `<button data-aba="${k}" class="${aba === k ? 'on' : ''}">${v}</button>`).join('')}</div><div id="aba"></div>`;
  $$('[data-aba]').forEach((b) => (b.onclick = () => (location.hash = '#/config/' + b.dataset.aba)));
  const el = $('#aba');
  const cfg = d.config;

  if (aba === 'geral') {
    const campo = (k, rot, tipo = 'date') => `<div class="campo"><label>${rot}</label><input id="c_${k}" type="${tipo}" value="${esc(cfg[k] || '')}"></div>`;
    el.innerHTML = `<form class="cartao" id="fg"><div class="campos">
      ${campo('ano_matricula', 'Ano da matrícula', 'number')}${campo('prazo_dias', 'Prazo para documentos (dias)', 'number')}
      ${campo('data_inicio', 'Início das matrículas')}${campo('data_desconto', 'Fim do desconto')}${campo('data_garantia_vaga', 'Fim da garantia de vaga')}${campo('data_fim', 'Encerramento')}
    </div><div class="campo" style="margin-top:12px"><label>Pasta dos prontuários (Contratos)</label><input id="c_pasta_prontuario" value="${esc(cfg.pasta_prontuario)}" style="width:100%"></div>
    <p class="dado">O app procura as pastas assim: <span class="mono">Pasta\\&lt;turma&gt;\\&lt;nome do aluno&gt;\\*.pdf</span>, com os nomes do PDF Renamer.</p>
    <div class="campo" style="margin-top:12px"><label>Pastas das fotos dos alunos (separe com ;)</label><input id="c_pastas_fotos" value="${esc(cfg.pastas_fotos || '')}" style="width:100%"></div>
    <h3 style="margin-top:18px">Declarações</h3><div class="campos">
      ${campo('inep', 'Código INEP', 'text')}${campo('horario_infantil', 'Horário Ed. Infantil', 'text')}${campo('horario_fund1', 'Horário Fund. I', 'text')}
      ${campo('horario_fund2', 'Horário Fund. II', 'text')}${campo('horario_medio', 'Horário Ensino Médio', 'text')}</div>
    <h3 style="margin-top:18px">Atividades extras e olimpíada</h3><div class="campos">
      ${campo('extras_dia_venc', 'Dia de vencimento das parcelas', 'number')}${campo('extras_ultimo_mes', 'Último mês de parcela (11 = novembro)', 'number')}
      ${campo('olimpiada_titulo', 'Título da olimpíada', 'text')}${campo('olimpiada_validade', 'Validade da carteirinha')}</div>
    <h3 style="margin-top:18px">Bolsa social (CEBAS)</h3><div class="campos">
      ${campo('cebas_ano', 'Ano das bolsas', 'number')}${campo('cebas_retirada', 'Retirada do requerimento')}${campo('cebas_entrega_ini', 'Entrega: início')}
      ${campo('cebas_entrega_fim', 'Entrega: fim')}${campo('cebas_resultado', 'Divulgação do resultado')}${campo('cebas_prestacao', 'Prestação de contas')}</div>
    <div class="rodape" style="display:flex;justify-content:flex-end"><button class="btn pri">Salvar</button></div></form>`;
    $('#fg').onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      const b = {}; ['ano_matricula', 'prazo_dias', 'data_inicio', 'data_desconto', 'data_garantia_vaga', 'data_fim', 'pasta_prontuario', 'pastas_fotos', 'inep',
        'horario_infantil', 'horario_fund1', 'horario_fund2', 'horario_medio', 'extras_dia_venc', 'extras_ultimo_mes', 'olimpiada_titulo', 'olimpiada_validade',
        'cebas_ano', 'cebas_retirada', 'cebas_entrega_ini', 'cebas_entrega_fim', 'cebas_resultado', 'cebas_prestacao'].forEach((k) => { b[k] = $('#c_' + k).value.trim(); });
      await api('PUT', '/api/admin/config', b); EU = await api('GET', '/api/eu'); toast('Configurações salvas');
    });
  }

  if (aba === 'importar') {
    const p = await api('GET', '/api/painel');
    el.innerHTML = `<div class="grade g2">
      <div class="cartao"><h2>📥 Importar alunos do ACADESC</h2>
        <p>Use a exportação de alunos do ACADESC em Excel (.xlsx) com as colunas <span class="mono">Mat, Nome, AnoLetivo, Descricao, Serie, Turma, Turno, FilhoFuncionario, NomeMae, NomePai, NomeResp, Email, CelularMae, CelularPai, DtNascimento, CPF…</span>
        É o mesmo formato da aba <b>Planilha1</b> do contrato.</p>
        <p class="dica">Os alunos são identificados pela matrícula: quem já existe é atualizado e quem não existe é criado. Nada é apagado. Rematrículas e documentos já marcados continuam.</p>
        <label class="btn pri">Escolher arquivo…<input type="file" id="arqA" accept=".xlsx,.csv" hidden></label>
        <div id="resA" style="margin-top:12px"></div></div>
      <div class="cartao"><h2>🧪 Dados de demonstração</h2>
        <p>Cria cerca de 160 alunos <b>fictícios</b> para testar e apresentar o sistema sem expor dados reais (LGPD).</p>
        ${p.demo ? '<p><span class="tag t-demo">Demonstração carregada</span></p><button class="btn perigo" id="apagarDemo">Apagar dados de demonstração</button>'
          : '<button class="btn" id="carregarDemo">Carregar demonstração</button>'}
        <p class="dado" style="margin-top:12px">Antes de importar os alunos reais, apague a demonstração.</p></div></div>`;
    $('#arqA').onchange = tentar(async (e) => {
      const file = e.target.files[0]; if (!file) return;
      $('#resA').textContent = 'Importando…';
      const r = await api('POST', '/api/admin/importar-alunos?arquivo=' + encodeURIComponent(file.name), undefined, file);
      invalidar();
      $('#resA').innerHTML = `<div class="dica">✅ <b>${r.novos}</b> novos · <b>${r.atualizados}</b> atualizados · ${r.ignorados} linhas ignoradas${r.sem_serie.length ? `<br>⚠️ ${r.sem_serie.length} sem série reconhecida: ${esc(r.sem_serie.slice(0, 10).join(', '))}${r.sem_serie.length > 10 ? '…' : ''}` : ''}</div>`;
    });
    if ($('#carregarDemo')) $('#carregarDemo').onclick = tentar(async () => { const r = await api('POST', '/api/admin/demo'); invalidar(); toast(r.alunos + ' alunos fictícios criados'); location.hash = '#/'; });
    if ($('#apagarDemo')) $('#apagarDemo').onclick = tentar(async () => {
      if (!(await confirmar('Apagar todos os alunos e contatos fictícios da demonstração?', 'Apagar'))) return;
      await api('DELETE', '/api/admin/demo'); invalidar(); toast('Demonstração apagada'); rotear();
    });
  }

  if (aba === 'vagas') {
    el.innerHTML = `<form class="cartao" id="fv"><p>Capacidade máxima de alunos por série em ${esc(cfg.ano_matricula)} (somando todas as turmas). Deixe em branco se não houver limite definido.</p>
      <div class="campos">${d.vagas.map((v) => `<div class="campo"><label>${esc(v.rotulo)}</label><input type="number" min="0" data-v="${v.chave}" value="${v.capacidade ?? ''}"></div>`).join('')}</div>
      <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn pri">Salvar vagas</button></div></form>`;
    $('#fv').onsubmit = tentar(async (ev) => { ev.preventDefault(); const b = {}; $$('[data-v]').forEach((i) => { b[i.dataset.v] = i.value; }); await api('PUT', '/api/admin/vagas', b); toast('Vagas salvas'); });
  }

  if (aba === 'documentos') {
    el.innerHTML = `<div class="cartao"><p>Lista de documentos da matrícula (vocês ainda vão definir a lista oficial; ela pode ser ajustada aqui a qualquer momento).
      O "arquivo PDF" é o nome padronizado do PDF Renamer ({ano} vira o ano da matrícula).</p>
      <div class="tabela-wrap"><table><thead><tr><th>Documento</th><th>Arquivo PDF</th><th>Obrigatório</th><th>Vale para</th><th>Ativo</th></tr></thead><tbody>
      ${d.documentos.map((x) => `<tr data-doc="${x.id}"><td><input data-k="nome" value="${esc(x.nome)}" style="width:100%"></td><td><input data-k="arquivo" value="${esc(x.arquivo || '')}" style="width:100%"></td>
        <td><input type="checkbox" data-k="obrigatorio" ${x.obrigatorio ? 'checked' : ''}></td>
        <td><select data-k="aplica"><option value="todos" ${x.aplica === 'todos' ? 'selected' : ''}>Todos</option><option value="novos" ${x.aplica === 'novos' ? 'selected' : ''}>Só novos</option></select></td>
        <td><input type="checkbox" data-k="ativo" ${x.ativo ? 'checked' : ''}></td></tr>`).join('')}
      </tbody></table></div>
      <div class="acoes" style="margin-top:12px"><button class="btn" id="addDoc">＋ Adicionar documento</button></div></div>`;
    $$('[data-doc] [data-k]').forEach((i) => (i.onchange = tentar(async () => {
      const v = i.type === 'checkbox' ? i.checked : i.value;
      await api('PUT', '/api/admin/documentos/' + i.closest('tr').dataset.doc, { [i.dataset.k]: v }); toast('Salvo');
    })));
    $('#addDoc').onclick = tentar(async () => { await api('POST', '/api/admin/documentos', { nome: 'Novo documento', obrigatorio: true }); rotear(); });
  }

  if (aba === 'usuarios') {
    el.innerHTML = `<div class="cartao"><table><thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Situação</th><th></th></tr></thead><tbody>
      ${d.usuarios.map((u) => `<tr data-u="${u.id}"><td>${esc(u.nome)}</td><td class="mono">${esc(u.login)}</td>
        <td><select data-k="perfil"><option value="admin" ${u.perfil === 'admin' ? 'selected' : ''}>Administração</option><option value="aprendiz" ${u.perfil === 'aprendiz' ? 'selected' : ''}>Aprendiz</option></select></td>
        <td>${u.ativo ? (u.trocar_senha ? '<span class="tag t-reservada">aguardando 1º acesso</span>' : '<span class="tag t-concluida">ativo</span>') : '<span class="tag t-nao_renova">desativado</span>'}</td>
        <td class="acoes"><button class="btn peq" data-reset>Resetar senha</button><button class="btn peq" data-ativo="${u.ativo ? 0 : 1}">${u.ativo ? 'Desativar' : 'Reativar'}</button></td></tr>`).join('')}
      </tbody></table>
      <p class="dica">Senha inicial e senha resetada: <b class="mono">luterano</b>. No primeiro acesso a pessoa é obrigada a criar uma senha própria.<br>
      <b>Administração</b> acessa as configurações, a importação e a auditoria. <b>Aprendiz</b> usa todo o resto.</p>
      <form id="fu" class="acoes" style="margin-top:10px"><input id="un" placeholder="Nome" required><input id="ul" placeholder="login (ex.: maria)" required>
        <select id="up"><option value="aprendiz">Aprendiz</option><option value="admin">Administração</option></select><button class="btn pri">Criar usuário</button></form></div>`;
    $$('[data-u]').forEach((tr) => {
      const id = tr.dataset.u;
      $('[data-k=perfil]', tr).onchange = tentar(async (e) => { await api('PUT', '/api/admin/usuarios/' + id, { perfil: e.target.value }); toast('Perfil alterado'); });
      $('[data-reset]', tr).onclick = tentar(async () => { await api('PUT', '/api/admin/usuarios/' + id, { resetar_senha: true }); toast('Senha resetada para "luterano"'); rotear(); });
      $('[data-ativo]', tr).onclick = tentar(async (e) => { await api('PUT', '/api/admin/usuarios/' + id, { ativo: e.target.dataset.ativo === '1' }); rotear(); });
    });
    $('#fu').onsubmit = tentar(async (ev) => { ev.preventDefault(); await api('POST', '/api/admin/usuarios', { nome: $('#un').value, login: $('#ul').value, perfil: $('#up').value }); toast('Usuário criado. Senha inicial: luterano'); rotear(); });
  }

  if (aba === 'log') {
    const log = await api('GET', '/api/admin/log');
    el.innerHTML = `<div class="cartao tabela-wrap" style="padding:0"><table><thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Detalhe</th></tr></thead><tbody>
      ${log.map((l) => { let det = l.detalhe; try { const o = JSON.parse(l.detalhe); det = o.nome || o.login || Object.entries(o).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · '); } catch { /* texto */ }
        return `<tr><td class="dado">${new Date(l.quando).toLocaleString('pt-BR')}</td><td>${esc(l.usuario)}</td><td>${esc(l.acao)}</td><td class="dado">${esc(String(det || '').slice(0, 160))}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  }
};

// Espera todos os scripts (app.js e etapa2.js) carregarem antes de começar
document.addEventListener('DOMContentLoaded', iniciar);
