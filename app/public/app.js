// Secretaria IEL — interface (sem bibliotecas externas: funciona sem internet)
'use strict';

// Precisa ser igual ao VERSAO de app/lib/versao.js. Se o navegador carregar telas novas
// enquanto a janela preta ainda roda o servidor antigo, o app avisa em vez de dar erro feio.
const VERSAO = '5.5.1';
// Nome do app (provisório, escolhido pelo Kevin em 29/09/2026 — ainda pode mudar). Para trocar: aqui e no <title> do index.html.
const NOME_APP = 'SEK';

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
  let r;
  try { r = await fetch(url, op); } catch {
    // O servidor (a janela preta) não respondeu: a janela aberta continua com tudo o que foi digitado
    semConexao();
    throw new Error('O computador da secretaria não respondeu. O que você digitou continua aqui: espere a faixa vermelha sumir e tente de novo.');
  }
  conexaoVoltou();
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login') { EU = null; telaLogin(); throw new Error(dados.erro || 'Sessão expirada'); }
  if (r.status === 428) { telaTrocarSenha(true); throw new Error(dados.erro); }
  if (r.status === 423 && url !== '/api/desbloquear') { if (window.mostrarBloqueio) window.mostrarBloqueio(); throw new Error(dados.erro || 'Tela bloqueada'); }
  if (r.status === 404 && /rota não encontrada/i.test(dados.erro || '')) {
    throw new Error('Esta tela é mais nova que o sistema que está aberto. Feche a janela preta do "Iniciar Secretaria" e abra de novo.');
  }
  if (!r.ok) { const e = new Error(dados.erro || 'Erro ' + r.status); e.status = r.status; e.dados = dados; throw e; }
  if (metodo === 'DELETE' && dados.lixeira_id) avisarLixeira(dados.lixeira_id);
  return dados;
}

// Salva mandando a versão que a tela carregou (atualizado_em). Se outra pessoa salvou no meio do caminho,
// o servidor recusa e aqui a pessoa decide: passar por cima ou desistir (a janela continua aberta com o que ela digitou).
// "original" é o registro como a tela carregou: só vão os campos que a pessoa mudou, então se duas pessoas mexeram
// em campos diferentes, o trabalho das duas fica (em vez de um apagar o do outro).
async function salvarComVersao(url, corpoTodo, original) {
  const corpo = Object.fromEntries(Object.entries(corpoTodo).filter(([k, v]) => !(k in original) || String(v ?? '') !== String(original[k] ?? '')));
  if (!Object.keys(corpo).length) return { ok: true, nada: true };
  try { return await api('PUT', url, { ...corpo, _versao: original.atualizado_em ?? null }); } catch (e) {
    const c = e.dados && e.dados.conflito;
    if (!c) throw e;
    const quando = new Date(c.em);
    const min = Math.max(0, Math.round((Date.now() - quando) / 60000));
    const ha = min < 1 ? 'agora há pouco' : min < 60 ? `há ${plural(min, 'minuto', 'minutos')}` : 'às ' + quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const campos = Object.keys(corpo).length;
    const sim = await confirmar(`${c.por} alterou este registro ${ha}, enquanto você estava com ele aberto. Se você salvar agora, só `
      + `${campos === 1 ? 'o campo que você mudou será gravado' : `os ${campos} campos que você mudou serão gravados`} — se ${c.por} tiver mexido `
      + `${campos === 1 ? 'nele' : 'neles'} também, vale o seu. O resto do que ${c.por} fez fica como está. Salvar mesmo assim?`, 'Salvar mesmo assim');
    if (sim) return api('PUT', url, { ...corpo, _forcar: true });
    throw new Error(`Nada foi salvo. Para ver o que ${c.por} mudou, feche esta janela e abra de novo.`);
  }
}

// ───────────── quando o servidor cai ─────────────
// Faixa vermelha fixa no topo e uma nova tentativa a cada 4 segundos; quando volta, avisa e some sozinha.
let vigiaConexao = null;
function semConexao() {
  if (!$('#semConexao')) {
    const f = document.createElement('div');
    f.id = 'semConexao';
    f.className = 'sem-conexao';
    f.setAttribute('role', 'alert');
    f.innerHTML = '<b>Sem conexão com o computador da secretaria.</b> Confira se a janela preta do "Iniciar Secretaria" está aberta. Nada do que você digitou foi perdido — tentando de novo…';
    document.body.appendChild(f);
  }
  if (!vigiaConexao) vigiaConexao = setInterval(async () => {
    try { const r = await fetch('/api/versao', { cache: 'no-store' }); if (r.status < 500) conexaoVoltou(true); } catch { /* ainda fora */ }
  }, 4000);
}
function conexaoVoltou(avisar) {
  const f = $('#semConexao');
  if (vigiaConexao) { clearInterval(vigiaConexao); vigiaConexao = null; }
  if (f) { f.remove(); if (avisar) toast('A conexão voltou. Pode salvar de novo.'); }
}

// ───────────── rascunho das janelas ─────────────
// Tudo o que é digitado numa janela com formulário fica guardado nesta aba do navegador (sessionStorage, some ao
// fechar o navegador). Se a janela fecha normalmente (salvou ou cancelou), o rascunho é apagado. Se o sistema cai,
// a página recarrega ou pede para entrar de novo, na próxima vez que a mesma janela abrir aparece "Recuperar".
const RASCUNHO = 'iel-rascunho:';
const RASCUNHO_HORAS = 12;
const camposDaJanela = (el) => $$('input[id], select[id], textarea[id]', el).filter((i) => !['password', 'file', 'hidden'].includes(i.type));
function guardarRascunho(tituloTxt, el) {
  const campos = {};
  let algo = false;
  for (const i of camposDaJanela(el)) {
    campos[i.id] = i.type === 'checkbox' || i.type === 'radio' ? i.checked : i.value;
    if (i.type !== 'checkbox' && i.type !== 'radio' && i.value && i.value !== i.defaultValue) algo = true;
  }
  try {
    if (algo) sessionStorage.setItem(RASCUNHO + tituloTxt, JSON.stringify({ quando: Date.now(), tela: location.hash, campos }));
    else sessionStorage.removeItem(RASCUNHO + tituloTxt);
  } catch { /* navegador sem armazenamento */ }
}
function lerRascunho(tituloTxt) {
  try {
    const r = JSON.parse(sessionStorage.getItem(RASCUNHO + tituloTxt) || 'null');
    if (r && Date.now() - r.quando < RASCUNHO_HORAS * 3600000) return r;
    sessionStorage.removeItem(RASCUNHO + tituloTxt);
  } catch { /* ignora */ }
  return null;
}
const apagarRascunho = (tituloTxt) => { try { sessionStorage.removeItem(RASCUNHO + tituloTxt); } catch { /* ignora */ } };
function rascunhosPendentes() {
  try { return Object.keys(sessionStorage).filter((k) => k.startsWith(RASCUNHO)).map((k) => k.slice(RASCUNHO.length)).filter(lerRascunho); } catch { return []; }
}
// Faixa no topo de qualquer tela: "ficou uma janela sem salvar", com o caminho de volta
function mostrarRascunhos() {
  const caixa = $('#rascunhos');
  if (!caixa) return;
  const lista = rascunhosPendentes().filter((t) => !$$('.modal h2 span').some((s) => s.textContent === t));
  caixa.innerHTML = lista.length ? `<div class="aviso-fixo">${icone('rematricula')}<b>Ficou sem salvar:</b> ${lista.map((t) => {
    const r = lerRascunho(t);
    return `“${esc(t)}” <a class="btn peq" href="${esc(r.tela || '#/')}">Voltar para aquela tela</a>`;
  }).join(' · ')} <span>Abra a mesma janela de novo e clique em <b>Recuperar</b>.</span>
    <button class="btn peq" id="rascOk" title="Descartar o que ficou sem salvar">Descartar</button></div>` : '';
  if ($('#rascOk')) $('#rascOk').onclick = () => { lista.forEach(apagarRascunho); mostrarRascunhos(); };
}
function ligarRascunho(tituloTxt, el) {
  if (!camposDaJanela(el).length) return;
  const r = lerRascunho(tituloTxt);
  if (r) {
    const faixa = document.createElement('div');
    faixa.className = 'faixa-rascunho';
    faixa.innerHTML = `<span>Você começou a preencher esta janela ${new Date(r.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} e ela não foi salva.</span>
      <button type="button" class="btn peq pri" data-rec>Recuperar o que foi digitado</button><button type="button" class="btn peq" data-desc>Descartar</button>`;
    const alvo = $('h2', el);
    alvo.after(faixa);
    $('[data-rec]', faixa).onclick = () => {
      for (const i of camposDaJanela(el)) {
        if (!(i.id in r.campos)) continue;
        if (i.type === 'checkbox' || i.type === 'radio') i.checked = !!r.campos[i.id]; else i.value = r.campos[i.id];
        i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true }));
      }
      faixa.remove(); toast('Recuperado. Confira e salve.');
    };
    $('[data-desc]', faixa).onclick = () => { apagarRascunho(tituloTxt); faixa.remove(); };
  }
  let t;
  const salvar = () => { clearTimeout(t); t = setTimeout(() => guardarRascunho(tituloTxt, el), 300); };
  el.addEventListener('input', salvar);
  el.addEventListener('change', salvar);
}

let toastTimer;
// Quando uma exclusão foi para a lixeira, a próxima mensagem ("Excluído") ganha o botão Desfazer
let desfazerPendente = null;
function toast(msg, erro) {
  let t = $('.toast');
  const jaAberto = t && !t.classList.contains('saindo');
  if (!t) {
    t = document.createElement('div'); t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite');
    // Mouse em cima (ou janela escondida) segura o aviso: dá tempo de ler e de clicar em "Desfazer"
    t.onmouseenter = () => pausarToast(t);
    t.onmouseleave = () => retomarToast(t);
    document.body.appendChild(t);
  }
  t.className = 'toast' + (erro ? ' erro' : '');
  // Chegou outro aviso com este ainda na tela: troca o texto com um desfoque rápido, sem "pular"
  if (jaAberto) { void t.offsetWidth; t.classList.add('troca'); }
  t.textContent = msg;
  let tempo = erro ? 5000 : 2600;
  const d = desfazerPendente;
  if (!erro && d && Date.now() - d.em < 2000) {
    desfazerPendente = null;
    const b = document.createElement('button');
    b.textContent = 'Desfazer';
    b.onclick = tentar(async () => {
      b.disabled = true;
      await api('POST', `/api/lixeira/${d.id}/restaurar`);
      invalidar(); toast('Pronto, voltou para o lugar'); rotear();
    });
    t.append(' · Foi para a lixeira. ', b);
    tempo = 8000;
  }
  clearTimeout(toastTimer);
  t._resta = tempo;
  if (t.matches(':hover') || document.hidden) return; // começa a contar quando o mouse sair / a janela voltar
  retomarToast(t);
}
// Sai descendo pelo mesmo caminho por onde entrou; uma mensagem nova no meio disso reaproveita a mesma caixa
function retomarToast(t) {
  clearTimeout(toastTimer);
  t._inicio = Date.now();
  toastTimer = setTimeout(() => { t.classList.add('saindo'); toastTimer = setTimeout(() => t.remove(), 200); }, Math.max(t._resta || 0, 1200));
}
function pausarToast(t) {
  if (t.classList.contains('saindo')) return;
  clearTimeout(toastTimer);
  if (t._inicio) t._resta -= Date.now() - t._inicio;
}
document.addEventListener('visibilitychange', () => { const t = $('.toast'); if (!t) return; if (document.hidden) pausarToast(t); else if (!t.matches(':hover')) retomarToast(t); });
// Chamado pelo api() depois de um DELETE que foi para a lixeira. Se a tela não mostrar mensagem nenhuma, mostra uma.
function avisarLixeira(id) {
  desfazerPendente = { id, em: Date.now() };
  setTimeout(() => { if (desfazerPendente && desfazerPendente.id === id) toast('Excluído'); }, 400);
}
const tentar = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };
const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Caixinha de marcar: a linha fica "feita" na hora do clique, antes de o servidor responder; se der erro, volta
// como estava. Espera a marquinha terminar de desenhar antes de a tela se atualizar (senão ela é cortada no meio).
async function marcarNaHora(cb, acao) {
  const li = cb.closest('li'), inicio = performance.now();
  if (li) li.classList.toggle('ok', cb.checked);
  try { await acao(); } catch (e) { cb.checked = !cb.checked; if (li) li.classList.toggle('ok', cb.checked); throw e; }
  const falta = 220 - (performance.now() - inicio);
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
}

// Linha que sai da lista (lembrete concluído, entrega fora do filtro): encolhe e some em vez de sumir de estalo
function sumirLinha(el) {
  if (!el || semMovimento()) return Promise.resolve();
  const s = getComputedStyle(el);
  el.style.overflow = 'hidden';
  return el.animate([
    { opacity: 1, height: el.offsetHeight + 'px', paddingTop: s.paddingTop, paddingBottom: s.paddingBottom },
    { opacity: 0, height: '0px', paddingTop: '0px', paddingBottom: '0px' },
  ], { duration: 220, easing: 'cubic-bezier(.23, 1, .32, 1)', fill: 'forwards' }).finished.catch(() => {});
}

// Guarda "quem estava com o foco" antes de a tela se redesenhar, para devolver o foco ao mesmo campo depois
// (quem usa o teclado não volta para o topo da página a cada caixinha marcada)
function seletorDoFoco(c) {
  const el = document.activeElement;
  if (!el || el === document.body || !c.contains(el)) return null;
  if (el.id) return '#' + CSS.escape(el.id);
  const d = [...el.attributes].find((x) => x.name.startsWith('data-'));
  return d ? `${el.tagName.toLowerCase()}[${d.name}="${CSS.escape(d.value)}"]` : null;
}

// A janela de verdade sai do documento na hora (nenhum código acha uma janela "fechando");
// no lugar dela fica por 0,16s uma cópia sem ids e sem clique, que some encolhendo de leve.
function sumirSuave(f) {
  if (!f.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const copia = f.cloneNode(true);
  copia.className = 'fundo-modal-saindo';
  copia.setAttribute('aria-hidden', 'true');
  copia.inert = true;
  copia.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
  f.after(copia);
  setTimeout(() => copia.remove(), 180);
}

function modal(tituloTxt, corpoHtml, { onAbrir } = {}) {
  const f = document.createElement('div');
  f.className = 'fundo-modal';
  f.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h2><span>${esc(tituloTxt)}</span><button class="x" aria-label="Fechar">×</button></h2>${corpoHtml}</div>`;
  const focoAntes = document.activeElement;
  // Fechou a janela (salvou, cancelou ou apertou Esc): o rascunho não serve mais, e o foco volta para onde estava
  const fechar = () => { sumirSuave(f); f.remove(); document.removeEventListener('keydown', tecla); apagarRascunho(tituloTxt); mostrarRascunhos();
    if (focoAntes && focoAntes.isConnected && focoAntes.focus) focoAntes.focus({ preventScroll: true }); };
  // Esc fecha só a janela de cima (uma confirmação aberta por cima de outra janela não leva as duas juntas)
  const tecla = (e) => { if (e.key === 'Escape' && f === $$('.fundo-modal').pop()) { e.stopImmediatePropagation(); fechar(); } };
  f.addEventListener('click', (e) => { if (e.target === f || e.target.closest('.x') || e.target.closest('[data-fechar]')) fechar(); });
  document.addEventListener('keydown', tecla);
  document.body.appendChild(f);
  onAbrir && onAbrir(f, fechar);
  // O teclado já entra na janela: no primeiro campo, ou no botão principal quando não há campo (ex.: Confirmar)
  if (!f.contains(document.activeElement)) {
    const alvo = (tituloTxt.startsWith('Ajuda · ') ? null : $('input:not([type=hidden]):not([disabled]), select, textarea', f)) || $('#sim, .btn.pri', f);
    if (alvo) alvo.focus({ preventScroll: true });
  }
  if (tituloTxt !== 'Confirmar' && !tituloTxt.startsWith('Ajuda · ')) ligarRascunho(tituloTxt, f);
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
    <div class="rodape"><button class="btn" id="copiar">${icone('copia')}Copiar texto</button><button class="btn zap" id="abrir">Abrir no WhatsApp</button></div>`,
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

// ───────────── claro / escuro ─────────────
// A escolha fica guardada só neste navegador. Sem escolha, o app segue o tema do Windows.
function temaAtual() {
  try {
    const t = localStorage.getItem('iel-tema');
    if (t === 'claro' || t === 'escuro') return t;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
  } catch { return 'claro'; }
}
// "escolhido" só é verdadeiro quando a pessoa clica no botão: quem nunca escolheu continua seguindo o Windows.
let temaTimer;
function aplicarTema(tema, escolhido) {
  // Só quando a pessoa clica: as cores mudam suavemente em vez de piscar (ao abrir a tela, nada de transição)
  if (escolhido) {
    const raiz = document.documentElement;
    raiz.classList.add('trocando-tema');
    clearTimeout(temaTimer); temaTimer = setTimeout(() => raiz.classList.remove('trocando-tema'), 350);
  }
  document.documentElement.dataset.tema = tema;
  if (escolhido) { try { localStorage.setItem('iel-tema', tema); } catch { /* navegador sem armazenamento */ } }
  const b = $('#tema');
  if (b) {
    b.innerHTML = icone(tema === 'escuro' ? 'sol' : 'lua');
    b.dataset.icone = tema === 'escuro' ? 'sol' : 'lua';
    b.title = tema === 'escuro' ? 'Voltar ao modo claro' : 'Modo escuro (bom para a tarde/noite)';
    b.setAttribute('aria-label', b.title);
  }
}

// Modo compacto: menos espaço entre as linhas, para caber mais aluno na tela
function densidadeAtual() {
  try { return localStorage.getItem('iel-compacto') === '1' ? 'compacta' : 'normal'; } catch { return 'normal'; }
}
function aplicarDensidade(d, escolhido) {
  const compacta = d === 'compacta';
  document.documentElement.dataset.densidade = compacta ? 'compacta' : 'normal';
  if (escolhido) { try { localStorage.setItem('iel-compacto', compacta ? '1' : '0'); } catch { /* sem armazenamento */ } }
}

// O navegador lê as telas do disco na hora, mas o servidor é o processo que está aberto na janela preta.
// Depois de uma atualização (git pull), os dois ficam diferentes até reabrir o "Iniciar Secretaria".
function avisarVersaoAntiga() {
  if (EU.versao === VERSAO) return;
  const caixa = $('#avisos');
  if (!caixa) return;
  caixa.insertAdjacentHTML('afterbegin', `<div class="aviso-fixo perigo">${icone('volta')}<b>O sistema foi atualizado neste computador</b>
    (telas ${esc(VERSAO)}, servidor ${esc(EU.versao || 'anterior à 4.0.0')}). Feche a <b>janela preta</b> do "Iniciar Secretaria" e abra de novo —
    algumas telas não vão funcionar até lá. <button class="btn peq" id="avVersao">Tentar reiniciar sozinho</button></div>`);
  $('#avVersao').onclick = tentar(async () => {
    try { await api('POST', '/api/admin/reiniciar'); } catch { /* servidor antigo pode não ter essa rota */ }
    toast('Se o sistema não voltar em alguns segundos, feche e abra a janela preta.');
    setTimeout(() => location.reload(), 5000);
  });
}

// Atalhos e escuta do tema do Windows — ligados uma vez só
let atalhosLigados = false;
function ligarAtalhos() {
  if (atalhosLigados) return;
  atalhosLigados = true;
  // Barra "/" leva o cursor para a busca de alunos (só quando não se está digitando em outro campo)
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.altKey || e.metaKey) return;
    const alvo = e.target;
    if (alvo.isContentEditable || (alvo.matches && alvo.matches('input, textarea, select'))) return;
    const busca = $('#busca');
    if (busca) { e.preventDefault(); busca.focus(); }
  });
  // Menu da conta: Esc ou clique fora fecha
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenuConta(); });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#menuConta, [aria-controls="menuConta"]')) fecharMenuConta(); });
  // Janela mudou de tamanho: o marcador das abas volta para baixo da aba certa
  addEventListener('resize', () => { const m = $('#abasGrupo .marcador'), a = $('#abasGrupo a.ativo'); if (!m || !a) return;
    m.classList.add('ja'); m.style.transform = `translateX(${a.offsetLeft}px)`; m.style.width = a.offsetWidth + 'px'; marcadorAntes = null;
    requestAnimationFrame(() => m.classList.remove('ja')); });
  // Quem nunca escolheu um tema acompanha o Windows na hora em que ele mudar
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('iel-tema')) aplicarTema(e.matches ? 'escuro' : 'claro');
    });
  } catch { /* navegador antigo */ }
}

// ───────────── ícones ─────────────
// Desenhados aqui mesmo (traço de 1.8, grade de 24) para ficarem iguais em qualquer Windows,
// ao contrário dos emojis, que cada computador desenha de um jeito.
const ICONES = {
  lixeira: '<path d="M3.6 6.4h16.8"/><path d="M8.4 6.4V4.6a1.4 1.4 0 0 1 1.4-1.4h4.4a1.4 1.4 0 0 1 1.4 1.4v1.8"/><path d="m18.4 6.4-.9 12.6a1.8 1.8 0 0 1-1.8 1.7H8.3A1.8 1.8 0 0 1 6.5 19L5.6 6.4"/><path d="M10 11v5.4M14 11v5.4"/>',
  casa: '<path d="M4 10.6 12 4.2l8 6.4V19a1.6 1.6 0 0 1-1.6 1.6h-3.6v-5.6H9.2v5.6H5.6A1.6 1.6 0 0 1 4 19z"/>',
  dia: '<path d="M9 4.6H6.6A1.6 1.6 0 0 0 5 6.2v13.2A1.6 1.6 0 0 0 6.6 21h10.8a1.6 1.6 0 0 0 1.6-1.6V6.2a1.6 1.6 0 0 0-1.6-1.6H15"/><path d="M9.4 3h5.2a.8.8 0 0 1 .8.8v1.6a.8.8 0 0 1-.8.8H9.4a.8.8 0 0 1-.8-.8V3.8a.8.8 0 0 1 .8-.8z"/><path d="m8.8 13.4 2.2 2.2 4.4-4.4"/>',
  alunos: '<path d="M15.5 20.5v-1.7a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.8v1.7"/><path d="M9.2 12a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4z"/><path d="M21 20.5v-1.7a3.4 3.4 0 0 0-2.6-3.3"/><path d="M15.8 4.8a3.4 3.4 0 0 1 0 6.6"/>',
  rematricula: '<path d="M12 20.5h8.5"/><path d="M16.6 4.6a2.1 2.1 0 0 1 3 3L8.2 19 4 20l1-4.2z"/>',
  pendencias: '<path d="M14 3.2H7.4a2 2 0 0 0-2 2v13.6a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V8z"/><path d="M14 3.2V8h4.6"/><path d="M12 11.4v3.4"/><path d="M12 18.1h.01"/>',
  interessados: '<path d="M14.5 20.5v-1.7a3.4 3.4 0 0 0-3.4-3.4H5.9a3.4 3.4 0 0 0-3.4 3.4v1.7"/><path d="M8.7 12a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4z"/><path d="M18.5 8.2v5.6"/><path d="M21.3 11h-5.6"/>',
  documentos: '<path d="M7 8.2V3.6h10v4.6"/><path d="M7 17.4H5.6A1.6 1.6 0 0 1 4 15.8v-5.2a1.6 1.6 0 0 1 1.6-1.6h12.8a1.6 1.6 0 0 1 1.6 1.6v5.2a1.6 1.6 0 0 1-1.6 1.6H17"/><path d="M7 14.4h10v6H7z"/>',
  extras: '<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7.9-5.6-4-3.9 5.6-.8z"/>',
  bolsas: '<path d="m12 3.8 9.2 4.4L12 12.6 2.8 8.2z"/><path d="M6.6 10.4v5.2c0 1.5 2.4 2.8 5.4 2.8s5.4-1.3 5.4-2.8v-5.2"/><path d="M20.4 9v5.4"/>',
  boletos: '<path d="M3.6 6.4h16.8A1.6 1.6 0 0 1 22 8v8a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 16V8a1.6 1.6 0 0 1 1.6-1.6z"/><path d="M2 10.4h20"/><path d="M6 14h3.4"/>',
  fotos: '<path d="M4 8.6h3l1.5-2.2h7l1.5 2.2h3A1.6 1.6 0 0 1 21.6 10v8a1.6 1.6 0 0 1-1.6 1.6H4A1.6 1.6 0 0 1 2.4 18v-8A1.6 1.6 0 0 1 4 8.6z"/><path d="M12 16.8a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z"/>',
  portao: '<path d="M5.4 20.8V4.8a1.6 1.6 0 0 1 1.6-1.6h10a1.6 1.6 0 0 1 1.6 1.6v16"/><path d="M3 20.8h18"/><path d="M14.6 12.4h.01"/>',
  atendimentos: '<path d="M21 16.6V19a1.6 1.6 0 0 1-1.8 1.6 15.9 15.9 0 0 1-6.9-2.5 15.6 15.6 0 0 1-4.8-4.8A15.9 15.9 0 0 1 5 6.4 1.6 1.6 0 0 1 6.6 4.6H9a1.6 1.6 0 0 1 1.6 1.4c.1.9.3 1.7.6 2.5a1.6 1.6 0 0 1-.4 1.7l-1 1a12.8 12.8 0 0 0 4.8 4.8l1-1a1.6 1.6 0 0 1 1.7-.4c.8.3 1.6.5 2.5.6A1.6 1.6 0 0 1 21 16.6z"/>',
  calendario: '<path d="M6.6 5.4h10.8A1.6 1.6 0 0 1 19 7v11.4a1.6 1.6 0 0 1-1.6 1.6H6.6A1.6 1.6 0 0 1 5 18.4V7a1.6 1.6 0 0 1 1.6-1.6z"/><path d="M15.8 3.6v3.2"/><path d="M8.2 3.6v3.2"/><path d="M5 10.4h14"/>',
  mensagens: '<path d="M20.6 12.2a7.6 7.6 0 0 1-8.2 7.6 8.6 8.6 0 0 1-3.3-.7L4 20.6l1.5-4.6a8.1 8.1 0 0 1-.8-3.5 7.6 7.6 0 0 1 7.6-8.2h.5a7.6 7.6 0 0 1 7.8 7.9z"/>',
  config: '<path d="M4 20.6v-6.2M4 10.4V3.4M12 20.6v-8.2M12 8.4v-5M20 20.6v-4.2M20 12.4v-9"/><path d="M1.6 14.4h4.8M9.6 8.4h4.8M17.6 16.4h4.8"/>',
  sair: '<path d="M9.4 20.6H6a1.8 1.8 0 0 1-1.8-1.8V5.2A1.8 1.8 0 0 1 6 3.4h3.4"/><path d="m16 16.6 4.6-4.6L16 7.4"/><path d="M20.6 12H9.4"/>',
  relatorios: '<path d="M14 3.2H7.4a2 2 0 0 0-2 2v13.6a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V8z"/><path d="M14 3.2V8h4.6"/><path d="M9 17v-3.4"/><path d="M12 17v-6"/><path d="M15 17v-2"/>',
  historico: '<path d="M3.4 5.4c2.9-1.1 5.8-.9 8.6.9v13.4c-2.8-1.8-5.7-2-8.6-.9z"/><path d="M20.6 5.4c-2.9-1.1-5.8-.9-8.6.9v13.4c2.8-1.8 5.7-2 8.6-.9z"/>',
  vivencias: '<path d="M10 8.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M4.4 20.8v-3.2a5.6 5.6 0 0 1 11.2 0v3.2"/><path d="M19 4.4v4.4M16.8 6.6h4.4"/>',
  lua: '<path d="M20.4 14.2A8.6 8.6 0 1 1 9.8 3.6a6.7 6.7 0 0 0 10.6 10.6z"/>',
  sol: '<path d="M12 17.2a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4z"/><path d="M12 1.8v2.4M12 19.8v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7"/>',
  relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pasta: '<path d="M14 3.2H7.4a2 2 0 0 0-2 2v13.6a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V8z"/><path d="M14 3.2V8h4.6M9 12.5h6M9 16h4"/>',
  celular: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  cadeado: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  chave: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l2.5 2.5M14.5 8.5l2 2"/>',
  balcao: '<circle cx="12" cy="7" r="3.2"/><path d="M5.5 20.5v-2.2A4.8 4.8 0 0 1 10.3 13.5h3.4a4.8 4.8 0 0 1 4.8 4.8v2.2"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  volta: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  escudo: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.2 2.2 4.4-4.4"/>',
  alerta: '<path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
  alvo: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="3"/>',
  ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  copia: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  arquivo: '<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v8.3A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  lupa: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  importar: '<path d="M12 3.5v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M4 16.5v2A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-2"/>',
  carteira: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-1.3 1.6-2 3-2s2.5.7 3 2M14.5 10h4M14.5 13.5h3"/>',
  compacto: '<path d="M4 6.4h16M4 12h16M4 17.6h16"/>',
  largo: '<path d="M4 5h16M4 12h16M4 19h16"/><path d="m8 8.6 4-3.6 4 3.6"/>',
};
const icone = (nome, classe = 'ic') => `<svg class="${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome] || ''}</svg>`;

// Bloco para quando não há nada para mostrar: explica e oferece o próximo passo
function vazio(nomeIcone, titulo2, texto, acaoHtml = '') {
  return `<div class="nada">${icone(nomeIcone, 'ic-grande')}<h3>${esc(titulo2)}</h3><p>${esc(texto)}</p>${acaoHtml}</div>`;
}

// ───────────── login ─────────────
// Metade escura da entrada: o logo da escola, o nome e as faixas dos turnos (manhã em azul, tarde em amarelo)
const ARTE_LOGIN = `<div class="login-arte">
    <span class="logo-grande"><img src="logo-escuro.png" alt="Instituto Educacional Luterano"></span>
    <div><div class="login-nome">Secretaria IEL</div><h1><em>S</em>EK</h1>
      <p>Matrícula, documentos, portão e o dia a dia da secretaria num lugar só. Funciona sem internet, num computador da escola.</p>
      <div class="faixas" aria-hidden="true"><i style="width:62%;background:#1c3c73;animation-delay:.05s"></i><i style="width:74%;background:#1c3c73;animation-delay:.12s"></i>
        <i style="width:48%;margin-left:44%;background:#6b5611;animation-delay:.19s"></i><i style="width:52%;margin-left:48%;background:#6b5611;animation-delay:.26s"></i>
        <i style="width:58%;margin-left:42%;background:#f5c21b;animation-delay:.33s"></i></div></div>
    <small>Instituto Educacional Luterano · Ferraz de Vasconcelos</small></div>`;

// Tela de espera (reiniciando, restaurando, atualizando): a mesma arte da entrada, com um recado e o sinal de "trabalhando"
function telaAguarde(tituloTxt, textoHtml) {
  $('#raiz').innerHTML = `<div class="login">${ARTE_LOGIN}<div class="login-form"><div class="aguarde" role="status">
    <span class="girando" aria-hidden="true"></span><h2>${esc(tituloTxt)}</h2><p>${textoHtml}</p></div></div></div>`;
}

function telaLogin() {
  document.title = 'Entrar — ' + NOME_APP;
  $('#raiz').innerHTML = `
  <div class="login">${ARTE_LOGIN}<div class="login-form"><form id="f" autocomplete="on">
    <div><div class="quando">Gestão da secretaria escolar</div><h2>Entrar</h2></div>
    <div class="campo"><label for="l">Usuário</label><input id="l" name="username" autocomplete="username" required autofocus></div>
    <div class="campo"><label for="s">Senha</label><input id="s" type="password" name="password" autocomplete="current-password" required></div>
    <div class="erro" id="e"></div>
    <button class="btn pri">Entrar</button>
  </form></div></div>`;
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    try { await api('POST', '/api/login', { login: $('#l').value.trim(), senha: $('#s').value }); iniciar(); }
    catch (e) { $('#e').textContent = e.message; }
  };
}

function telaTrocarSenha(obrigatoria) {
  $('#raiz').innerHTML = `
  <div class="login">${ARTE_LOGIN}<div class="login-form"><form id="f">
    <div><div class="quando">${obrigatoria ? 'Primeiro acesso' : 'Sua conta'}</div><h2>${obrigatoria ? 'Crie sua senha' : 'Trocar senha'}</h2>
      <p>${obrigatoria ? 'Troque a senha inicial por uma só sua.' : 'Mínimo de 8 caracteres. Senhas óbvias são recusadas.'}</p></div>
    <div class="campo"><label for="a">Senha atual</label><input id="a" type="password" autocomplete="current-password" required></div>
    <div class="campo"><label for="n">Nova senha (mín. 8 caracteres)</label><input id="n" type="password" autocomplete="new-password" minlength="8" required></div>
    <div class="campo"><label for="n2">Repita a nova senha</label><input id="n2" type="password" autocomplete="new-password" required></div>
    <div class="erro" id="e"></div>
    <button class="btn pri">Salvar senha</button>
    ${obrigatoria ? '' : '<button type="button" class="btn" id="voltar">Voltar sem trocar</button>'}
  </form></div></div>`;
  if (!obrigatoria) $('#voltar').onclick = () => iniciar();
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    if ($('#n').value !== $('#n2').value) return ($('#e').textContent = 'As senhas não conferem');
    try { await api('POST', '/api/trocar-senha', { atual: $('#a').value, nova: $('#n').value }); toast('Senha alterada!'); iniciar(); }
    catch (e) { $('#e').textContent = e.message; }
  };
}

// ───────────── estrutura ─────────────
// As mesmas telas e a mesma ordem do menu de antes, agora em 6 grupos: o grupo fica no trilho da esquerda
// e as telas dele viram abas no alto. "badge" é o contador amarelo; "admin" só aparece para a administração.
const GRUPOS = [
  { id: 'hoje', nome: 'Hoje', ic: 'relogio', telas: [
    { rota: '', nome: 'Início' },
    { rota: 'hoje', nome: 'Meu dia', badge: 'tarefas' }] },
  { id: 'alunos', nome: 'Alunos', ic: 'alunos', telas: [
    { rota: 'alunos', nome: 'Alunos' },
    { rota: 'historico', nome: 'Histórico escolar' },
    { rota: 'fotos', nome: 'Mutirão de fotos' }] },
  { id: 'matricula', nome: 'Matrícula', ic: 'rematricula', telas: [
    { rota: 'rematricula', nome: 'Rematrícula' },
    { rota: 'pendencias', nome: 'Pendências', badge: 'pend' },
    { rota: 'interessados', nome: 'Interessados (SIG)' },
    { rota: 'vivencias', nome: 'Vivências' }] },
  { id: 'secretaria', nome: 'Secretaria', ic: 'pasta', telas: [
    { rota: 'documentos', nome: 'Documentos' },
    { rota: 'extras', nome: 'Atividades extras' },
    { rota: 'bolsas', nome: 'Bolsas (CEBAS)', admin: true },
    { rota: 'boletos', nome: 'Boletos' }] },
  { id: 'dia', nome: 'Dia a dia', ic: 'portao', telas: [
    { rota: 'portao', nome: 'Portão · Saída', badge: 'saida' },
    { rota: 'atendimentos', nome: 'Atendimentos' },
    { rota: 'calendario', nome: 'Calendário' }] },
  { id: 'gestao', nome: 'Gestão', ic: 'config', telas: [
    { rota: 'relatorios', nome: 'Relatórios', admin: true },
    { rota: 'mensagens', nome: 'Mensagens' },
    { rota: 'lixeira', nome: 'Lixeira' },
    { rota: 'config', nome: 'Configurações', admin: true }] },
];
// Telas que não estão no menu, mas pertencem a um grupo (ficha do aluno, notas de um aluno)
const ROTA_PAI = { aluno: 'alunos', hist: 'historico' };
const gruposVisiveis = () => GRUPOS.map((g) => ({ ...g, telas: g.telas.filter((t) => !t.admin || EU.perfil === 'admin') })).filter((g) => g.telas.length);
const grupoDaRota = (rota) => { const r = ROTA_PAI[rota] ?? rota; return gruposVisiveis().find((g) => g.telas.some((t) => t.rota === r)) || gruposVisiveis()[0]; };

// Contadores amarelos: guardados aqui porque as abas são redesenhadas a cada troca de tela
const BADGES = {};
function definirBadge(id, n) {
  BADGES[id] = n || 0;
  const b = $('#badge-' + id);
  if (b) { b.hidden = !n; b.textContent = n; }
  // no trilho, o grupo mostra a soma dos contadores das telas dele
  for (const g of gruposVisiveis()) {
    const soma = g.telas.reduce((s, t) => s + (t.badge ? BADGES[t.badge] || 0 : 0), 0);
    const p = $(`.grupos a[data-grupo="${g.id}"] .ponto`);
    if (p) { p.hidden = !soma; p.textContent = soma; }
  }
}

// Abas do grupo atual; o marcador desliza da aba de antes para a nova (se o grupo não mudou)
let grupoNaTela = null, marcadorAntes = null;
function desenharNavegacao(rota) {
  const g = grupoDaRota(rota), r = ROTA_PAI[rota] ?? rota;
  const mudouGrupo = grupoNaTela !== g.id; grupoNaTela = g.id;
  $$('.grupos a').forEach((a) => a.classList.toggle('ativo', a.dataset.grupo === g.id));
  const abas = $('#abasGrupo');
  abas.innerHTML = `<span class="marcador${mudouGrupo ? ' ja' : ''}" aria-hidden="true"></span>` + g.telas.map((t) => `<a href="#/${t.rota}" data-rota="${t.rota}" class="${t.rota === r ? 'ativo' : ''}"
    ${t.rota === r ? 'aria-current="page"' : ''}>${esc(t.nome)}${t.badge ? `<span class="num" id="badge-${t.badge}" ${BADGES[t.badge] ? '' : 'hidden'}>${BADGES[t.badge] || ''}</span>` : ''}</a>`).join('');
  const tela = g.telas.find((t) => t.rota === r);
  $('#ondeGrupo').textContent = g.id === 'matricula' ? 'Matrícula ' + EU.config.ano_matricula : g.nome;
  $('#ondeTela').textContent = rota === 'aluno' ? 'Ficha do aluno' : rota === 'hist' ? 'Notas do aluno' : tela ? tela.nome : '';
  const m = $('.marcador', abas), alvo = $('a.ativo', abas);
  if (!alvo) { m.hidden = true; return; }
  if (!mudouGrupo && marcadorAntes) { m.style.transform = marcadorAntes.t; m.style.width = marcadorAntes.w; m.getBoundingClientRect(); }
  marcadorAntes = { t: `translateX(${alvo.offsetLeft}px)`, w: alvo.offsetWidth + 'px' };
  m.style.transform = marcadorAntes.t; m.style.width = marcadorAntes.w;
  if (mudouGrupo) requestAnimationFrame(() => m.classList.remove('ja'));
  alvo.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// Menu da conta (avatar): nasce do botão que o abriu e fecha ao clicar fora ou com Esc
function abrirMenuConta(botao) {
  const m = $('#menuConta');
  if (m.classList.contains('aberto')) return fecharMenuConta();
  const r = botao.getBoundingClientRect();
  const embaixo = r.top > innerHeight / 2;
  m.style.left = Math.min(r.left < 120 ? r.right + 10 : r.right - 250, innerWidth - 266) + 'px';
  m.style.top = embaixo ? 'auto' : r.bottom + 8 + 'px';
  m.style.bottom = embaixo ? innerHeight - r.bottom + 'px' : 'auto';
  m.style.transformOrigin = `${r.left < 120 ? 'left' : 'right'} ${embaixo ? 'bottom' : 'top'}`;
  $('#mcTema').innerHTML = `${icone(temaAtual() === 'escuro' ? 'sol' : 'lua')}${temaAtual() === 'escuro' ? 'Modo claro' : 'Modo escuro'}`;
  $('#mcDensidade').innerHTML = `${icone(densidadeAtual() === 'compacta' ? 'largo' : 'compacto')}${densidadeAtual() === 'compacta' ? 'Linhas normais' : 'Modo compacto'}`;
  m.classList.add('aberto');
  botao.setAttribute('aria-expanded', 'true');
}
function fecharMenuConta() {
  const m = $('#menuConta');
  if (!m || !m.classList.contains('aberto')) return false;
  m.classList.remove('aberto');
  $$('[aria-controls="menuConta"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  return true;
}

async function iniciar() {
  try { EU = await api('GET', '/api/eu'); } catch { return; }
  if (EU.trocar_senha) return telaTrocarSenha(true);
  grupoNaTela = null; marcadorAntes = null; hashNaTela = null;
  const h = new Date().getHours();
  const perfil = EU.perfil === 'admin' ? 'Administração' : 'Aprendiz';
  document.title = NOME_APP + ' · Secretaria IEL'; // a aba do navegador deixava de dizer "Entrar" só ao recarregar
  $('#raiz').innerHTML = `
  <div class="app">
    <nav class="trilho" aria-label="Menu principal">
      <a class="logo" href="#/" title="${NOME_APP} · Secretaria IEL — Instituto Educacional Luterano"><img class="logo-claro" src="logo.png" alt="Instituto Educacional Luterano"><img class="logo-escuro" src="logo-escuro.png" alt="Instituto Educacional Luterano"></a>
      <span class="marca-app" aria-hidden="true"><em>${esc(NOME_APP.slice(0, 1))}</em>${esc(NOME_APP.slice(1))}</span>
      <div class="grupos">${gruposVisiveis().map((g) => `<a href="#/${g.telas[0].rota}" data-grupo="${g.id}">${icone(g.ic)}${esc(g.nome)}<span class="ponto" hidden></span></a>`).join('')}</div>
      <div class="trilho-pe">
        <button id="tema" class="icone-btn"></button>
        <button class="avatar" id="conta" aria-haspopup="menu" aria-controls="menuConta" aria-expanded="false" title="${esc(EU.nome)} · ${perfil}">${esc(EU.nome[0])}</button>
      </div>
    </nav>
    <div class="principal">
      <header class="topo">
        <div class="topo-linha">
          <div class="onde"><b id="ondeGrupo"></b><span id="ondeTela"></span></div>
          <div class="busca"><input id="busca" placeholder="Buscar em tudo: aluno, responsável, CPF, atendimento…" autocomplete="off" aria-label="Buscar em todo o sistema" title="Dica: aperte a tecla / para vir direto para cá"><kbd>/</kbd><div class="resultados" id="res" hidden></div></div>
          <button class="ajuda-btn" id="ajuda" title="Como usar esta tela (tecla ?)" aria-label="Ajuda desta tela">?</button>
          <button class="avatar so-celular" id="conta2" aria-haspopup="menu" aria-controls="menuConta" aria-expanded="false" aria-label="Conta de ${esc(EU.nome)}" style="width:36px;height:36px">${esc(EU.nome[0])}</button>
        </div>
        <nav class="abas-grupo" id="abasGrupo" aria-label="Telas do grupo"></nav>
      </header>
      <div id="avisos"></div><div id="rascunhos"></div>
      <main class="conteudo" id="conteudo"></main>
    </div>
  </div>
  <div class="menu-conta" id="menuConta" role="menu">
    <div class="quem"><b>${esc(EU.nome)}</b><small id="saudacao"></small><br><small>${perfil}</small></div>
    <button role="menuitem" id="mcTema"></button>
    <button role="menuitem" id="mcDensidade"></button>
    <button role="menuitem" id="mcBloquear">${icone('cadeado')}Bloquear a tela</button>
    <button role="menuitem" id="mcSenha">${icone('chave')}Trocar senha</button>
    <button role="menuitem" id="sair">${icone('sair')}Sair</button>
  </div>`;
  $('#saudacao').textContent = `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}!`;
  $('#sair').onclick = tentar(async () => { fecharMenuConta(); await api('POST', '/api/logout'); EU = null; telaLogin(); });
  aplicarTema(temaAtual());
  $('#tema').onclick = () => aplicarTema(temaAtual() === 'escuro' ? 'claro' : 'escuro', true);
  $('#conta').onclick = (e) => abrirMenuConta(e.currentTarget);
  $('#conta2').onclick = (e) => abrirMenuConta(e.currentTarget);
  $('#mcTema').onclick = () => { fecharMenuConta(); aplicarTema(temaAtual() === 'escuro' ? 'claro' : 'escuro', true); };
  $('#mcDensidade').onclick = () => { fecharMenuConta(); aplicarDensidade(densidadeAtual() === 'compacta' ? 'normal' : 'compacta', true); };
  $('#mcSenha').onclick = () => { fecharMenuConta(); telaTrocarSenha(false); };
  // Bloquear na hora (o mesmo bloqueio de quando o computador fica parado)
  $('#mcBloquear').onclick = tentar(async () => { fecharMenuConta(); await api('POST', '/api/bloquear'); if (window.mostrarBloqueio) window.mostrarBloqueio(); });
  aplicarDensidade(densidadeAtual());
  ligarAtalhos();
  if (window.ligarBloqueio) window.ligarBloqueio();
  avisarVersaoAntiga();
  if (EU.bloqueada && window.mostrarBloqueio) window.mostrarBloqueio();
  configurarBusca();
  if (window.ligarAjuda) window.ligarAjuda();
  window.onhashchange = rotear;
  rotear();
}

let cacheAlunos = null;
async function alunosBusca() { if (!cacheAlunos) cacheAlunos = await api('GET', '/api/alunos'); return cacheAlunos; }
const invalidar = () => { cacheAlunos = null; };

function configurarBusca() {
  const inp = $('#busca'), res = $('#res');
  let sel = -1, espera, pedido = 0;
  // Busca global: procura em tudo (alunos, atendimentos, avisos, quem busca, SIG, documentos, bolsas) e agrupa por tipo
  const ICONE_GRUPO = { aluno: 'alunos', autorizado: 'portao', aviso: 'portao', atendimento: 'atendimentos', interessado: 'interessados', documento: 'documentos', bolsa: 'bolsas', vivencia: 'vivencias' };
  const mostrar = async () => {
    const texto = inp.value.trim();
    if (norm(texto).length < 2) { res.hidden = true; return; }
    const meu = ++pedido;
    const r = await api('GET', '/api/busca?q=' + encodeURIComponent(texto));
    if (meu !== pedido) return; // chegou a resposta de uma busca mais velha: ignora
    sel = -1;
    res.innerHTML = r.grupos.length ? r.grupos.map((g) => `<div class="grupo-busca">${icone(ICONE_GRUPO[g.tipo] || 'alunos')}${esc(g.nome)}
        <span>${g.total > g.itens.length ? `${g.itens.length} de ${g.total}` : g.total}</span></div>
      ${g.itens.map((i) => `<a href="${esc(i.link)}"><b>${esc(titulo(i.titulo))}</b><br><small>${esc(i.detalhe)}</small></a>`).join('')}${g.todos && g.total > g.itens.length ? `<a class="ver-todos" href="${esc(g.todos)}">Ver todos os ${g.total} →</a>` : ''}`).join('')
      : `<div class="vazio">Nada encontrado para “${esc(texto)}”</div>`;
    res.hidden = false;
  };
  inp.oninput = () => { clearTimeout(espera); espera = setTimeout(tentar(mostrar), 180); };
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
  // "#/atendimentos?q=joao": o que vem depois do ? preenche o campo de busca da tela (#fq), usado pela busca global
  const [caminho, consulta] = location.hash.replace(/^#\/?/, '').split('?');
  const [rota, arg] = caminho.split('/');
  const qTela = new URLSearchParams(consulta || '').get('q');
  fecharMenuConta();
  desenharNavegacao(rota);
  const c = $('#conteudo');
  // Mesmo endereço de antes = só atualizar (depois de salvar, marcar ou excluir): a tela fica onde está,
  // sem esqueleto, sem animação de entrada e na mesma altura de rolagem. Endereço novo = navegar.
  const atualizando = hashNaTela === location.hash;
  hashNaTela = location.hash;
  const rolagem = scrollY, focado = atualizando ? seletorDoFoco(c) : null;
  if (atualizando) {
    c.style.minHeight = c.offsetHeight + 'px'; // segura a altura para a página não encolher e pular para cima
    // "quieta": o que for redesenhado não repete as animações de entrada (barras crescendo etc.) — só na navegação
    c.classList.add('atualizando', 'quieta');
  } else {
    c.classList.remove('quieta');
    // Esqueleto cinza no lugar de "Carregando…": a tela não "pula" quando o conteúdo chega
    c.innerHTML = `<div class="carregando"><div class="bloco" style="width:220px;height:26px"></div><div class="bloco" style="width:340px;height:14px;margin-top:8px"></div>
      <div class="grade g4" style="margin-top:20px">${'<div class="bloco" style="height:92px"></div>'.repeat(4)}</div>
      <div class="bloco" style="height:260px;margin-top:14px"></div></div>`;
  }
  try {
    await (TELAS[rota] || TELAS[''])(c, arg);
    const fq = $('#fq', c) || $('#q', c);
    if (qTela && fq) { fq.value = qTela; fq.dispatchEvent(new Event('input')); }
  } catch (e) { c.innerHTML = `<div class="cartao"><h2>Ops!</h2><p>${esc(e.message)}</p></div>`; }
  if (atualizando) {
    window.scrollTo(0, rolagem);
    const f = focado && $(focado, c);
    if (f) f.focus({ preventScroll: true });
    requestAnimationFrame(() => { c.style.minHeight = ''; c.classList.remove('atualizando'); });
  } else {
    // A tela nova chega com um leve movimento (reinicia a animação a cada troca de tela)
    c.classList.remove('entra'); void c.offsetWidth; c.classList.add('entra');
    window.scrollTo(0, 0);
  }
  atualizarBadge();
  mostrarRascunhos();
}
let hashNaTela = null;

async function atualizarBadge() {
  try {
    const p = await api('GET', '/api/painel');
    definirBadge('pend', p.pendencias.vencidas + p.pendencias.vencendo); // vencidas ou vencendo em 7 dias
    if (window.badgesEtapa3) window.badgesEtapa3();
    if (window.avisosEtapa4) window.avisosEtapa4();
  } catch { /* silencioso */ }
}

// ───────────── listas longas em partes ─────────────
// Com os ~535 alunos reais, algumas listas passavam de 30 telas de rolagem. Aqui a tabela mostra as primeiras
// PASSO_LISTA linhas e oferece "Mostrar mais" / "Mostrar todas". Na impressão sai sempre tudo.
// ligar(tbody): religa os cliques/campos das linhas (roda de novo a cada parte desenhada).
const PASSO_LISTA = 100;
function emPartes(tbody, linhas, { colunas, vazio = '', ligar } = {}) {
  const ant = tbody._partes;
  // Mesma lista redesenhada (ex.: depois de marcar uma caixa): mantém o quanto já estava aberto
  const mostrar = ant && ant.total === linhas.length ? ant.mostrar : PASSO_LISTA;
  tbody._partes = { linhas, colunas, vazio, ligar, total: linhas.length, mostrar };
  desenharPartes(tbody);
}
function desenharPartes(tbody) {
  const p = tbody._partes;
  if (!p.linhas.length) { tbody.innerHTML = p.vazio; if (p.ligar) p.ligar(tbody); return; }
  const n = Math.min(p.mostrar, p.linhas.length), resto = p.linhas.length - n;
  tbody.innerHTML = p.linhas.slice(0, n).join('') + (resto ? `<tr class="mais-linhas nao-imprimir"><td colspan="${p.colunas}">
    Mostrando <b>${n}</b> de <b>${p.linhas.length}</b>. <button type="button" class="btn peq" data-mais>Mostrar mais ${Math.min(PASSO_LISTA, resto)}</button>
    <button type="button" class="btn peq" data-todas>Mostrar todas</button> <span class="dado">Dica: os filtros acima encurtam a lista.</span></td></tr>` : '');
  const mais = $('[data-mais]', tbody), todas = $('[data-todas]', tbody);
  if (mais) mais.onclick = () => { p.mostrar += PASSO_LISTA; desenharPartes(tbody); };
  if (todas) todas.onclick = () => { p.mostrar = Infinity; desenharPartes(tbody); };
  if (p.ligar) p.ligar(tbody);
}
// Imprimir sempre sai com a lista inteira (e com as turmas fechadas abertas)
window.addEventListener('beforeprint', () => {
  $$('tbody').forEach((t) => { if (t._partes && t._partes.mostrar < t._partes.linhas.length) { t._partes.mostrar = Infinity; desenharPartes(t); } });
  $$('details.turma-grupo').forEach((d) => { d.open = true; });
});

const faixaDemo = (p) => (p.demo ? '<div class="faixa-demo">' + icone('alerta') + '<span><b>Modo demonstração:</b> os alunos exibidos são fictícios. Para usar dados reais, apague a demonstração e importe o ACADESC em Configurações.</span></div>' : '');

// ───────────── Início ─────────────
// Três blocos, na ordem em que a secretaria pensa: o que é para hoje, o que fazer rápido e como vai a rematrícula.
// Todo número é um link para a tela onde se resolve aquilo.
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
TELAS[''] = async (c) => {
  // /api/hoje é da Etapa 3: se por algum motivo falhar, o resto da página continua aparecendo
  const [p, h] = await Promise.all([api('GET', '/api/painel'), api('GET', '/api/hoje').catch(() => null)]);
  const cfg = EU.config;
  const s = p.porStatus, v = p.veteranos || 1;
  const pct = (n) => (100 * n / v).toFixed(1) + '%';
  const [aa, mm, dd] = hojeIso().split('-');
  const diasAte = (iso) => Math.round((Date.parse(iso) - Date.parse(hojeIso())) / 86400000);
  const datas = [
    ['Início das matrículas', cfg.data_inicio], ['Fim do desconto (plantão de sábado)', cfg.data_desconto],
    ['Fim da garantia de vaga', cfg.data_garantia_vaga], ['Encerramento das matrículas', cfg.data_fim],
  ].filter(([, d]) => d);
  const proxima = datas.findIndex(([, d]) => diasAte(d) >= 0);

  // Cartão que é um link: rótulo, número grande e uma linha explicando
  const bloco = (href, rot, val, det, classe = '') => `<a class="cartao kpi link ${classe}" href="${href}">
    <div class="rot">${esc(rot)}</div><div class="val">${val}</div><div class="det">${det}</div></a>`;
  let hoje = '';
  if (h) {
    const falta = h.tarefas.minhas - h.tarefas.minhas_feitas;
    const atras = h.lembretes_atrasados || 0;
    hoje = `<div class="grade g4 kpis">
      ${bloco('#/hoje', 'Minhas tarefas', falta ? `${falta} <small>a fazer</small>` : 'Em dia', `${h.tarefas.minhas_feitas} de ${h.tarefas.minhas} feitas hoje`, falta ? 'destaque' : 'ok')}
      ${bloco('#/portao', 'Portão · quem busca hoje', h.saida.pendentes ? `${h.saida.pendentes} <small>aguardando</small>` : h.saida.total ? 'Conferidos' : 'Nenhum aviso',
        h.saida.total ? `${plural(h.saida.total, 'aviso', 'avisos')} de saída hoje` : 'as famílias não avisaram nada', h.saida.pendentes ? 'alerta' : 'ok')}
      ${bloco('#/atendimentos', 'Atendimentos de hoje', h.atendimentos.em_aberto ? `${h.atendimentos.em_aberto} <small>em aberto</small>` : String(h.atendimentos.hoje),
        h.atendimentos.em_aberto ? `de ${plural(h.atendimentos.hoje, 'registrado', 'registrados')} hoje` : h.atendimentos.hoje ? 'todos resolvidos' : 'nenhum registrado ainda', h.atendimentos.hoje && !h.atendimentos.em_aberto ? 'ok' : '')}
      ${bloco('#/calendario', 'Lembretes de ' + MESES[+mm - 1], String(h.lembretes_total), atras ? `<span class="aviso-num">${plural(atras, 'atrasado', 'atrasados')}</span>` : 'nada atrasado', atras ? 'alerta' : '')}
    </div>`;
  }

  // Frase do dia: soma o que ainda pede a pessoa (tarefas dela, saídas sem conferir, atendimentos em aberto)
  const hr = new Date().getHours(), oi = hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
  const nT = h ? h.tarefas.minhas - h.tarefas.minhas_feitas : 0, nS = h ? h.saida.pendentes : 0, nA = h ? h.atendimentos.em_aberto : 0, n = nT + nS + nA;
  c.innerHTML = `${faixaDemo(p)}
  <div class="hero"><div>
      <div class="quando">${esc(h ? h.dia_nome + ', ' : '')}${+dd} de ${MESES[+mm - 1]} de ${aa}</div>
      <h1>${oi}, ${esc(EU.nome.split(' ')[0])}.<br>${n ? `<em>${n} ${n === 1 ? 'coisa pede' : 'coisas pedem'}</em> você.` : '<em>Tudo em dia.</em>'}</h1>
      ${h ? `<p><b>${plural(nS, 'saída', 'saídas')}</b> aguardando no portão, <b>${plural(nT, 'tarefa sua', 'tarefas suas')}</b> por fazer e
        <b>${plural(nA, 'atendimento', 'atendimentos')}</b> em aberto. Clique em qualquer número para abrir a tela.</p>` : ''}</div>
    <div class="relogio"><div class="t" id="relogioT"></div><div class="s">${p.total_alunos} alunos ativos</div></div></div>
  ${h ? linhaDoDia(h, cfg) : ''}

  <h2 class="titulo-secao" style="margin-top:4px">Para hoje</h2>
  ${hoje}
  <div class="atalhos">
    <button class="btn" id="atAtend">${icone('atendimentos')}Registrar atendimento</button>
    <a class="btn" href="#/portao">${icone('portao')}Consultar o portão</a>
    <a class="btn" href="#/documentos">${icone('documentos')}Emitir documento</a>
    <button class="btn" id="atBusca">${icone('alunos')}Buscar em tudo <kbd>/</kbd></button>
    <button class="btn" id="atNovo">${icone('interessados')}Cadastrar aluno novo</button>
  </div>

  <div class="acoes titulo-secao" style="justify-content:space-between"><span>Matrícula e rematrícula ${p.ano}</span><a href="#/rematricula">Ver por série →</a></div>
  <div class="grade g4 kpis">
    ${bloco('#/rematricula', 'Rematrículas concluídas', `${s.concluida}<small> / ${p.veteranos}</small>`, `${pct(s.concluida)} dos veteranos (sem 3ª série EM)`, 'destaque')}
    ${bloco('#/rematricula', 'Em andamento', String(s.reservada), 'pagaram matrícula, falta concluir')}
    ${bloco('#/rematricula', 'Ainda não iniciaram', String(s.pendente), 'famílias para contatar')}
    ${bloco('#/pendencias', 'Pendências de documentos', String(p.pendencias.total), `${p.pendencias.vencidas} vencidas · ${p.pendencias.vencendo} vencendo em 7 dias`, p.pendencias.vencidas ? 'alerta' : '')}
  </div>
  <div class="cartao" style="margin-top:14px">
    <div class="barra" role="img" aria-label="Concluídas ${s.concluida}, em andamento ${s.reservada}, não vão renovar ${s.nao_renova + s.transferido}, não iniciadas ${s.pendente}">
      <i class="b-concl" style="width:${pct(s.concluida)}"></i><i class="b-and" style="width:${pct(s.reservada)}"></i><i class="b-nao" style="width:${pct(s.nao_renova + s.transferido)}"></i></div>
    <div class="legenda"><span><i class="b-concl"></i>Concluídas ${s.concluida}</span><span><i class="b-and"></i>Em andamento ${s.reservada}</span><span><i class="b-nao"></i>Não renovam ${s.nao_renova + s.transferido}</span><span><i style="background:var(--cinza-claro)"></i>Não iniciadas ${s.pendente}</span>
      <span>· Alunos novos matriculados: <b>${p.novos}</b></span><span>· Concluintes (3ª EM): <b>${p.concluintes}</b></span></div>
  </div>
  <div class="grade g2" style="margin-top:14px">
    <div class="cartao"><div class="acoes" style="justify-content:space-between"><h3 style="margin:0">Documentos vencidos ou vencendo</h3>
        ${p.urgentes.length ? `<span class="dado">${plural(p.pendencias.vencidas + p.pendencias.vencendo, 'aluno', 'alunos')}</span>` : ''}</div>
      ${p.urgentes.length ? `<table style="margin-top:6px"><tbody>${p.urgentes.slice(0, 5).map((u) => `<tr class="clic" data-id="${u.aluno_id}" title="Falta: ${esc(u.faltam.join(', '))}"><td><b>${esc(titulo(u.nome))}</b><br><small class="dado">${esc(u.turma)} · ${u.faltam.length === 1 ? 'falta: ' + esc(u.faltam[0]) : `faltam ${u.faltam.length} documentos`}</small></td>
        <td class="num-col"><span class="tag t-${u.situacao}">${u.dias == null ? 'sem data' : u.dias < 0 ? `venceu há ${-u.dias}d` : u.dias === 0 ? 'vence hoje' : `em ${u.dias}d`}</span></td></tr>`).join('')}</tbody></table>
        <p style="margin:10px 0 0"><a href="#/pendencias">Ver todas as pendências por turma →</a></p>` : '<p class="vazio">Nenhum documento vencido ou vencendo.</p>'}
    </div>
    <div class="cartao"><h3>Datas da campanha ${p.ano}</h3><div class="datas">
      ${datas.map(([rot, d], i) => { const n = diasAte(d); return `<div class="data-item ${n < 0 ? 'passou' : ''} ${i === proxima ? 'proxima' : ''}"><span>${esc(rot)}${i === proxima ? ` <span class="tag t-reservada">${n === 0 ? 'é hoje' : 'próxima'}</span>` : ''}</span><span><b>${dataBR(d)}</b> ${n > 0 ? `· ${n === 1 ? 'falta' : 'faltam'} ${plural(n, 'dia', 'dias')}` : n < 0 ? '· passou' : ''}</span></div>`; }).join('')}
      </div>
      <div class="acoes" style="justify-content:space-between;margin-top:16px"><h3 style="margin:0">Interessados (SIG)</h3><a href="#/interessados">Abrir o funil →</a></div>
      <div class="kanban-mini" style="margin-top:8px">${Object.entries(STATUS_INT).map(([k, r]) => `<span class="tag t-${k === 'matriculado' ? 'concluida' : k === 'desistiu' ? 'sem_prazo' : 'novo'}">${r}: ${p.interessados[k] || 0}</span>`).join('')}</div>
    </div>
  </div>`;
  $$('tr[data-id]', c).forEach((tr) => (tr.onclick = () => (location.hash = '#/aluno/' + tr.dataset.id)));
  $('#atAtend').onclick = tentar(async () => {
    if (typeof formAtendimento !== 'function') { location.hash = '#/atendimentos'; return; }
    formAtendimento(await api('GET', '/api/atendimentos'));
  });
  $('#atBusca').onclick = () => $('#busca').focus();
  $('#atNovo').onclick = () => formAluno();
  ligarLinhaDoDia();
};

// ───────────── Linha do dia (Início) ─────────────
// Faixas com os horários de cada segmento (Configurações › Geral) e os avisos de saída de hoje no horário em que foram marcados.
const DIA_INI = 7 * 60, DIA_FIM = 19 * 60;
const posDia = (m) => ((Math.min(Math.max(m, DIA_INI), DIA_FIM) - DIA_INI) / (DIA_FIM - DIA_INI)) * 100;
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
// "das 13h30 às 18h" → [810, 1080]; "12:35" → 755
const minutosDe = (txt) => [...String(txt || '').matchAll(/(\d{1,2})\s*[h:]\s*(\d{2})?/g)].map((m) => +m[1] * 60 + (+m[2] || 0));
function linhaDoDia(h, cfg) {
  const faixas = [['Fund. II', '6º ao 9º ano', cfg.horario_fund2], ['Ensino Médio', '1ª a 3ª série', cfg.horario_medio],
    ['Infantil', 'Maternal e Jardim', cfg.horario_infantil], ['Fund. I', '1º ao 5º ano', cfg.horario_fund1]]
    .map(([n, s, t]) => [n, s, minutosDe(t)]).filter(([, , m]) => m.length >= 2 && m[1] > m[0]);
  if (!faixas.length) return '';
  const avisos = h.saida.avisos.map((v) => ({ ...v, min: minutosDe(v.horario)[0] })).filter((v) => v.min != null);
  const semHora = h.saida.avisos.length - avisos.length;
  return `<section class="dia" aria-label="Linha do dia">
    <div class="dia-cab"><h2>Linha do dia</h2><div class="dia-leg"><span><i class="b-manha"></i>Manhã</span><span><i class="b-tarde"></i>Tarde</span>
      <span><i style="background:var(--laranja);border-radius:50%;width:9px;height:9px"></i>Saída aguardando</span><span><i style="background:var(--verde);border-radius:50%;width:9px;height:9px"></i>Saída conferida</span></div></div>
    <div class="dia-rolar"><div class="dia-grade">
      ${faixas.map(([n, s, [a, b]], i) => `<div class="faixa-nome">${esc(n)}<small>${esc(s)}</small></div><div class="faixa"><div class="barra-t ${a < 12 * 60 ? 'b-manha' : 'b-tarde'}"
        style="left:${posDia(a)}%;width:${posDia(b) - posDia(a)}%;--i:${i}">${hhmm(a)} – ${hhmm(b)}</div></div>`).join('')}
      <div class="faixa-nome">Portão<small>${h.saida.total ? plural(h.saida.total, 'aviso hoje', 'avisos hoje') : 'nenhum aviso hoje'}${semHora ? ` · ${semHora} sem horário` : ''}</small></div>
      <div class="faixa">${avisos.map((v, i) => `<a class="saida-pt ${v.conferido_em ? 'ok' : 'espera'}" href="#/portao" style="left:${posDia(v.min)}%;${i % 2 ? 'margin-left:4px;' : ''}"
        title="${esc(hhmm(v.min) + ' · ' + titulo(v.aluno) + ' com ' + v.quem)}" aria-label="${esc(titulo(v.aluno) + ', saída às ' + hhmm(v.min) + (v.conferido_em ? ', conferida' : ', aguardando'))}">${v.conferido_em ? '✓' : '!'}</a>`).join('')}</div>
      <div class="horas">${[7, 9, 11, 13, 15, 17, 19].map((x) => `<span style="left:${posDia(x * 60)}%">${x}h</span>`).join('')}</div>
      <div class="agora" id="agoraDia" style="left:116px" hidden></div>
    </div></div></section>`;
}
// A agulha vermelha sai do começo do dia e para na hora atual; depois anda sozinha a cada meio minuto
let relogioDia = null;
function ligarLinhaDoDia() {
  clearInterval(relogioDia);
  const passo = () => {
    const agulha = $('#agoraDia'), t = $('#relogioT');
    if (!t) { clearInterval(relogioDia); return; }
    const d = new Date(), m = d.getHours() * 60 + d.getMinutes();
    t.textContent = hhmm(m);
    if (!agulha) return;
    agulha.hidden = m < DIA_INI || m > DIA_FIM;
    agulha.dataset.t = hhmm(m);
    agulha.style.left = `calc(116px + (100% - 116px) * ${posDia(m) / 100})`;
  };
  requestAnimationFrame(() => requestAnimationFrame(passo));
  relogioDia = setInterval(passo, 30000);
}

// ───────────── Alunos ─────────────
TELAS.alunos = async (c) => {
  invalidar();
  const lista = await alunosBusca();
  // Primeiro dia de uso: ainda não há ninguém cadastrado
  if (!lista.length) {
    c.innerHTML = `<h1>Alunos</h1><div class="cartao">${vazio('alunos', 'Nenhum aluno cadastrado ainda',
      'Importe a exportação de alunos do ACADESC (.xlsx) para trazer a escola inteira de uma vez, ou carregue a demonstração para conhecer o sistema sem usar dados reais.',
      EU.perfil === 'admin' ? '<div class="acoes" style="justify-content:center"><a class="btn pri" href="#/config/importar">Importar do ACADESC</a><a class="btn" href="#/config/importar">Carregar demonstração</a></div>'
        : '<p class="dado">Peça à administração para importar os alunos.</p>')}</div>`;
    return;
  }
  const turmas = [...new Map(lista.map((a) => [a.turma_rotulo, a.ordem])).entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map((t) => t[0]);
  c.innerHTML = `
  <div class="acoes" style="justify-content:space-between"><div><h1>Alunos</h1><p class="sub">${lista.length} alunos ativos</p></div>
    <button class="btn ama" id="novo">${icone('mais')}Cadastrar aluno novo ${esc(EU.config.ano_matricula)}</button></div>
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
    emPartes($('#tb'), f.map((a) => `<tr class="clic" data-id="${a.id}"><td class="mono">${esc(a.mat || '—')}</td><td><b>${esc(titulo(a.nome))}</b> ${a.novo ? '<span class="tag t-novo">novo</span>' : ''}</td>
      <td>${esc(a.novo ? '—' : a.turma_rotulo)}</td><td>${esc(a.destino)}</td><td><span class="tag t-${a.status}">${STATUS[a.status]}</span></td><td>${esc(titulo(a.nome_resp || a.nome_mae || ''))}</td></tr>`), {
      colunas: 6, vazio: '<tr><td colspan="6" class="vazio">Nenhum aluno com esses filtros</td></tr>',
      ligar: (tb) => $$('tr[data-id]', tb).forEach((tr) => (tr.onclick = () => (location.hash = '#/aluno/' + tr.dataset.id))) });
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
        await salvarComVersao('/api/alunos/' + a.id, b, a);
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
      <a class="btn pri" href="/api/alunos/${a.id}/contrato" id="btnContrato">${icone('pasta')}Gerar contrato ${ano}</a>
      <button class="btn zap" id="btnZap">${icone('mensagens')}WhatsApp</button>
      <button class="btn" id="btnPasta">${icone('arquivo')}Abrir pasta</button>
      ${/^(F\d|EM\d)$/.test(a.serie_chave || '') ? `<a class="btn" href="#/hist/${a.id}">${icone('historico')}Notas do histórico</a>` : ''}
      <button class="btn" id="btnEditar">${icone('rematricula')}Editar</button>
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
      <div class="acoes" style="margin-top:12px"><button class="btn peq" id="pelosPdfs">${icone('lupa')}Marcar pelos PDFs da pasta</button>
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
  <div id="fichaEtapa3"></div>
  ${f.historico.length ? `<div class="cartao" style="margin-top:14px"><h2>Histórico</h2><table><tbody>${f.historico.map((h) => `<tr><td class="dado" style="width:150px">${new Date(h.quando).toLocaleString('pt-BR')}</td><td>${esc(h.usuario)}</td><td>${esc(h.acao)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;

  const salvarRem = tentar(async (corpo) => { await api('PUT', `/api/alunos/${a.id}/rematricula`, corpo); invalidar(); toast('Rematrícula atualizada'); rotear(); });
  $$('#stb button').forEach((b) => (b.onclick = () => salvarRem({ status: b.dataset.st })));
  $('#dest').onchange = (e) => salvarRem({ serie_destino: e.target.value });
  $('#dtm').onchange = (e) => e.target.value && salvarRem({ status: r.status, data_matricula: e.target.value });
  $('#robs').onchange = (e) => salvarRem({ obs: e.target.value });
  if ($('#spc')) $('#spc').onchange = (e) => salvarRem({ spc: e.target.value });
  $$('#docs input[type=checkbox]').forEach((cb) => (cb.onchange = tentar(async () => {
    await marcarNaHora(cb, () => api('PUT', `/api/alunos/${a.id}/documentos/${cb.dataset.doc}`, { entregue: cb.checked }));
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
  if (window.fichaEtapa3) window.fichaEtapa3($('#fichaEtapa3'), a, f).catch((e) => toast(e.message, true));
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
      ${g.capacidade && ocup > g.capacidade ? '<div class="det" style="color:var(--vermelho);margin-top:6px">acima da capacidade</div>' : ''}
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
    emPartes($('#tb'), f.map((a) => `<tr><td><a href="#/aluno/${a.id}"><b>${esc(titulo(a.nome))}</b></a> ${a.novo ? '<span class="tag t-novo">novo</span>' : ''}</td>
      <td>${esc(a.novo ? '—' : a.turma_rotulo)}</td><td>${esc(a.destino)}</td>
      <td><select data-id="${a.id}" aria-label="Situação">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${a.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td><span class="tag t-${a.status}">${STATUS[a.status]}</span></td></tr>`), {
      colunas: 5, vazio: '<tr><td colspan="5" class="vazio">Nenhum aluno</td></tr>',
      ligar: (tb) => $$('select', tb).forEach((s) => (s.onchange = tentar(async () => {
        await api('PUT', `/api/alunos/${s.dataset.id}/rematricula`, { status: s.value });
        const al = lista.find((x) => x.id === +s.dataset.id); al.status = s.value;
        toast('Atualizado: ' + titulo(al.nome)); desenhar();
      }))) });
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
    <button class="btn" id="imp">${icone('documentos')}Imprimir lista</button></div>
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
    // Lista longa (muitas turmas): cada turma começa fechada, com o resumo; filtrou ou é curta: tudo aberto
    const abertas = f.length <= PASSO_LISTA || ft || q;
    $('#corpo').innerHTML = f.length ? `<p class="dado nao-imprimir">${f.length} alunos · ${f.filter((p) => p.situacao === 'vencida').length} vencidos
        ${abertas ? '' : ' · <button class="btn peq" id="abrirTodas">Abrir todas as turmas</button> Clique numa turma para ver os alunos.'}</p>` +
      Object.keys(grupos).sort(porOrdem).map((t, i) => `<details class="cartao turma-grupo ${i ? 'quebra' : ''}" ${abertas ? 'open' : ''} style="margin-bottom:12px;padding:0">
        <summary><h3 style="padding:14px 16px 12px 8px;margin:0">${esc(t)} <span class="dado">(${grupos[t].length}${grupos[t].some((p) => p.situacao === 'vencida') ? ` · ${grupos[t].filter((p) => p.situacao === 'vencida').length} vencidos` : ''})</span><span class="so-impressao dado">Instituto Educacional Luterano · Pendências de documentos ${esc(EU.config.ano_matricula)} · impresso em ${dataBR(hojeIso())}</span></h3></summary>
        <div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Documentos faltantes</th><th>Prazo</th><th class="nao-imprimir"></th></tr></thead><tbody>
        ${grupos[t].map((p) => `<tr><td><a href="#/aluno/${p.aluno_id}"><b>${esc(titulo(p.nome))}</b></a>${p.novo ? ' <span class="tag t-novo">novo</span>' : ''}<br><small class="dado">Resp.: ${esc(titulo(p.responsavel))}</small></td>
          <td>${esc(p.faltam.join(', '))}</td>
          <td>${dataBR(p.prazo)} <span class="tag t-${p.situacao}">${p.dias == null ? '' : p.dias < 0 ? `venceu há ${-p.dias}d` : p.dias === 0 ? 'hoje' : `${p.dias}d`}</span></td>
          <td class="nao-imprimir"><button class="btn peq zap" data-zap="${p.aluno_id}">WhatsApp</button></td></tr>`).join('')}
        </tbody></table></div></details>`).join('') : '<div class="cartao vazio">Nenhuma pendência com esses filtros.</div>';
    if ($('#abrirTodas')) $('#abrirTodas').onclick = () => $$('details.turma-grupo').forEach((d) => { d.open = true; });
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
    <div class="acoes"><label class="btn">${icone('importar')}Importar planilha SIG<input type="file" id="arq" accept=".xlsx,.csv" hidden></label><button class="btn ama" id="novo">${icone('mais')}Novo contato</button></div></div>
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
      if (novo) await api('POST', '/api/interessados', b); else await salvarComVersao('/api/interessados/' + i.id, b, i);
      fechar(); toast('Salvo'); rotear();
    });
    if ($('#del', el)) $('#del', el).onclick = tentar(async () => {
      if (!(await confirmar('Excluir o contato de ' + i.aluno + '?', 'Excluir'))) return;
      await api('DELETE', '/api/interessados/' + i.id); fechar(); toast('Excluído'); rotear();
    });
  } });
}

// ───────────── Modelos de mensagem ─────────────
// Mensagens e Configurações estão em telas5.js (5.1).

// Espera todos os scripts (app.js e etapa2.js) carregarem antes de começar
document.addEventListener('DOMContentLoaded', iniciar);
