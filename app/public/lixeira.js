// Secretaria IEL — Lixeira: o que foi excluído fica aqui por alguns dias (lixeira_dias) antes de sumir de vez
'use strict';

TELAS.lixeira = async (c) => {
  const d = await api('GET', '/api/lixeira');
  const admin = EU.perfil === 'admin';
  const diasAte = (iso) => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86400000));
  const tipos = [...new Set(d.itens.map((i) => i.tipo))];

  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Lixeira</h1>
      <p class="sub">${admin ? 'Tudo o que foi excluído' : 'O que você excluiu'} fica aqui por <b>${d.dias} dias</b> e pode voltar com um clique. Depois disso, some de vez.</p></div>
    ${admin && d.itens.length ? '<button class="btn perigo" id="esvaziar">Esvaziar a lixeira</button>' : ''}</div>
  ${d.itens.length ? `<div class="cartao">
    <div class="filtros">
      <select id="lt"><option value="">Tudo (${d.itens.length})</option>${tipos.map((t) => `<option value="${esc(t)}">${esc(d.tipos[t] || t)} (${d.itens.filter((i) => i.tipo === t).length})</option>`).join('')}</select>
      <input id="lq" placeholder="Procurar pelo nome ou assunto…" style="flex:1;min-width:200px">
    </div>
    <div class="tabela-wrap"><table><thead><tr><th>Excluído em</th><th>O quê</th><th>Descrição</th>${admin ? '<th>Quem excluiu</th>' : ''}<th>Some em</th><th></th></tr></thead><tbody id="ltb"></tbody></table></div>
  </div>` : `<div class="cartao">${vazio('lixeira', 'A lixeira está vazia',
    'Quando alguém excluir um atendimento, um aviso de saída, uma tarefa ou outro registro, ele vem para cá e pode ser restaurado.')}</div>`}
  ${admin ? `<form class="cartao" id="lcfg" style="margin-top:14px"><h3>Quanto tempo guardar</h3>
    <div class="acoes"><label>Apagar de vez depois de <input type="number" id="ldias" min="1" max="365" value="${d.dias}" style="width:80px"> dias</label>
      <button class="btn">Salvar</button></div>
    <p class="dado" style="margin-top:8px">O descarte de ex-alunos da LGPD não passa pela lixeira: ali a exclusão é para valer, e o que estava na lixeira sobre aquele aluno também some.</p></form>` : ''}`;

  const desenhar = () => {
    const ft = $('#lt').value, q = norm($('#lq').value);
    const f = d.itens.filter((i) => (!ft || i.tipo === ft) && (!q || norm(`${i.rotulo} ${i.tipo_nome} ${i.usuario}`).includes(q)));
    $('#ltb').innerHTML = f.length ? f.map((i) => { const n = diasAte(i.some_em); return `<tr>
      <td class="dado">${new Date(i.excluido_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td>${esc(i.tipo_nome)}</td>
      <td>${i.aluno_id ? `<a href="#/aluno/${i.aluno_id}">${esc(titulo(i.rotulo || ''))}</a>` : esc(i.rotulo || '—')}</td>
      ${admin ? `<td class="dado">${esc(nomeUsuario(i.usuario))}</td>` : ''}
      <td>${n <= 3 ? `<span class="tag t-vencendo">${n ? plural(n, 'dia', 'dias') : 'hoje'}</span>` : `<span class="dado">${plural(n, 'dia', 'dias')}</span>`}</td>
      <td class="acoes" style="justify-content:flex-end"><button class="btn peq pri" data-rest="${i.id}">Restaurar</button>
        ${admin ? `<button class="btn peq perigo" data-apagar="${i.id}" title="Apagar de vez">Apagar de vez</button>` : ''}</td></tr>`; }).join('')
      : '<tr><td colspan="6" class="vazio">Nada encontrado com esse filtro.</td></tr>';
    $$('[data-rest]', c).forEach((b) => (b.onclick = tentar(async () => {
      b.disabled = true;
      try { await api('POST', `/api/lixeira/${b.dataset.rest}/restaurar`); } finally { b.disabled = false; }
      invalidar(); toast('Restaurado: voltou para o lugar de antes'); rotear();
    })));
    $$('[data-apagar]', c).forEach((b) => (b.onclick = tentar(async () => {
      if (!(await confirmar('Apagar de vez? Depois disso não tem como recuperar (só por uma cópia de segurança).', 'Apagar de vez'))) return;
      await api('DELETE', '/api/lixeira/' + b.dataset.apagar); toast('Apagado de vez'); rotear();
    })));
  };
  if (d.itens.length) { $('#lt').onchange = desenhar; $('#lq').oninput = desenhar; desenhar(); }
  if ($('#esvaziar')) $('#esvaziar').onclick = tentar(async () => {
    if (!(await confirmar(`Apagar de vez os ${d.itens.length} itens da lixeira? Não tem como desfazer.`, 'Esvaziar'))) return;
    await api('DELETE', '/api/lixeira'); toast('Lixeira esvaziada'); rotear();
  });
  if ($('#lcfg')) $('#lcfg').onsubmit = tentar(async (e) => {
    e.preventDefault();
    const n = Math.max(1, Math.min(365, +$('#ldias').value || 30));
    await api('PUT', '/api/admin/config', { lixeira_dias: n });
    EU.config.lixeira_dias = String(n); toast('Salvo'); rotear();
  });
};

// Nome bonito de quem excluiu ("samara" → "Samara"); "sistema" fica como está
function nomeUsuario(login) { return login ? titulo(login) : '—'; }
