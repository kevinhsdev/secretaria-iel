// Secretaria IEL — Etapa 3: boletos, mutirão de fotos, autorização de saída, tarefas do dia, calendário e atendimentos
'use strict';

const PESSOAS = { todos: 'Toda a equipe', samara: 'Samara', duda: 'Duda', kevin: 'Kevin' };
const PERIODOS = { manha: 'manhã', tarde: 'tarde', dia: '' };
const DIAS_SEM = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex' };
const CANAIS_AT = { balcao: '🧍 Balcão', telefone: '☎️ Telefone', whatsapp: '💬 WhatsApp', email: '✉️ E-mail' };
const CANAIS_SAIDA = { whatsapp: 'WhatsApp', presencial: 'Presencial', bilhete: 'Bilhete na agenda', telefone: 'Telefone' };
const nomePessoa = (login) => PESSOAS[login] || titulo(login || '');
const pct = (n) => (n == null ? '—' : n + '%');

// Agrupa uma lista por turma, na ordem das séries
function porTurma(lista) {
  const g = new Map();
  for (const l of lista) {
    if (!g.has(l.turma_rotulo)) g.set(l.turma_rotulo, { turma: l.turma_rotulo, ordem: l.ordem ?? 99, itens: [] });
    g.get(l.turma_rotulo).itens.push(l);
  }
  return [...g.values()].sort((a, b) => a.ordem - b.ordem || a.turma.localeCompare(b.turma));
}

// ───────────── Meu dia ─────────────
TELAS.hoje = async (c, data) => {
  data = /^\d{4}-\d{2}-\d{2}$/.test(data || '') ? data : hojeIso();
  const ano = +data.slice(0, 4);
  const [r, h, cal] = await Promise.all([api('GET', '/api/rotina?data=' + data), api('GET', '/api/hoje?data=' + data), api('GET', '/api/calendario?ano=' + ano)]);
  const doMes = cal.itens.filter((i) => !i.feito && (i.do_mes || i.atrasado));
  const grupos = ['todos', ...r.pessoas.map((p) => p.login).filter((l) => l !== 'todos')];
  const tarefasDe = (login) => [
    ...r.fixas.filter((t) => t.responsavel === login).map((t) => ({ ...t, tipo: 'fixa' })),
    ...r.avulsas.filter((t) => (t.responsavel || 'todos') === login).map((t) => ({ ...t, tipo: 'avulsa' })),
  ];
  const cartaoTarefa = (t) => `<li class="${t.feito ? 'ok' : ''}">
    <input type="checkbox" data-t="${t.tipo}:${t.id}" ${t.feito ? 'checked' : ''} aria-label="${esc(t.titulo)}">
    <span class="nome"><span>${esc(t.titulo)}</span> ${t.periodo && PERIODOS[t.periodo] ? `<span class="opcional">${PERIODOS[t.periodo]}</span>` : ''}
      ${t.tipo === 'avulsa' ? '<span class="tag t-novo">do dia</span>' : ''}
      ${t.detalhe ? `<small>${esc(t.detalhe)}</small>` : ''}${t.feito && t.feito_por ? `<small>Feito por ${esc(nomePessoa(t.feito_por))}</small>` : ''}</span>
    ${t.tipo === 'avulsa' ? `<button class="btn peq perigo" data-del="${t.id}" title="Excluir">×</button>` : ''}</li>`;

  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Meu dia</h1>
      <p class="sub">${esc(r.dia_nome)}, ${dataBR(data)} · ${r.resumo.feitas} de ${r.resumo.total} tarefas concluídas</p></div>
    <div class="acoes"><input type="date" id="dia" value="${data}"><button class="btn" id="hojeBtn">Hoje</button><button class="btn ama" id="novaT">＋ Tarefa do dia</button></div></div>
  ${r.fim_de_semana ? '<div class="dica">Fim de semana: o cronograma da secretaria não roda hoje. Você ainda pode anotar tarefas avulsas.</div>' : ''}
  <div class="grade g4">
    <div class="cartao kpi destaque"><div class="rot">Minhas tarefas</div><div class="val">${h.tarefas.minhas_feitas}<small style="font-size:14px;color:var(--texto-2)"> / ${h.tarefas.minhas}</small></div><div class="det">do seu cronograma de hoje</div></div>
    <div class="cartao kpi ${h.saida.pendentes ? 'alerta' : ''}"><div class="rot">Avisos de saída</div><div class="val">${h.saida.total}</div><div class="det">${h.saida.pendentes} ainda não conferidos no portão</div></div>
    <div class="cartao kpi"><div class="rot">Atendimentos de hoje</div><div class="val">${h.atendimentos.hoje}</div><div class="det">${h.atendimentos.em_aberto} em aberto</div></div>
    <div class="cartao kpi"><div class="rot">Lembretes do mês</div><div class="val">${doMes.length}</div><div class="det">${cal.itens.filter((i) => i.atrasado).length} atrasados</div></div>
  </div>
  <div class="grade g2" style="margin-top:14px">
    <div class="cartao"><h2>✅ Tarefas de ${esc(r.dia_nome.toLowerCase())}</h2>
      ${grupos.map((g) => { const ts = tarefasDe(g); if (!ts.length) return ''; return `<h3 style="margin-top:14px">${esc(nomePessoa(g))} <span class="dado">(${ts.filter((t) => t.feito).length}/${ts.length})</span></h3>
        <ul class="checklist">${ts.map(cartaoTarefa).join('')}</ul>`; }).join('') || '<p class="vazio">Nenhuma tarefa para hoje.</p>'}
      ${EU.perfil === 'admin' ? '<div class="acoes" style="margin-top:12px"><button class="btn peq" id="cron">⚙️ Editar o cronograma da semana</button></div>' : ''}
    </div>
    <div>
      <div class="cartao"><div class="acoes" style="justify-content:space-between"><h2 style="margin:0">🚪 Quem busca hoje</h2><a class="btn peq" href="#/portao">Abrir o portão</a></div>
        ${h.saida.avisos.length ? `<table style="margin-top:8px"><tbody>${h.saida.avisos.map((v) => `<tr><td><b>${esc(titulo(v.aluno))}</b><br><small class="dado">${esc(v.turma_rotulo)} · ${esc(titulo(v.quem))}${v.parentesco ? ' (' + esc(v.parentesco) + ')' : ''}${v.horario ? ' · ' + esc(v.horario) : ''}</small></td>
          <td class="num-col">${v.conferido_em ? '<span class="tag t-concluida">liberado</span>' : '<span class="tag t-vencendo">aguardando</span>'}</td></tr>`).join('')}</tbody></table>`
          : '<p class="vazio">Nenhum aviso para hoje.</p>'}</div>
      <div class="cartao" style="margin-top:14px"><div class="acoes" style="justify-content:space-between"><h2 style="margin:0">📅 Lembretes deste mês</h2><a class="btn peq" href="#/calendario">Ver o ano</a></div>
        ${doMes.length ? `<ul class="checklist">${doMes.slice(0, 8).map((i) => `<li><input type="checkbox" data-cal="${i.id}" aria-label="${esc(i.titulo)}">
          <span class="nome"><span>${esc(i.titulo)}</span> ${i.atrasado ? '<span class="tag t-vencida">atrasado</span>' : ''}
            <small>${i.dia ? 'até ' + dataBR(i.limite) : 'durante ' + esc(i.mes_nome)} · ${esc(nomePessoa(i.responsavel))}</small></span></li>`).join('')}</ul>`
          : '<p class="vazio">Nada pendente neste mês 🎉</p>'}</div>
      <div class="cartao" style="margin-top:14px"><h2>Para não esquecer</h2>
        <p class="dado">Boletos ${h.boletos.ano} a conferir: <b>${h.boletos.pendentes}</b> · <a href="#/boletos">conferir descontos</a></p>
        <p class="dado">Alunos sem foto nos 3 sistemas: <b>${h.fotos.faltando}</b> · <a href="#/fotos">abrir o mutirão</a></p></div>
    </div>
  </div>`;

  $('#dia').onchange = (e) => (location.hash = '#/hoje/' + e.target.value);
  $('#hojeBtn').onclick = () => (location.hash = '#/hoje/' + hojeIso());
  $$('[data-t]', c).forEach((cb) => (cb.onchange = tentar(async () => {
    const [tipo, id] = cb.dataset.t.split(':');
    if (tipo === 'fixa') await api('PUT', '/api/rotina/feito/' + id, { data, feito: cb.checked });
    else await api('PUT', '/api/tarefas-dia/' + id, { feito: cb.checked });
    toast(cb.checked ? 'Feito!' : 'Desmarcado'); rotear();
  })));
  $$('[data-del]', c).forEach((b) => (b.onclick = tentar(async () => {
    if (!(await confirmar('Excluir esta tarefa do dia?', 'Excluir'))) return;
    await api('DELETE', '/api/tarefas-dia/' + b.dataset.del); toast('Excluída'); rotear();
  })));
  $$('[data-cal]', c).forEach((cb) => (cb.onchange = tentar(async () => {
    await api('PUT', `/api/calendario/${cb.dataset.cal}/feito`, { feito: cb.checked, ano });
    toast('Lembrete concluído'); rotear();
  })));
  $('#novaT').onclick = () => formTarefaDia(data, r.pessoas);
  if ($('#cron')) $('#cron').onclick = tentar(janelaCronograma);
};

function formTarefaDia(data, pessoas) {
  modal('Nova tarefa do dia', `<form id="ft">
    <div class="campo"><label>O que precisa ser feito? *</label><input id="t_tit" required autofocus></div>
    <div class="campos" style="margin-top:10px">
      <div class="campo"><label>De quem é</label><select id="t_resp">${pessoas.map((p) => `<option value="${esc(p.login)}" ${p.login === EU.login ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>
      <div class="campo"><label>Dia</label><input type="date" id="t_data" value="${data}"></div></div>
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Anotar</button></div></form>`,
  { onAbrir: (el, fechar) => {
    $('#ft', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      await api('POST', '/api/tarefas-dia', { titulo: $('#t_tit', el).value, responsavel: $('#t_resp', el).value, data: $('#t_data', el).value });
      fechar(); toast('Tarefa anotada'); rotear();
    });
  } });
}

async function janelaCronograma() {
  const [tarefas, dia] = await Promise.all([api('GET', '/api/rotina/tarefas'), api('GET', '/api/rotina')]);
  // Quem pode receber tarefa: "toda a equipe" + os usuários cadastrados hoje
  const quem = { todos: PESSOAS.todos, ...Object.fromEntries(dia.pessoas.map((p) => [p.login, p.nome])) };
  const dias = (t) => Object.entries(DIAS_SEM).map(([n, r]) => `<label style="margin-right:6px"><input type="checkbox" data-dia="${n}" ${String(t.dias || '').split(',').includes(n) ? 'checked' : ''}> ${r}</label>`).join('');
  modal('Cronograma da semana', `<p class="dado">Quem faz o quê em cada dia. Some ou tire tarefas conforme a rotina mudar.</p>
    <div class="tabela-wrap" style="max-height:60vh;overflow:auto"><table><thead><tr><th>Tarefa</th><th>Quem</th><th>Dias</th><th>Período</th><th>Ativa</th></tr></thead><tbody>
    ${tarefas.map((t) => `<tr data-c="${t.id}"><td><input data-k="titulo" value="${esc(t.titulo)}" style="width:100%"></td>
      <td><select data-k="responsavel">${Object.entries(quem).map(([k, v]) => `<option value="${esc(k)}" ${t.responsavel === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></td>
      <td style="white-space:nowrap">${dias(t)}</td>
      <td><select data-k="periodo">${Object.entries({ dia: 'dia todo', manha: 'manhã', tarde: 'tarde' }).map(([k, v]) => `<option value="${k}" ${t.periodo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td><input type="checkbox" data-k="ativo" ${t.ativo ? 'checked' : ''}></td></tr>`).join('')}
    </tbody></table></div>
    <form id="nt" class="acoes" style="margin-top:10px"><input id="ntt" placeholder="Nova tarefa do cronograma" required style="flex:1"><button class="btn">Adicionar</button></form>`,
  { onAbrir: (el, fechar) => {
    const salvar = tentar(async (tr, corpo) => { await api('PUT', '/api/rotina/tarefas/' + tr.dataset.c, corpo); toast('Salvo'); });
    $$('[data-c] [data-k]', el).forEach((i) => (i.onchange = () => salvar(i.closest('tr'), { [i.dataset.k]: i.type === 'checkbox' ? i.checked : i.value })));
    $$('[data-c] [data-dia]', el).forEach((i) => (i.onchange = () => {
      const tr = i.closest('tr');
      const ds = $$('[data-dia]', tr).filter((x) => x.checked).map((x) => x.dataset.dia).join(',');
      salvar(tr, { dias: ds });
    }));
    $('#nt', el).onsubmit = tentar(async (e) => {
      e.preventDefault();
      await api('POST', '/api/rotina/tarefas', { titulo: $('#ntt', el).value });
      fechar(); janelaCronograma();
    });
  } });
}

// ───────────── Boletos ─────────────
TELAS.boletos = async (c, aba = 'conferencia') => {
  const ABAS = { conferencia: 'Conferência de descontos', entrega: 'Entrega dos boletos' };
  c.innerHTML = `<h1>Boletos</h1><p class="sub">Conferir os descontos antes da massa de boletos e registrar a entrega dos boletos físicos.</p>
    <div class="abas">${Object.entries(ABAS).map(([k, v]) => `<button data-aba="${k}" class="${aba === k ? 'on' : ''}">${v}</button>`).join('')}</div><div id="aba"><p class="sub">Carregando…</p></div>`;
  $$('[data-aba]').forEach((b) => (b.onclick = () => (location.hash = '#/boletos/' + b.dataset.aba)));
  if (aba === 'conferencia') await abaConferencia($('#aba'));
  else await abaEntrega($('#aba'));
};

async function abaConferencia(el) {
  const d = await api('GET', '/api/boletos/conferencia');
  const r = d.resumo;
  const turmas = [...new Set(d.linhas.map((l) => l.turma_rotulo))].sort();
  el.innerHTML = `<div class="dica">Cruzamento automático de <b>filhos de funcionários</b> (isentos ${d.desconto_funcionario}%), <b>bolsas CEBAS</b> concedidas ou ofertadas e <b>atividades extras</b>.
    Os descontos <b>não somam</b>: vale o maior. Confira aluno por aluno e marque, para depois lançar a massa de boletos no ACADESC (vencimento dia ${esc(d.dia_venc)}).</div>
  <div class="grade g4">
    <div class="cartao kpi destaque"><div class="rot">Alunos com boleto em ${d.ano}</div><div class="val">${r.total}</div><div class="det">${r.conferidos} conferidos · ${r.lancados} já lançados</div></div>
    <div class="cartao kpi"><div class="rot">Com desconto</div><div class="val">${r.com_desconto}</div><div class="det">${r.isentos} filhos de funcionário · ${r.bolsistas} bolsistas</div></div>
    <div class="cartao kpi"><div class="rot">Atividades extras</div><div class="val">${r.com_extras}</div><div class="det">${r.a_confirmar_extras} a confirmar do ano anterior</div></div>
    <div class="cartao kpi ${r.divergencias ? 'alerta' : ''}"><div class="rot">Pontos de atenção</div><div class="val">${r.com_alerta}</div><div class="det">${r.divergencias} divergem do ACADESC</div></div>
  </div>
  <div class="cartao" style="margin-top:14px">
    <div class="filtros">
      <select id="fv"><option value="">Todos os alunos</option><option value="desconto">Só com desconto</option><option value="extras">Só com atividade extra</option>
        <option value="alerta">Só com ponto de atenção</option><option value="pendente">Ainda não conferidos</option><option value="conferido">Já conferidos</option></select>
      <select id="ft"><option value="">Todas as turmas</option>${turmas.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
      <input id="fq" placeholder="Buscar aluno, matrícula ou responsável…" style="flex:1;min-width:200px">
      <button class="btn peq" id="marcar">✔️ Marcar filtrados como conferidos</button>
      <button class="btn peq" id="imp">🖨️ Lista de conferência</button>
    </div>
    <div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Turma → ${d.ano}</th><th>Desconto esperado</th><th>Atividades extras</th><th>% no ACADESC</th><th>Conferido</th><th>Lançado</th><th>Observação</th></tr></thead>
      <tbody id="tb"></tbody></table></div>
  </div>`;
  let filtrados = [];
  const desenhar = () => {
    const fv = $('#fv').value, ft = $('#ft').value, q = norm($('#fq').value);
    filtrados = d.linhas.filter((l) => (!ft || l.turma_rotulo === ft) && (!q || norm([l.nome, l.mat, l.responsavel].join(' ')).includes(q))
      && (fv === '' || (fv === 'desconto' && l.desconto_esperado > 0) || (fv === 'extras' && (l.extras.length || l.extras_anterior.length))
        || (fv === 'alerta' && l.alertas.length) || (fv === 'pendente' && !l.conferido) || (fv === 'conferido' && l.conferido)));
    $('#tb').innerHTML = filtrados.length ? filtrados.map((l) => `<tr data-a="${l.aluno_id}" class="${l.divergencia ? 'linha-alerta' : ''}">
      <td><a href="#/aluno/${l.aluno_id}"><b>${esc(titulo(l.nome))}</b></a>${l.filho_funcionario ? ' <span class="tag t-func">func.</span>' : ''}
        <br><small class="dado">Mat. ${esc(l.mat || '—')} · ${esc(titulo(l.responsavel))}</small></td>
      <td>${esc(l.turma_rotulo)}<br><small class="dado">→ ${esc(l.destino)}</small></td>
      <td><b>${pct(l.desconto_esperado)}</b><br><small class="dado">${esc(l.origem)}</small></td>
      <td>${l.extras.length ? l.extras.map((x) => `${esc(x.atividade)} <span class="dado">${x.valor_parcela == null ? '(sem valor)' : moedaBR(x.valor_parcela)}${x.desconto_folha ? ' · folha' : ''}</span>`).join('<br>')
        : l.extras_anterior.length ? `<span class="dado">em ${d.ano - 1}: ${esc(l.extras_anterior.join(', '))}</span>` : '<span class="dado">—</span>'}
        ${l.alertas.length ? `<br><small style="color:var(--laranja)">⚠️ ${esc(l.alertas.join(' '))}</small>` : ''}</td>
      <td><input type="number" data-k="desconto_acadesc" value="${l.desconto_acadesc ?? ''}" min="0" max="100" style="width:70px" placeholder="%"></td>
      <td style="text-align:center"><input type="checkbox" data-k="conferido" ${l.conferido ? 'checked' : ''}></td>
      <td style="text-align:center"><input type="checkbox" data-k="lancado" ${l.lancado ? 'checked' : ''}></td>
      <td><input data-k="obs" value="${esc(l.obs)}" placeholder="—" style="width:150px">${l.atualizado_por ? `<br><small class="dado">${esc(nomePessoa(l.atualizado_por))}</small>` : ''}</td></tr>`).join('')
      : '<tr><td colspan="8" class="vazio">Nenhum aluno com esses filtros.</td></tr>';
    $$('#tb [data-k]').forEach((i) => (i.onchange = tentar(async () => {
      const id = i.closest('tr').dataset.a;
      const v = i.type === 'checkbox' ? i.checked : i.value;
      await api('PUT', '/api/boletos/conferencia/' + id, { [i.dataset.k]: v, ano: d.ano });
      const l = d.linhas.find((x) => x.aluno_id === +id);
      l[i.dataset.k] = i.type === 'checkbox' ? v : v === '' ? null : Number(v);
      toast('Salvo');
      if (i.dataset.k === 'desconto_acadesc') rotear();
    })));
  };
  ['fv', 'ft', 'fq'].forEach((id) => ($('#' + id).oninput = desenhar));
  $('#marcar').onclick = tentar(async () => {
    const alvo = filtrados.filter((l) => !l.conferido);
    if (!alvo.length) return toast('Todos os alunos filtrados já estão conferidos');
    if (!(await confirmar(`Marcar ${alvo.length} aluno(s) como conferidos?`, 'Marcar'))) return;
    await api('POST', '/api/boletos/conferencia/lote', { alunos: alvo.map((l) => l.aluno_id), conferido: true, ano: d.ano });
    toast(`${alvo.length} marcados`); rotear();
  });
  $('#imp').onclick = () => abrirDoc({ tipo: 'conferencia_boletos', ano: d.ano, turma: $('#ft').value, filtro: $('#fv').value });
  desenhar();
}

async function abaEntrega(el) {
  const remessas = await api('GET', '/api/remessas');
  el.innerHTML = `<div class="acoes" style="justify-content:space-between;margin-bottom:12px">
      <p class="dado" style="margin:0">Cada remessa é um lote de boletos impressos. Marque quem recebeu e imprima o protocolo de entrega por turma.</p>
      <button class="btn ama" id="nova">＋ Nova remessa</button></div>
    <div class="grade g4">${remessas.map((r) => `<div class="cartao kpi clic" data-r="${r.id}" style="cursor:pointer" tabindex="0">
      <div class="rot">${esc(r.nome)}</div><div class="val" style="font-size:24px">${r.entregues}<small style="font-size:13px;color:var(--texto-2)"> / ${r.total}</small></div>
      <div class="det">${esc(r.referencia || '')}${r.criado_por ? ' · criada por ' + esc(nomePessoa(r.criado_por)) : ''}</div>
      <div class="barra"><i class="b-concl" style="width:${r.total ? Math.min(100, (100 * r.entregues) / r.total).toFixed(1) : 0}%"></i></div></div>`).join('')
      || '<p class="vazio">Nenhuma remessa ainda. Crie a primeira quando imprimir a massa de boletos.</p>'}</div>
    <div id="remDet"></div>`;
  $('#nova').onclick = () => modal('Nova remessa de boletos', `<form id="fr">
    <div class="campo"><label>Nome *</label><input id="r_nome" value="Boletos ${EU.config.ano_matricula} — massa anual" required></div>
    <div class="campos" style="margin-top:10px"><div class="campo"><label>Ano</label><input type="number" id="r_ano" value="${esc(EU.config.ano_matricula)}"></div>
      <div class="campo"><label>Referência</label><input id="r_ref" placeholder="Mensalidades de ${esc(EU.config.ano_matricula)}"></div></div>
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Criar</button></div></form>`,
  { onAbrir: (m, fechar) => { $('#fr', m).onsubmit = tentar(async (ev) => {
    ev.preventDefault();
    await api('POST', '/api/remessas', { nome: $('#r_nome', m).value, ano: $('#r_ano', m).value, referencia: $('#r_ref', m).value });
    fechar(); toast('Remessa criada'); rotear();
  }); } });
  $$('[data-r]').forEach((k) => (k.onclick = k.onkeydown = tentar((e) => { if (e.type === 'keydown' && e.key !== 'Enter') return; return detalheRemessa(+k.dataset.r); })));
  if (remessas[0]) await detalheRemessa(remessas[0].id);
}

async function detalheRemessa(id) {
  const d = await api('GET', '/api/remessas/' + id);
  const box = $('#remDet');
  if (!box) return;
  const turmas = porTurma(d.alunos);
  box.innerHTML = `<div class="cartao" style="margin-top:14px">
    <div class="filtros"><h2 style="margin:0;flex:1">${esc(d.remessa.nome)} <span class="dado">${d.entregues} de ${d.alunos.length} entregues</span></h2>
      <select id="rt"><option value="">Todas as turmas</option>${turmas.map((t) => `<option>${esc(t.turma)}</option>`).join('')}</select>
      <select id="rs"><option value="">Todos</option><option value="pendente">Só pendentes</option><option value="entregue">Só entregues</option></select>
      <input id="rq" placeholder="Buscar aluno…"><button class="btn peq" id="rimp">🖨️ Protocolo de entrega</button>
      ${EU.perfil === 'admin' ? '<button class="btn peq perigo" id="rdel">Excluir remessa</button>' : ''}</div>
    <div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Turma</th><th>Entregue</th><th>Quem recebeu</th><th>Como</th><th>Observação</th></tr></thead><tbody id="rtb"></tbody></table></div>
  </div>`;
  const desenhar = () => {
    const t = $('#rt').value, s = $('#rs').value, q = norm($('#rq').value);
    const f = d.alunos.filter((a) => (!t || a.turma_rotulo === t) && (!q || norm(a.nome + ' ' + a.responsavel).includes(q))
      && (!s || (s === 'entregue' ? a.entregue_em : !a.entregue_em)));
    $('#rtb').innerHTML = f.length ? f.map((a) => `<tr data-a="${a.aluno_id}"><td><a href="#/aluno/${a.aluno_id}"><b>${esc(titulo(a.nome))}</b></a><br><small class="dado">Resp.: ${esc(titulo(a.responsavel))}</small></td>
      <td>${esc(a.turma_rotulo)}</td>
      <td><label><input type="checkbox" data-k="entregue" ${a.entregue_em ? 'checked' : ''}> ${a.entregue_em ? dataBR(a.entregue_em) : ''}</label></td>
      <td><input data-k="recebido_por" value="${esc(a.recebido_por)}" placeholder="quem retirou" style="width:150px"></td>
      <td><select data-k="canal"><option value=""></option>${Object.entries({ balcao: 'Balcão', aluno: 'Pela agenda do aluno', portao: 'No portão', correio: 'Correio/e-mail' }).map(([k, v]) => `<option value="${k}" ${a.canal === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td><input data-k="obs" value="${esc(a.obs)}" style="width:140px"></td></tr>`).join('')
      : '<tr><td colspan="6" class="vazio">Ninguém com esses filtros.</td></tr>';
    $$('#rtb [data-k]').forEach((i) => (i.onchange = tentar(async () => {
      const aid = +i.closest('tr').dataset.a;
      const a = d.alunos.find((x) => x.aluno_id === aid);
      const corpo = { entregue: a.entregue_em ? true : false, recebido_por: a.recebido_por, canal: a.canal, obs: a.obs };
      corpo[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value;
      const r = await api('PUT', `/api/remessas/${id}/entregas/${aid}`, corpo);
      Object.assign(a, { entregue_em: r.entregue_em, recebido_por: corpo.recebido_por, canal: corpo.canal, obs: corpo.obs });
      toast('Salvo');
      if (i.dataset.k === 'entregue') detalheRemessa(id);
    })));
  };
  ['rt', 'rs', 'rq'].forEach((x) => ($('#' + x).oninput = desenhar));
  $('#rimp').onclick = () => abrirDoc({ tipo: 'protocolo_boletos', remessa: id, turma: $('#rt').value });
  if ($('#rdel')) $('#rdel').onclick = tentar(async () => {
    if (!(await confirmar(`Excluir a remessa "${d.remessa.nome}" e o registro de entregas dela?`, 'Excluir'))) return;
    await api('DELETE', '/api/remessas/' + id); toast('Remessa excluída'); rotear();
  });
  desenhar();
}

// ───────────── Mutirão de fotos ─────────────
TELAS.fotos = async (c) => {
  const d = await api('GET', '/api/fotos/mutirao');
  const [S1, S2, S3] = d.sistemas;
  const r = d.resumo;
  const turmas = porTurma(d.linhas);
  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Mutirão de fotos</h1>
      <p class="sub">Quem ainda não tem foto e em quais dos 3 sistemas ela já foi inserida.</p></div>
    <button class="btn" id="imp">🖨️ Lista para o mutirão</button></div>
  <div class="grade g4">
    <div class="cartao kpi destaque"><div class="rot">Alunos</div><div class="val">${r.total}</div><div class="det">${r.com_arquivo} com foto encontrada na pasta</div></div>
    <div class="cartao kpi ${r.sem_foto ? 'alerta' : ''}"><div class="rot">Ainda sem foto</div><div class="val">${r.sem_foto}</div><div class="det">precisam ser fotografados</div></div>
    <div class="cartao kpi"><div class="rot">Nos 3 sistemas</div><div class="val">${r.completos}</div><div class="det">${r.faltando} com foto mas faltando em algum sistema</div></div>
    <div class="cartao kpi"><div class="rot">Por sistema</div><div class="val" style="font-size:16px">${Object.entries(r.por_sistema).map(([k, v]) => `${esc(k)}: <b>${v}</b>`).join('<br>')}</div></div>
  </div>
  ${r.com_arquivo ? '' : `<div class="dica" style="margin-top:12px">O app não encontrou nenhum arquivo de foto ${d.pastas ? 'nas pastas configuradas' : '(as pastas ainda não foram configuradas)'} —
    é o normal fora do computador da escola. A conferência continua valendo pelas marcações abaixo.</div>`}
  <div class="cartao" style="margin-top:14px">
    <div class="filtros">
      <select id="fs"><option value="">Todos</option><option value="sem">Sem foto</option><option value="incompleto">Falta em algum sistema</option><option value="completo">Completos</option></select>
      <select id="ft"><option value="">Todas as turmas</option>${turmas.map((t) => `<option>${esc(t.turma)}</option>`).join('')}</select>
      <input id="fq" placeholder="Buscar aluno…" style="flex:1;min-width:180px">
      <button class="btn peq" id="lote">✔️ Marcar filtrados…</button>
    </div>
    <div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Turma</th><th>Foto tirada</th><th>${esc(S1)}</th><th>${esc(S2)}</th><th>${esc(S3)}</th><th>Observação</th></tr></thead><tbody id="tb"></tbody></table></div>
  </div>`;
  let filtrados = [];
  const desenhar = () => {
    const fs = $('#fs').value, ft = $('#ft').value, q = norm($('#fq').value);
    filtrados = d.linhas.filter((l) => (!ft || l.turma_rotulo === ft) && (!q || norm(l.nome + ' ' + (l.mat || '')).includes(q))
      && (!fs || (fs === 'sem' && !l.tirada) || (fs === 'completo' && l.completo) || (fs === 'incompleto' && l.tirada && !l.completo)));
    const col = (l, k) => `<td style="text-align:center"><input type="checkbox" data-k="${k}" ${l[k] ? 'checked' : ''}></td>`;
    $('#tb').innerHTML = filtrados.length ? filtrados.map((l) => `<tr data-a="${l.aluno_id}">
      <td><a href="#/aluno/${l.aluno_id}"><b>${esc(titulo(l.nome))}</b></a> ${l.tem_arquivo ? '<span class="pdf-ok" title="Arquivo de foto encontrado">📷 arquivo</span>' : ''}
        <br><small class="dado">Mat. ${esc(l.mat || '—')}${l.data_foto ? ' · foto de ' + dataBR(l.data_foto) : ''}</small></td>
      <td>${esc(l.turma_rotulo)}</td>${col(l, 'tirada')}${col(l, 'acadesc')}${col(l, 'sed')}${col(l, 'lanche')}
      <td><input data-k="obs" value="${esc(l.obs)}" placeholder="—" style="width:150px"></td></tr>`).join('')
      : '<tr><td colspan="7" class="vazio">Ninguém com esses filtros 🎉</td></tr>';
    $$('#tb [data-k]').forEach((i) => (i.onchange = tentar(async () => {
      const id = +i.closest('tr').dataset.a;
      await api('PUT', '/api/fotos/mutirao/' + id, { [i.dataset.k]: i.type === 'checkbox' ? i.checked : i.value });
      toast('Salvo'); rotear();
    })));
  };
  ['fs', 'ft', 'fq'].forEach((id) => ($('#' + id).oninput = desenhar));
  $('#lote').onclick = () => {
    if (!filtrados.length) return toast('Nenhum aluno filtrado', true);
    modal(`Marcar ${filtrados.length} aluno(s)`, `<p>Vale para todos os alunos que estão na lista filtrada agora.</p>
      <label class="chk" style="display:block;margin:6px 0"><input type="checkbox" id="m_tirada"> Foto tirada</label>
      <label class="chk" style="display:block;margin:6px 0"><input type="checkbox" id="m_acadesc"> Inserida no ${esc(S1)}</label>
      <label class="chk" style="display:block;margin:6px 0"><input type="checkbox" id="m_sed"> Inserida no ${esc(S2)}</label>
      <label class="chk" style="display:block;margin:6px 0"><input type="checkbox" id="m_lanche"> Inserida no ${esc(S3)}</label>
      <p class="dica">Só o que você marcar aqui será alterado.</p>
      <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri" id="ok">Marcar</button></div>`,
    { onAbrir: (el, fechar) => {
      $('#ok', el).onclick = tentar(async () => {
        const corpo = { alunos: filtrados.map((l) => l.aluno_id) };
        ['tirada', 'acadesc', 'sed', 'lanche'].forEach((k) => { if ($('#m_' + k, el).checked) corpo[k] = true; });
        if (Object.keys(corpo).length === 1) return toast('Escolha ao menos uma marcação', true);
        await api('POST', '/api/fotos/mutirao/lote', corpo);
        fechar(); toast('Marcados'); rotear();
      });
    } });
  };
  $('#imp').onclick = () => abrirDoc({ tipo: 'mutirao_fotos', turma: $('#ft').value, filtro: $('#fs').value });
  desenhar();
};

// ───────────── Portão · Saída ─────────────
TELAS.portao = async (c) => {
  const d = await api('GET', '/api/saida/avisos');
  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Portão · Saída</h1>
      <p class="sub">Consulta rápida de quem pode buscar cada aluno e os avisos de hoje, ${dataBR(d.data)}.</p></div>
    <div class="acoes"><button class="btn ama" id="novoAviso">＋ Aviso de hoje</button><button class="btn" id="impSaida">🖨️ Lista por turma</button></div></div>
  <div class="cartao" style="border-top:3px solid var(--amarelo)">
    <h2>🔎 Quem vai buscar?</h2>
    <input id="qPortao" placeholder="Nome do aluno, da mãe, do responsável ou matrícula…" autocomplete="off" style="width:100%;padding:11px 14px;font-size:16px">
    <div id="resPortao"><p class="dado">Digite o nome do aluno para ver quem está autorizado a buscar.</p></div>
  </div>
  <div class="cartao" style="margin-top:14px"><h2>📌 Avisos de hoje (${d.avisos.length})</h2>
    ${d.avisos.length ? `<div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Turma</th><th>Quem busca hoje</th><th>Como avisaram</th><th>Situação</th><th></th></tr></thead><tbody>
      ${d.avisos.map((v) => `<tr data-v="${v.id}" class="${v.conferido_em ? '' : 'linha-alerta'}"><td><a href="#/aluno/${v.aluno_id}"><b>${esc(titulo(v.aluno))}</b></a></td><td>${esc(v.turma_rotulo)}</td>
        <td><b>${esc(titulo(v.quem))}</b>${v.parentesco ? ` <span class="dado">(${esc(v.parentesco)})</span>` : ''}<br><small class="dado">${esc(v.documento || 'sem documento anotado')}${v.horario ? ' · ' + esc(v.horario) : ''}</small></td>
        <td>${esc(CANAIS_SAIDA[v.canal] || v.canal || '—')}<br><small class="dado">${esc(v.quem_avisou || '')}</small></td>
        <td>${v.conferido_em ? `<span class="tag t-concluida">liberado</span><br><small class="dado">${esc(nomePessoa(v.conferido_por))}</small>` : '<span class="tag t-vencendo">aguardando</span>'}</td>
        <td class="acoes">${v.conferido_em ? `<button class="btn peq" data-reabrir="${v.id}">Desfazer</button>` : `<button class="btn peq pri" data-liberar="${v.id}">Liberar saída</button>`}
          <button class="btn peq perigo" data-delv="${v.id}">Excluir</button></td></tr>`).join('')}
      </tbody></table></div>` : vazio('portao', 'Nenhum aviso para hoje',
        'Quando a família avisar que hoje quem busca é outra pessoa, registre aqui: na saída, o portão confere em segundos.',
        '<div class="acoes" style="justify-content:center"><button class="btn pri" id="vazioAviso">Registrar aviso de hoje</button></div>')}
    <p class="dica">Autorização <b>só por telefone não vale</b> (regra do termo de saída): peça por WhatsApp, bilhete na agenda ou presencialmente.</p>
  </div>`;
  let espera;
  $('#qPortao').oninput = () => {
    clearTimeout(espera);
    const q = $('#qPortao').value.trim();
    if (q.length < 2) { $('#resPortao').innerHTML = '<p class="dado">Digite o nome do aluno para ver quem está autorizado a buscar.</p>'; return; }
    espera = setTimeout(tentar(async () => {
      const r = await api('GET', '/api/saida/portao?q=' + encodeURIComponent(q));
      const cx = $('#resPortao');
      cx.innerHTML = r.achados.length ? r.achados.map(cartaoPortao).join('<hr style="border:none;border-top:1px solid var(--borda);margin:16px 0">')
        : '<p class="vazio">Nenhum aluno com esse nome.</p>';
      $$('[data-aviso]', cx).forEach((b) => (b.onclick = () => {
        const f = r.achados.find((x) => x.aluno.id === +b.dataset.aviso);
        formAviso({ id: f.aluno.id, nome: f.aluno.nome });
      }));
    }), 300);
  };
  $('#novoAviso').onclick = () => formAviso();
  if ($('#vazioAviso')) $('#vazioAviso').onclick = () => formAviso();
  $('#impSaida').onclick = () => abrirDoc({ tipo: 'saida_turma' });
  $$('[data-liberar]').forEach((b) => (b.onclick = tentar(async () => { await api('PUT', '/api/saida/avisos/' + b.dataset.liberar, { conferido: true }); toast('Saída liberada e registrada'); rotear(); })));
  $$('[data-reabrir]').forEach((b) => (b.onclick = tentar(async () => { await api('PUT', '/api/saida/avisos/' + b.dataset.reabrir, { conferido: false }); rotear(); })));
  $$('[data-delv]').forEach((b) => (b.onclick = tentar(async () => {
    if (!(await confirmar('Excluir este aviso?', 'Excluir'))) return;
    await api('DELETE', '/api/saida/avisos/' + b.dataset.delv); toast('Aviso excluído'); rotear();
  })));
};

function cartaoPortao(f) {
  const a = f.aluno;
  const aviso = f.avisos.length ? `<div class="faixa-demo" style="background:var(--amarelo-claro);border-color:var(--amarelo)">📌 <b>Aviso de hoje:</b> quem busca é
    ${f.avisos.map((v) => `<b>${esc(titulo(v.quem))}</b>${v.parentesco ? ` (${esc(v.parentesco)})` : ''}${v.documento ? ` · ${esc(v.documento)}` : ''}${v.conferido_em ? ' <span class="tag t-concluida">já liberado</span>' : ''}`).join(' · ')}</div>` : '';
  return `${aviso}
  <div class="ficha-topo" style="margin:10px 0 0"><div class="info"><h2 style="margin:0">${esc(titulo(a.nome))}</h2>
    <p class="dado" style="margin:2px 0 0">${esc(a.turma_rotulo)}${a.turno ? ` · ${a.turno === 'M' ? 'manhã' : 'tarde'}` : ''} · Mat. ${esc(a.mat || '—')}</p></div>
    <div class="acoes"><span class="tag ${f.sai_sozinho ? 't-concluida' : 't-pendente'}">${f.sai_sozinho ? '✔️ pode sair sozinho' : 'não sai sozinho'}</span>
      <button class="btn peq" data-aviso="${a.id}">＋ Aviso de hoje</button><a class="btn peq" href="#/aluno/${a.id}">Abrir ficha</a></div></div>
  ${f.transporte ? `<p class="dado" style="margin-top:8px">🚐 Transporte: <b style="display:inline">${esc(f.transporte)}</b></p>` : ''}
  <h3 style="margin-top:14px">Pode buscar</h3>
  ${f.autorizados.length ? `<table><tbody>${f.autorizados.map((x) => `<tr><td><b>${esc(titulo(x.nome))}</b><br><small class="dado">${esc(x.parentesco || '')}${x.documento ? ' · ' + esc(x.documento) : ''}${x.telefone ? ' · ' + esc(x.telefone) : ''}</small></td></tr>`).join('')}</tbody></table>`
    : `<p class="vazio">Ninguém cadastrado. ${f.sai_sozinho ? 'O aluno tem autorização para sair sozinho.' : 'Só o responsável legal pode buscar.'}</p>`}
  <p class="dado" style="margin-top:10px">Responsáveis: ${esc(titulo(a.nome_resp || a.nome_mae || a.nome_pai || '—'))}${f.termo_em ? ` · termo assinado em ${dataBR(f.termo_em)}` : ''}</p>
  ${f.obs ? `<p class="dica">${esc(f.obs)}</p>` : ''}`;
}


function formAviso(alunoFixo) {
  let aluno = alunoFixo;
  modal('Hoje quem busca é outra pessoa', `<form id="fv">
    ${alunoFixo ? `<p><b>${esc(titulo(alunoFixo.nome))}</b></p>` : '<div class="campo"><label>Aluno *</label><div id="selAv"></div></div>'}
    <div class="campos" style="margin-top:10px">
      <div class="campo"><label>Quem vai buscar *</label><input id="v_quem" required></div>
      <div class="campo"><label>Parentesco</label><input id="v_par" placeholder="Avó, tia, vizinha…"></div>
      <div class="campo"><label>Documento (RG)</label><input id="v_doc" placeholder="confira no portão"></div>
      <div class="campo"><label>Data</label><input type="date" id="v_data" value="${hojeIso()}"></div>
      <div class="campo"><label>Horário previsto</label><input type="time" id="v_hora"></div>
      <div class="campo"><label>Como a família avisou</label><select id="v_canal">${Object.entries(CANAIS_SAIDA).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="campo"><label>Quem avisou</label><input id="v_avisou" placeholder="mãe, pai, responsável…"></div>
    </div>
    <div class="campo" style="margin-top:10px"><label>Observação</label><input id="v_obs"></div>
    <p class="dica">Aviso por telefone não é aceito pelo termo de saída da escola. Se for o único jeito, o app pede confirmação e registra quem autorizou.</p>
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Registrar aviso</button></div></form>`,
  { onAbrir: (el, fechar) => {
    if (!alunoFixo) seletorAluno($('#selAv', el), (x) => { aluno = x; });
    $('#fv', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      if (!aluno) return toast('Escolha o aluno', true);
      const corpo = { aluno_id: aluno.id, quem: $('#v_quem', el).value, parentesco: $('#v_par', el).value, documento: $('#v_doc', el).value,
        data: $('#v_data', el).value, horario: $('#v_hora', el).value, canal: $('#v_canal', el).value, quem_avisou: $('#v_avisou', el).value, obs: $('#v_obs', el).value };
      try { await api('POST', '/api/saida/avisos', corpo); }
      catch (e) {
        if (!/telefone/.test(e.message) || !(await confirmar(e.message, 'Registrar mesmo assim'))) throw e;
        await api('POST', '/api/saida/avisos', { ...corpo, confirmar_telefone: true });
      }
      fechar(); toast('Aviso registrado'); rotear();
    });
  } });
}

// ───────────── Atendimentos ─────────────
TELAS.atendimentos = async (c) => {
  const d = await api('GET', '/api/atendimentos');
  const hoje = hojeIso();
  const doDia = d.atendimentos.filter((a) => a.data === hoje);
  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Atendimentos</h1>
      <p class="sub">Registro de quem atendeu, quem procurou, o assunto e se ficou resolvido.</p></div>
    <button class="btn ama" id="novo">＋ Registrar atendimento</button></div>
  <div class="grade g4">
    <div class="cartao kpi destaque"><div class="rot">Hoje</div><div class="val">${doDia.length}</div><div class="det">${doDia.filter((a) => !a.resolvido).length} em aberto</div></div>
    ${Object.entries(d.canais).slice(0, 3).map(([k, v]) => `<div class="cartao kpi"><div class="rot">${esc(v)}</div><div class="val">${d.atendimentos.filter((a) => a.canal === k).length}</div><div class="det">últimos registros</div></div>`).join('')}
  </div>
  <div class="cartao" style="margin-top:14px">
    <div class="filtros">
      <select id="fc"><option value="">Todos os canais</option>${Object.entries(d.canais).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <label><input type="checkbox" id="fp"> Só os que ficaram em aberto</label>
      <input type="date" id="fd" value="" title="A partir de"><input id="fq" placeholder="Buscar aluno, pessoa ou assunto…" style="flex:1;min-width:200px">
      <button class="btn peq" id="imp">🖨️ Imprimir</button>
    </div>
    <div class="tabela-wrap"><table><thead><tr><th>Quando</th><th>Canal</th><th>Aluno / pessoa</th><th>Assunto</th><th>Situação</th><th>Atendeu</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>
  </div>`;
  const desenhar = () => {
    const fc = $('#fc').value, fp = $('#fp').checked, fd = $('#fd').value, q = norm($('#fq').value);
    const f = d.atendimentos.filter((a) => (!fc || a.canal === fc) && (!fp || !a.resolvido) && (!fd || a.data >= fd)
      && (!q || norm([a.aluno, a.pessoa, a.assunto, a.categoria, a.detalhe].join(' ')).includes(q)));
    $('#tb').innerHTML = f.length ? f.map((a) => `<tr data-i="${a.id}"><td class="dado">${dataBR(a.data)}<br>${esc(a.hora || '')}</td>
      <td>${esc(d.canais[a.canal] || a.canal)}</td>
      <td>${a.aluno_id ? `<a href="#/aluno/${a.aluno_id}"><b>${esc(titulo(a.aluno))}</b></a><br><small class="dado">${esc(a.turma_rotulo)} · ${esc(titulo(a.pessoa || ''))}</small>`
        : `<b>${esc(titulo(a.pessoa || '—'))}</b><br><small class="dado">${esc(a.telefone || '')}</small>`}</td>
      <td>${esc(a.assunto)}${a.categoria ? `<br><small class="dado">${esc(a.categoria)}</small>` : ''}</td>
      <td>${a.resolvido ? '<span class="tag t-concluida">resolvido</span>' : `<span class="tag t-vencendo">em aberto</span>${a.encaminhado ? `<br><small class="dado">com ${esc(a.encaminhado)}</small>` : ''}`}</td>
      <td class="dado">${esc(nomePessoa(a.usuario))}</td>
      <td class="acoes">${a.resolvido ? '' : `<button class="btn peq" data-ok="${a.id}">Resolvido</button>`}<button class="btn peq" data-ed="${a.id}">Ver</button></td></tr>`).join('')
      : `<tr><td colspan="7">${vazio('atendimentos', 'Nenhum atendimento por aqui',
        'Cada vez que alguém procurar a secretaria — no balcão, por telefone ou no WhatsApp — registre aqui. Em um mês isso vira o retrato do que mais consome o tempo de vocês.',
        '<div class="acoes" style="justify-content:center"><button class="btn pri" id="vazioAt">Registrar o primeiro</button></div>')}</td></tr>`;
    $$('[data-ok]').forEach((b) => (b.onclick = tentar(async () => { await api('PUT', '/api/atendimentos/' + b.dataset.ok, { resolvido: true }); toast('Marcado como resolvido'); rotear(); })));
    $$('[data-ed]').forEach((b) => (b.onclick = () => formAtendimento(d, d.atendimentos.find((x) => x.id === +b.dataset.ed))));
    if ($('#vazioAt')) $('#vazioAt').onclick = () => formAtendimento(d);
  };
  ['fc', 'fp', 'fd', 'fq'].forEach((id) => ($('#' + id).oninput = desenhar));
  $('#novo').onclick = () => formAtendimento(d);
  $('#imp').onclick = () => window.print();
  desenhar();
};

function formAtendimento(d, at, alunoFixo) {
  const novo = !at;
  at = at || { canal: 'balcao', resolvido: true, data: hojeIso(), hora: new Date().toTimeString().slice(0, 5), aluno_id: alunoFixo?.id };
  let alunoId = at.aluno_id || null;
  modal(novo ? 'Registrar atendimento' : 'Atendimento de ' + dataBR(at.data), `<form id="fa">
    ${novo && !alunoFixo ? '<div class="campo"><label>Aluno (se o atendimento for sobre um aluno)</label><div id="selAt"></div></div>'
      : `<p><b>${esc(titulo(alunoFixo?.nome || at.aluno || 'Sem aluno vinculado'))}</b></p>`}
    <div class="campos" style="margin-top:10px">
      <div class="campo"><label>Canal</label><select id="a_canal">${Object.entries(d.canais).map(([k, v]) => `<option value="${k}" ${at.canal === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="campo"><label>Quem procurou</label><input id="a_pessoa" value="${esc(at.pessoa || '')}" placeholder="mãe, pai, responsável…"></div>
      <div class="campo"><label>Telefone</label><input id="a_tel" value="${esc(at.telefone || '')}"></div>
      <div class="campo"><label>Data</label><input type="date" id="a_data" value="${esc(at.data)}"></div>
      <div class="campo"><label>Hora</label><input type="time" id="a_hora" value="${esc(at.hora || '')}"></div>
      <div class="campo"><label>Assunto</label><select id="a_cat"><option value=""></option>${d.categorias.map((x) => `<option ${at.categoria === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
    </div>
    <div class="campo" style="margin-top:10px"><label>O que a pessoa precisava? *</label><input id="a_assunto" value="${esc(at.assunto || '')}" required></div>
    <div class="campo" style="margin-top:10px"><label>Detalhes</label><textarea id="a_det" style="min-height:70px">${esc(at.detalhe || '')}</textarea></div>
    <label class="chk" style="display:block;margin-top:10px"><input type="checkbox" id="a_res" ${at.resolvido ? 'checked' : ''}> Ficou resolvido na hora</label>
    <div class="campos" style="margin-top:8px"><div class="campo"><label>Se não, com quem ficou</label><input id="a_enc" value="${esc(at.encaminhado || '')}" placeholder="Samara, Direção…"></div>
      <div class="campo"><label>Retornar até</label><input type="date" id="a_ret" value="${esc(at.retorno_em || '')}"></div></div>
    ${at.usuario ? `<p class="dado" style="margin-top:8px">Atendido por ${esc(nomePessoa(at.usuario))}</p>` : ''}
    <div class="rodape">${novo ? '' : (EU.perfil === 'admin' ? '<button type="button" class="btn perigo" id="delA" style="margin-right:auto">Excluir</button>' : '')}
      <button type="button" class="btn" data-fechar>Fechar</button><button class="btn pri">Salvar</button></div></form>`,
  { onAbrir: (el, fechar) => {
    if (novo && !alunoFixo) seletorAluno($('#selAt', el), (a) => { alunoId = a.id; if (!$('#a_pessoa', el).value) $('#a_pessoa', el).value = titulo(a.nome_resp || a.nome_mae || ''); });
    $('#fa', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      const corpo = { aluno_id: alunoId, canal: $('#a_canal', el).value, pessoa: $('#a_pessoa', el).value, telefone: $('#a_tel', el).value,
        data: $('#a_data', el).value, hora: $('#a_hora', el).value, categoria: $('#a_cat', el).value, assunto: $('#a_assunto', el).value,
        detalhe: $('#a_det', el).value, resolvido: $('#a_res', el).checked, encaminhado: $('#a_enc', el).value, retorno_em: $('#a_ret', el).value };
      if (novo) await api('POST', '/api/atendimentos', corpo); else await api('PUT', '/api/atendimentos/' + at.id, corpo);
      fechar(); toast('Atendimento registrado'); rotear();
    });
    if ($('#delA', el)) $('#delA', el).onclick = tentar(async () => {
      if (!(await confirmar('Excluir este registro de atendimento?', 'Excluir'))) return;
      await api('DELETE', '/api/atendimentos/' + at.id); fechar(); rotear();
    });
  } });
}

// ───────────── Calendário ─────────────
TELAS.calendario = async (c, ano) => {
  ano = +ano || new Date().getFullYear();
  const d = await api('GET', '/api/calendario?ano=' + ano);
  const mesAtual = new Date().getMonth() + 1;
  const porMes = {};
  d.itens.forEach((i) => (porMes[i.mes] ??= []).push(i));
  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Calendário da secretaria</h1>
      <p class="sub">O que acontece em cada época do ano. Marque conforme for fazendo — a marcação vale por ano.</p></div>
    <div class="acoes"><button class="btn peq" id="ant">←</button><b>${ano}</b><button class="btn peq" id="prox">→</button>
      ${EU.perfil === 'admin' ? '<button class="btn ama" id="novo">＋ Lembrete</button>' : ''}</div></div>
  <div class="grade g4">
    <div class="cartao kpi destaque"><div class="rot">Lembretes de ${ano}</div><div class="val">${d.resumo.feitos}<small style="font-size:14px;color:var(--texto-2)"> / ${d.resumo.total}</small></div><div class="det">concluídos neste ano</div></div>
    <div class="cartao kpi ${d.resumo.atrasados ? 'alerta' : ''}"><div class="rot">Atrasados</div><div class="val">${d.resumo.atrasados}</div><div class="det">passaram da data e não foram marcados</div></div>
    <div class="cartao kpi"><div class="rot">Deste mês</div><div class="val">${d.resumo.do_mes}</div><div class="det">${esc(d.meses[mesAtual - 1])} ainda em aberto</div></div>
  </div>
  <div class="grade g2" style="margin-top:14px">
    ${d.meses.map((m, i) => { const mes = i + 1, itens = porMes[mes] || []; if (!itens.length) return '';
      return `<div class="cartao ${mes === mesAtual ? 'mes-atual' : ''}"><h2 style="text-transform:capitalize">${esc(m)} ${mes === mesAtual ? '<span class="tag t-novo">mês atual</span>' : ''}</h2>
        <ul class="checklist">${itens.map((i2) => `<li class="${i2.feito ? 'ok' : ''}"><input type="checkbox" data-i="${i2.id}" ${i2.feito ? 'checked' : ''} aria-label="${esc(i2.titulo)}">
          <span class="nome"><span>${esc(i2.titulo)}</span> ${i2.atrasado ? '<span class="tag t-vencida">atrasado</span>' : ''}
            <small>${i2.dia ? 'até ' + dataBR(i2.limite) : 'durante o mês'} · ${esc(nomePessoa(i2.responsavel))}${i2.categoria ? ' · ' + esc(i2.categoria) : ''}${i2.feito && i2.feito_por ? ' · feito por ' + esc(nomePessoa(i2.feito_por)) : ''}</small>
            ${i2.detalhe ? `<small>${esc(i2.detalhe)}</small>` : ''}</span>
          ${EU.perfil === 'admin' ? `<button class="btn peq" data-ed="${i2.id}">✏️</button>` : ''}</li>`).join('')}</ul></div>`;
    }).join('')}
  </div>`;
  $('#ant').onclick = () => (location.hash = '#/calendario/' + (ano - 1));
  $('#prox').onclick = () => (location.hash = '#/calendario/' + (ano + 1));
  $$('[data-i]').forEach((cb) => (cb.onchange = tentar(async () => {
    await api('PUT', `/api/calendario/${cb.dataset.i}/feito`, { feito: cb.checked, ano });
    toast(cb.checked ? 'Concluído' : 'Reaberto'); rotear();
  })));
  if ($('#novo')) $('#novo').onclick = () => formCalendario(d);
  $$('[data-ed]').forEach((b) => (b.onclick = () => formCalendario(d, d.itens.find((x) => x.id === +b.dataset.ed))));
};

function formCalendario(d, item) {
  const novo = !item;
  item = item || { mes: new Date().getMonth() + 1, responsavel: 'todos' };
  modal(novo ? 'Novo lembrete' : 'Editar lembrete', `<form id="fc">
    <div class="campo"><label>Lembrete *</label><input id="k_tit" value="${esc(item.titulo || '')}" required></div>
    <div class="campos" style="margin-top:10px">
      <div class="campo"><label>Mês</label><select id="k_mes">${d.meses.map((m, i) => `<option value="${i + 1}" ${item.mes === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="campo"><label>Dia (em branco = durante o mês)</label><input type="number" id="k_dia" min="1" max="31" value="${item.dia ?? ''}"></div>
      <div class="campo"><label>Responsável</label><select id="k_resp">${Object.entries(PESSOAS).map(([k, v]) => `<option value="${k}" ${item.responsavel === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="campo"><label>Categoria</label><input id="k_cat" value="${esc(item.categoria || '')}" placeholder="Financeiro, SED, Bolsas…"></div>
    </div>
    <div class="campo" style="margin-top:10px"><label>Detalhe</label><input id="k_det" value="${esc(item.detalhe || '')}"></div>
    <div class="rodape">${novo ? '' : '<button type="button" class="btn perigo" id="delK" style="margin-right:auto">Excluir</button>'}
      <button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Salvar</button></div></form>`,
  { onAbrir: (el, fechar) => {
    $('#fc', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      const corpo = { titulo: $('#k_tit', el).value, mes: +$('#k_mes', el).value, dia: $('#k_dia', el).value, responsavel: $('#k_resp', el).value,
        categoria: $('#k_cat', el).value, detalhe: $('#k_det', el).value };
      if (novo) await api('POST', '/api/calendario', corpo); else await api('PUT', '/api/calendario/' + item.id, corpo);
      fechar(); toast('Salvo'); rotear();
    });
    if ($('#delK', el)) $('#delK', el).onclick = tentar(async () => {
      if (!(await confirmar('Excluir o lembrete "' + item.titulo + '"?', 'Excluir'))) return;
      await api('DELETE', '/api/calendario/' + item.id); fechar(); rotear();
    });
  } });
}

// ───────────── Ficha do aluno: saída, fotos e atendimentos ─────────────
window.fichaEtapa3 = async (el, a) => {
  const [f, fot, at] = await Promise.all([
    api('GET', '/api/saida/aluno/' + a.id),
    api('GET', '/api/fotos/mutirao').then((d) => d.linhas.find((l) => l.aluno_id === a.id) || {}).catch(() => ({})),
    api('GET', '/api/atendimentos?aluno=' + a.id),
  ]);
  const sist = [['acadesc', 'ACADESC'], ['sed', 'SED'], ['lanche', 'Lanche Card']];
  el.innerHTML = `<div class="grade g2" style="margin-top:14px">
    <div class="cartao"><div class="acoes" style="justify-content:space-between"><h2 style="margin:0">🚪 Saída</h2>
      <div class="acoes"><button class="btn peq" id="s_termo">✍️ Termo de saída</button><button class="btn peq ama" id="s_aviso">＋ Aviso de hoje</button></div></div>
      ${f.avisos.length ? `<div class="dica" style="background:var(--amarelo-claro);border-color:var(--amarelo)">📌 Hoje quem busca é <b>${f.avisos.map((v) => esc(titulo(v.quem))).join(', ')}</b></div>` : ''}
      <label class="chk" style="display:block;margin:10px 0"><input type="checkbox" id="s_sozinho" ${f.sai_sozinho ? 'checked' : ''}> Pode sair sozinho (termo assinado)</label>
      <ul class="checklist" id="s_lista">${f.autorizados.map((x) => `<li><span class="nome"><span>${esc(titulo(x.nome))}</span>
        <small>${esc(x.parentesco || 'autorizado')}${x.documento ? ' · ' + esc(x.documento) : ''}${x.telefone ? ' · ' + esc(x.telefone) : ''}</small></span>
        <button class="btn peq perigo" data-delaut="${x.id}">Remover</button></li>`).join('')
        || '<li><span class="nome"><span class="dado">Ninguém autorizado além do responsável legal.</span></span></li>'}</ul>
      <div class="acoes" style="margin-top:10px"><button class="btn peq" id="s_add">＋ Quem pode buscar</button></div>
      ${f.termo_em ? `<p class="dado" style="margin-top:8px">Termo assinado em ${dataBR(f.termo_em)}</p>` : ''}</div>
    <div class="cartao"><h2>📷 Foto e 💳 boleto</h2>
      <p class="dado">Foto nos sistemas:</p>
      <div class="acoes">${sist.map(([k, n]) => `<span class="tag ${fot[k] ? 't-concluida' : 't-pendente'}">${n}${fot[k] ? ' ✓' : ''}</span>`).join('')}</div>
      <p class="dado" style="margin-top:10px">${fot.tirada ? `Foto tirada${fot.data_foto ? ' em ' + dataBR(fot.data_foto) : ''}.` : 'Ainda sem foto — entra no próximo mutirão.'}
        <a href="#/fotos">abrir mutirão</a></p>
      <h3 style="margin-top:16px">☎️ Últimos atendimentos</h3>
      ${at.atendimentos.length ? `<table><tbody>${at.atendimentos.slice(0, 5).map((x) => `<tr><td class="dado" style="width:80px">${dataBR(x.data)}</td>
        <td>${esc(x.assunto)}<br><small class="dado">${esc(at.canais[x.canal] || x.canal)} · ${esc(nomePessoa(x.usuario))}</small></td>
        <td>${x.resolvido ? '' : '<span class="tag t-vencendo">em aberto</span>'}</td></tr>`).join('')}</tbody></table>`
        : '<p class="vazio">Nenhum atendimento registrado.</p>'}
      <div class="acoes" style="margin-top:10px"><button class="btn peq" id="s_at">＋ Registrar atendimento</button></div></div>
  </div>`;
  $('#s_sozinho', el).onchange = tentar(async (e) => {
    await api('PUT', '/api/saida/aluno/' + a.id, { sai_sozinho: e.target.checked, termo_em: e.target.checked ? hojeIso() : '' });
    toast(e.target.checked ? 'Marcado: pode sair sozinho' : 'Desmarcado');
  });
  $('#s_termo', el).onclick = () => abrirDoc({ tipo: 'termo_saida', aluno: a.id });
  $('#s_aviso', el).onclick = () => formAviso({ id: a.id, nome: a.nome });
  $('#s_add', el).onclick = () => modal('Quem pode buscar ' + titulo(a.nome), `<form id="fq">
    <div class="campos"><div class="campo"><label>Nome completo *</label><input id="q_nome" required></div>
      <div class="campo"><label>Parentesco</label><input id="q_par" placeholder="Avó, tio, vizinha…"></div>
      <div class="campo"><label>Documento (RG)</label><input id="q_doc"></div>
      <div class="campo"><label>Telefone</label><input id="q_tel"></div></div>
    <p class="dica">Confira o documento da pessoa no portão antes de liberar o aluno.</p>
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Autorizar</button></div></form>`,
  { onAbrir: (m, fechar) => { $('#fq', m).onsubmit = tentar(async (ev) => {
    ev.preventDefault();
    await api('POST', '/api/saida/autorizados', { aluno_id: a.id, nome: $('#q_nome', m).value, parentesco: $('#q_par', m).value, documento: $('#q_doc', m).value, telefone: $('#q_tel', m).value });
    fechar(); toast('Autorizado'); rotear();
  }); } });
  $$('[data-delaut]', el).forEach((b) => (b.onclick = tentar(async () => {
    if (!(await confirmar('Remover esta autorização?', 'Remover'))) return;
    await api('DELETE', '/api/saida/autorizados/' + b.dataset.delaut); toast('Removido'); rotear();
  })));
  $('#s_at', el).onclick = () => formAtendimento(at, null, a);
};

// ───────────── Faixa do dia no painel inicial ─────────────
window.painelEtapa3 = async (el) => {
  const h = await api('GET', '/api/hoje');
  const pend = h.tarefas.minhas - h.tarefas.minhas_feitas;
  el.innerHTML = `<div class="cartao" style="border-left:4px solid var(--amarelo);margin-bottom:16px">
    <div class="acoes" style="justify-content:space-between">
      <div><b>${esc(h.dia_nome)}, ${dataBR(h.data)}</b> ·
        ${pend ? `você tem <b>${pend}</b> tarefa(s) para hoje` : 'suas tarefas de hoje estão em dia 🎉'}
        ${h.saida.pendentes ? ` · <b>${h.saida.pendentes}</b> aviso(s) de saída aguardando no portão` : ''}
        ${h.atendimentos.em_aberto ? ` · <b>${h.atendimentos.em_aberto}</b> atendimento(s) em aberto` : ''}
        ${h.lembretes_total ? ` · <b>${h.lembretes_total}</b> lembrete(s) do mês` : ''}</div>
      <div class="acoes"><a class="btn peq" href="#/hoje">Meu dia</a><a class="btn peq" href="#/portao">Portão</a></div>
    </div></div>`;
};

// Contadores do menu lateral
window.badgesEtapa3 = async () => {
  try {
    const h = await api('GET', '/api/hoje');
    const p = (id, n) => { const b = $('#badge-' + id); if (b) { b.hidden = !n; b.textContent = n; } };
    p('saida', h.saida.pendentes);
    p('tarefas', h.tarefas.minhas - h.tarefas.minhas_feitas);
  } catch { /* silencioso */ }
};
