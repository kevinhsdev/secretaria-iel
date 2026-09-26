// 4.9.0 — Vivências: a criança passa um período na escola antes de a família decidir a matrícula.
// Substitui a planilha "Controle de Vivência" (Google): mesmas colunas, mesmas listas e o mesmo painel,
// mais o controle de quem já foi contatado depois da vivência.
'use strict';

module.exports = function vivencias(ctx) {
  const { rota, db, registrar, falha, conferirVersao, json, corpoJson, lerCorpo, hoje, agoraIso, S, lerPlanilha, serialParaIso, transacao, L } = ctx;

  // As listas da aba "Listas" da planilha
  const LISTAS = {
    ano_escolar: ['Berçário', 'Maternal I', 'Maternal II', 'Pré I', 'Pré II', ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${n}º Ano EF`), '1ª Série EM', '2ª Série EM', '3ª Série EM'],
    classe: S.SERIES.map((s) => s.rotulo),
    status: ['Agendada', 'Realizada', 'Faltou', 'Remarcada', 'Cancelada'],
    efetivou: ['Sim', 'Não', 'Em análise'],
    como_conheceu: ['Indicação de família', 'Instagram', 'Facebook', 'Google / Site', 'Fachada / Placa', 'Ex-aluno', 'Igreja / Comunidade', 'Evento da escola', 'Panfleto', 'Outro'],
    periodo: ['Manhã', 'Tarde', 'Integral'],
  };
  const CAMPOS = ['aluno', 'responsavel', 'telefone', 'ano_escolar', 'classe', 'data', 'periodo', 'escola_atual', 'como_conheceu', 'status', 'efetivou',
    'data_matricula', 'contato_em', 'contato_obs', 'obs'];
  const anoDe = (v) => +String(v.data || v.criado_em || hoje()).slice(0, 4);

  function validar(b) {
    if (b.status && !LISTAS.status.includes(b.status)) falha(400, 'Status inválido: ' + b.status);
    if (b.efetivou && !LISTAS.efetivou.includes(b.efetivou)) falha(400, 'Opção inválida em "Efetivou matrícula": ' + b.efetivou);
    for (const k of ['data', 'data_matricula', 'contato_em']) if (b[k] && !/^\d{4}-\d{2}-\d{2}$/.test(b[k])) falha(400, 'Data inválida');
  }
  // Matriculou: a data da matrícula vem sozinha se ninguém digitou
  function ajustar(reg, atual = {}) {
    if (reg.efetivou === 'Sim' && !reg.data_matricula && !atual.data_matricula) reg.data_matricula = hoje();
    if (reg.efetivou && reg.efetivou !== 'Sim' && reg.data_matricula === undefined && atual.data_matricula) reg.data_matricula = null;
    return reg;
  }

  // O painel da planilha, calculado aqui
  function painel(lista, ano) {
    const conta = (campo, opcoes) => {
      const m = new Map(opcoes.map((o) => [o, 0]));
      for (const v of lista) { const k = v[campo] || '(em branco)'; m.set(k, (m.get(k) || 0) + 1); }
      return [...m.entries()].filter(([k, n]) => n || opcoes.includes(k));
    };
    const realizadas = lista.filter((v) => v.status === 'Realizada');
    const efetivadas = lista.filter((v) => v.efetivou === 'Sim');
    const h = hoje();
    return {
      ano, total: lista.length, realizadas: realizadas.length, efetivadas: efetivadas.length,
      // % de efetivação: das vivências que aconteceram, quantas viraram matrícula
      pct_efetivacao: realizadas.length ? Math.round((1000 * efetivadas.length) / realizadas.length) / 10 : 0,
      aguardando: lista.filter((v) => v.efetivou === 'Em análise' && v.status === 'Realizada').length,
      nao_efetivadas: lista.filter((v) => v.efetivou === 'Não').length,
      a_realizar: lista.filter((v) => ['Agendada', 'Remarcada'].includes(v.status)).length,
      hoje: lista.filter((v) => v.data === h && ['Agendada', 'Remarcada'].includes(v.status)).length,
      atrasadas: lista.filter((v) => v.data && v.data < h && ['Agendada', 'Remarcada'].includes(v.status)).length,
      ausencias: lista.filter((v) => ['Faltou', 'Cancelada'].includes(v.status)).length,
      sem_contato: lista.filter((v) => v.status === 'Realizada' && v.efetivou === 'Em análise' && !v.contato_em).length,
      por_status: conta('status', LISTAS.status),
      por_efetivou: conta('efetivou', LISTAS.efetivou),
      por_ano_escolar: conta('ano_escolar', LISTAS.ano_escolar),
      por_classe: conta('classe', LISTAS.classe),
      por_origem: conta('como_conheceu', LISTAS.como_conheceu),
      por_mes: Array.from({ length: 12 }, (_, i) => {
        const mes = `${ano}-${String(i + 1).padStart(2, '0')}`;
        const doMes = lista.filter((v) => String(v.data || '').startsWith(mes));
        return { mes: i + 1, total: doMes.length, efetivadas: doMes.filter((v) => v.efetivou === 'Sim').length };
      }),
    };
  }

  rota('GET', '/api/vivencias', async (req, res, { url }) => {
    const todas = db.prepare('SELECT * FROM vivencias ORDER BY COALESCE(data, substr(criado_em,1,10)) DESC, id DESC').all();
    const anos = [...new Set([new Date().getFullYear(), ...todas.map(anoDe)])].sort((a, b) => b - a);
    const ano = +(url.searchParams.get('ano') || new Date().getFullYear());
    const doAno = todas.filter((v) => anoDe(v) === ano);
    json(res, 200, { listas: LISTAS, anos, ano, vivencias: doAno, painel: painel(doAno, ano) });
  });

  rota('POST', '/api/vivencias', async (req, res, { u }) => {
    const b = await corpoJson(req);
    if (!String(b.aluno || '').trim()) falha(400, 'Informe o nome da criança');
    validar(b);
    const reg = ajustar(Object.fromEntries(CAMPOS.filter((k) => b[k] !== undefined).map((k) => [k, String(b[k] ?? '').trim() || null])));
    reg.status = reg.status || 'Agendada'; reg.efetivou = reg.efetivou || 'Em análise';
    if (reg.contato_em) reg.contato_por = u.login;
    Object.assign(reg, { criado_em: agoraIso(), criado_por: u.login, atualizado_em: agoraIso(), atualizado_por: u.login });
    const ks = Object.keys(reg);
    const r = db.prepare(`INSERT INTO vivencias (${ks.join(', ')}) VALUES (${ks.map(() => '?').join(', ')})`).run(...ks.map((k) => reg[k]));
    registrar(u.login, 'registrou vivência', { nome: reg.aluno, data: reg.data });
    json(res, 201, { id: Number(r.lastInsertRowid) });
  });

  rota('PUT', '/api/vivencias/:id', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const v = db.prepare('SELECT * FROM vivencias WHERE id = ?').get(+p.id) || falha(404, 'Vivência não encontrada');
    validar(b);
    conferirVersao(v, b, u);
    const reg = ajustar(Object.fromEntries(CAMPOS.filter((k) => b[k] !== undefined).map((k) => [k, String(b[k] ?? '').trim() || null])), v);
    if (reg.aluno === null) falha(400, 'Informe o nome da criança');
    if (reg.contato_em && reg.contato_em !== v.contato_em) reg.contato_por = u.login;
    if (reg.contato_em === null) reg.contato_por = null;
    const ks = Object.keys(reg);
    if (!ks.length) return json(res, 200, { ok: true });
    db.prepare(`UPDATE vivencias SET ${ks.map((k) => k + ' = ?').join(', ')}, atualizado_em = ?, atualizado_por = ? WHERE id = ?`)
      .run(...ks.map((k) => reg[k]), agoraIso(), u.login, v.id);
    registrar(u.login, 'atualizou vivência', { id: v.id, nome: v.aluno, campos: ks });
    json(res, 200, { ok: true });
  });

  rota('DELETE', '/api/vivencias/:id', async (req, res, { u, p }) => {
    const v = db.prepare('SELECT aluno, data FROM vivencias WHERE id = ?').get(+p.id) || falha(404, 'Vivência não encontrada');
    const lixeira_id = L.excluir({ tipo: 'vivencia', rotulo: v.aluno + (v.data ? ` (${v.data.split('-').reverse().join('/')})` : ''), usuario: u.login,
      tabela: 'vivencias', onde: 'id = ?', params: [+p.id] });
    registrar(u.login, 'excluiu vivência (foi para a lixeira)', { nome: v.aluno });
    json(res, 200, { ok: true, lixeira_id });
  });

  // Importa a planilha "Controle de Vivência" (baixada do Google como .xlsx), aba "Registro de Vivências"
  rota('POST', '/api/vivencias/importar', async (req, res, { u, url }) => {
    const abas = lerPlanilha(await lerCorpo(req), url.searchParams.get('arquivo') || 'x.xlsx');
    let aba, cab = -1;
    for (const a of abas) {
      const i = a.linhas.findIndex((l) => l.some((c) => S.norm(c) === 'nome do aluno') && l.some((c) => S.norm(c).startsWith('status')));
      if (i >= 0) { aba = a; cab = i; break; }
    }
    if (!aba) falha(400, 'Não achei as colunas "Nome do Aluno" e "Status da Vivência". Baixe a planilha do Google como Excel (.xlsx) e envie de novo.');
    const col = {};
    const APELIDOS = {
      aluno: ['nome do aluno'], responsavel: ['responsavel'], telefone: ['telefone'], ano_escolar: ['ano escolar'], classe: ['classe da vivencia'],
      data: ['data da vivencia'], periodo: ['periodo'], escola_atual: ['escola atual'], como_conheceu: ['como conheceu', 'como conheceu a escola'],
      status: ['status da vivencia'], efetivou: ['efetivou matricula'], data_matricula: ['data da matricula'], obs: ['observacao', 'observacoes'],
    };
    aba.linhas[cab].forEach((c, i) => { const n = S.norm(c); for (const [k, nomes] of Object.entries(APELIDOS)) if (col[k] == null && nomes.includes(n)) col[k] = i; });
    const perto = (lista, v) => lista.find((o) => S.norm(o) === S.norm(v)) || null;
    // Escreve igual à lista quando só muda maiúscula/acento; o que não está na lista fica como veio
    const padrao = (lista, v) => (v == null ? null : perto(lista, v) || v);
    const existe = db.prepare('SELECT 1 FROM vivencias WHERE lower(aluno) = lower(?) AND COALESCE(data,\'\') = COALESCE(?,\'\')');
    const r = { importadas: 0, repetidas: 0 };
    transacao(() => {
      for (const l of aba.linhas.slice(cab + 1)) {
        const val = (k) => (col[k] == null ? null : l[col[k]]);
        const txt = (k) => { const v = val(k); return v == null ? null : String(v).trim() || null; };
        const aluno = txt('aluno');
        if (!aluno) continue;
        const reg = {
          aluno, responsavel: txt('responsavel'), telefone: txt('telefone'), ano_escolar: padrao(LISTAS.ano_escolar, txt('ano_escolar')), classe: txt('classe'),
          data: serialParaIso(val('data')), periodo: padrao(LISTAS.periodo, txt('periodo')), escola_atual: txt('escola_atual'),
          como_conheceu: padrao(LISTAS.como_conheceu, txt('como_conheceu')),
          status: perto(LISTAS.status, txt('status')) || 'Agendada', efetivou: perto(LISTAS.efetivou, txt('efetivou')) || 'Em análise',
          data_matricula: serialParaIso(val('data_matricula')), obs: txt('obs'),
          criado_em: agoraIso(), criado_por: u.login, atualizado_em: agoraIso(), atualizado_por: u.login,
        };
        if (existe.get(reg.aluno, reg.data)) { r.repetidas++; continue; }
        const ks = Object.keys(reg);
        db.prepare(`INSERT INTO vivencias (${ks.join(', ')}) VALUES (${ks.map(() => '?').join(', ')})`).run(...ks.map((k) => reg[k]));
        r.importadas++;
      }
    });
    registrar(u.login, 'importou a planilha de vivências', r);
    json(res, 200, r);
  });
};
