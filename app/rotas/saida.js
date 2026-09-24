// Etapa 3 — Autorização de saída: quem sai sozinho, quem pode buscar e os avisos do dia ("hoje quem busca é outra pessoa").
'use strict';

module.exports = function saida(ctx) {
  const { rota, db, cfg, registrar, falha, json, corpoJson, hoje, agoraIso, S, turmaRotulo, foneWhats, L } = ctx;

  const CANAIS = { whatsapp: 'WhatsApp', telefone: 'Telefone', presencial: 'Presencial', bilhete: 'Bilhete na agenda' };

  const autorizadosDe = (id) => db.prepare('SELECT * FROM saida_autorizados WHERE aluno_id = ? AND ativo = 1 ORDER BY nome').all(id);
  const avisosDe = (id, data) => db.prepare('SELECT * FROM saida_avisos WHERE aluno_id = ? AND data = ? ORDER BY id DESC').all(id, data);

  function fichaSaida(a, data) {
    const cfgS = db.prepare('SELECT * FROM saida_config WHERE aluno_id = ?').get(a.id) || {};
    return {
      aluno: {
        id: a.id, mat: a.mat, nome: a.nome, turma_rotulo: turmaRotulo(a), turno: a.turno,
        nome_mae: a.nome_mae, nome_pai: a.nome_pai, nome_resp: a.nome_resp, whatsapp: foneWhats(a),
      },
      sai_sozinho: !!cfgS.sai_sozinho, termo_em: cfgS.termo_em || null, transporte: cfgS.transporte || '', obs: cfgS.obs || '',
      atualizado_por: cfgS.atualizado_por || '', atualizado_em: cfgS.atualizado_em || null,
      autorizados: autorizadosDe(a.id), avisos: avisosDe(a.id, data || hoje()),
    };
  }

  // ── Consulta rápida no portão ──
  rota('GET', '/api/saida/portao', async (req, res, { url }) => {
    const q = S.norm(url.searchParams.get('q') || '');
    const data = url.searchParams.get('data') || hoje();
    if (q.length < 2) falha(400, 'Digite pelo menos 2 letras do nome do aluno');
    const alunos = db.prepare('SELECT * FROM alunos WHERE ativo = 1 ORDER BY nome').all()
      .filter((a) => [a.nome, a.mat, a.nome_mae, a.nome_pai, a.nome_resp].some((v) => S.norm(v).includes(q))).slice(0, 12);
    json(res, 200, { data, achados: alunos.map((a) => fichaSaida(a, data)) });
  });

  rota('GET', '/api/saida/aluno/:id', async (req, res, { p, url }) => {
    const a = db.prepare('SELECT * FROM alunos WHERE id = ?').get(+p.id) || falha(404, 'Aluno não encontrado');
    json(res, 200, { ...fichaSaida(a, url.searchParams.get('data') || hoje()), canais: CANAIS });
  });

  rota('PUT', '/api/saida/aluno/:id', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const a = db.prepare('SELECT id, nome FROM alunos WHERE id = ?').get(+p.id) || falha(404, 'Aluno não encontrado');
    const at = db.prepare('SELECT * FROM saida_config WHERE aluno_id = ?').get(a.id) || {};
    const v = {
      sai_sozinho: b.sai_sozinho === undefined ? at.sai_sozinho ?? 0 : b.sai_sozinho ? 1 : 0,
      termo_em: b.termo_em === undefined ? at.termo_em ?? null : b.termo_em || null,
      transporte: b.transporte === undefined ? at.transporte ?? null : String(b.transporte).trim() || null,
      obs: b.obs === undefined ? at.obs ?? null : String(b.obs).trim() || null,
    };
    db.prepare(`INSERT INTO saida_config (aluno_id, sai_sozinho, termo_em, transporte, obs, atualizado_em, atualizado_por) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(aluno_id) DO UPDATE SET sai_sozinho = excluded.sai_sozinho, termo_em = excluded.termo_em, transporte = excluded.transporte,
      obs = excluded.obs, atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por`)
      .run(a.id, v.sai_sozinho, v.termo_em, v.transporte, v.obs, agoraIso(), u.login);
    registrar(u.login, v.sai_sozinho ? 'marcou que o aluno sai sozinho' : 'atualizou a autorização de saída', { aluno_id: a.id, nome: a.nome });
    json(res, 200, { ok: true });
  });

  // ── Pessoas autorizadas a buscar ──
  rota('POST', '/api/saida/autorizados', async (req, res, { u }) => {
    const b = await corpoJson(req);
    const a = db.prepare('SELECT id, nome FROM alunos WHERE id = ?').get(+b.aluno_id) || falha(400, 'Aluno não encontrado');
    if (!String(b.nome || '').trim()) falha(400, 'Informe o nome de quem pode buscar');
    const r = db.prepare('INSERT INTO saida_autorizados (aluno_id, nome, parentesco, documento, telefone, obs, criado_em, criado_por) VALUES (?,?,?,?,?,?,?,?)')
      .run(a.id, String(b.nome).trim().toUpperCase(), b.parentesco || null, b.documento || null, b.telefone || null, b.obs || null, agoraIso(), u.login);
    registrar(u.login, 'autorizou pessoa a buscar o aluno', { aluno_id: a.id, nome: a.nome, quem: b.nome });
    json(res, 201, { id: Number(r.lastInsertRowid) });
  });

  rota('PUT', '/api/saida/autorizados/:id', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const at = db.prepare('SELECT * FROM saida_autorizados WHERE id = ?').get(+p.id) || falha(404, 'Autorização não encontrada');
    db.prepare(`UPDATE saida_autorizados SET nome = COALESCE(?, nome), parentesco = COALESCE(?, parentesco), documento = COALESCE(?, documento),
      telefone = COALESCE(?, telefone), obs = COALESCE(?, obs), ativo = COALESCE(?, ativo) WHERE id = ?`)
      .run(b.nome ? String(b.nome).toUpperCase() : null, b.parentesco ?? null, b.documento ?? null, b.telefone ?? null, b.obs ?? null,
        b.ativo == null ? null : b.ativo ? 1 : 0, at.id);
    registrar(u.login, 'alterou pessoa autorizada a buscar', { aluno_id: at.aluno_id, quem: at.nome, ...b });
    json(res, 200, { ok: true });
  });

  rota('DELETE', '/api/saida/autorizados/:id', async (req, res, { u, p }) => {
    const at = db.prepare('SELECT * FROM saida_autorizados WHERE id = ?').get(+p.id) || falha(404, 'Autorização não encontrada');
    const lixeira_id = L.excluir({ tipo: 'autorizado', rotulo: at.nome, usuario: u.login, aluno_id: at.aluno_id, tabela: 'saida_autorizados', onde: 'id = ?', params: [at.id] });
    registrar(u.login, 'removeu pessoa autorizada a buscar (foi para a lixeira)', { aluno_id: at.aluno_id, quem: at.nome });
    json(res, 200, { ok: true, lixeira_id });
  });

  // ── Avisos do dia: "hoje quem busca é outra pessoa" ──
  rota('GET', '/api/saida/avisos', async (req, res, { url }) => {
    const data = url.searchParams.get('data') || hoje();
    const lin = db.prepare(`SELECT v.*, a.nome aluno, a.mat, a.serie_chave, a.turma, a.novo, a.turno FROM saida_avisos v
      JOIN alunos a ON a.id = v.aluno_id WHERE v.data = ? ORDER BY v.conferido_em IS NOT NULL, a.nome`).all(data);
    json(res, 200, { data, canais: CANAIS, avisos: lin.map((v) => ({ ...v, turma_rotulo: turmaRotulo(v) })) });
  });

  rota('POST', '/api/saida/avisos', async (req, res, { u }) => {
    const b = await corpoJson(req);
    const a = db.prepare('SELECT id, nome FROM alunos WHERE id = ?').get(+b.aluno_id) || falha(400, 'Escolha o aluno');
    if (!String(b.quem || '').trim()) falha(400, 'Informe quem vai buscar hoje');
    if (b.canal && !CANAIS[b.canal]) falha(400, 'Canal inválido');
    // O termo de saída da escola não aceita autorização por telefone; deixamos configurável.
    if (b.canal === 'telefone' && cfg().saida_aviso_telefone !== '1' && !b.confirmar_telefone) {
      falha(409, 'A escola não aceita autorização só por telefone. Peça por WhatsApp, bilhete ou presencialmente — ou confirme para registrar mesmo assim.');
    }
    const r = db.prepare(`INSERT INTO saida_avisos (aluno_id, data, quem, parentesco, documento, canal, quem_avisou, horario, obs, criado_em, criado_por)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(a.id, b.data || hoje(), String(b.quem).trim().toUpperCase(), b.parentesco || null, b.documento || null,
      b.canal || 'whatsapp', b.quem_avisou || null, b.horario || null, b.obs || null, agoraIso(), u.login);
    registrar(u.login, 'registrou aviso de saída do dia', { aluno_id: a.id, nome: a.nome, quem: b.quem, data: b.data || hoje() });
    json(res, 201, { id: Number(r.lastInsertRowid) });
  });

  // Conferir no portão: marca que o aviso foi usado (quem entregou a criança e quando)
  rota('PUT', '/api/saida/avisos/:id', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const v = db.prepare('SELECT * FROM saida_avisos WHERE id = ?').get(+p.id) || falha(404, 'Aviso não encontrado');
    if (b.conferido !== undefined) {
      db.prepare('UPDATE saida_avisos SET conferido_em = ?, conferido_por = ? WHERE id = ?')
        .run(b.conferido ? agoraIso() : null, b.conferido ? u.login : null, v.id);
      registrar(u.login, b.conferido ? 'liberou a saída conferindo o aviso' : 'desmarcou a conferência do aviso', { aluno_id: v.aluno_id, quem: v.quem });
    }
    const ks = ['quem', 'parentesco', 'documento', 'canal', 'quem_avisou', 'horario', 'obs'].filter((k) => b[k] !== undefined);
    if (ks.length) db.prepare(`UPDATE saida_avisos SET ${ks.map((k) => k + ' = ?').join(', ')} WHERE id = ?`)
      .run(...ks.map((k) => (b[k] === '' ? null : k === 'quem' ? String(b[k]).toUpperCase() : b[k])), v.id);
    json(res, 200, { ok: true });
  });

  rota('DELETE', '/api/saida/avisos/:id', async (req, res, { u, p }) => {
    const v = db.prepare('SELECT * FROM saida_avisos WHERE id = ?').get(+p.id) || falha(404, 'Aviso não encontrado');
    const lixeira_id = L.excluir({ tipo: 'aviso_saida', rotulo: `${v.quem} (${v.data.split('-').reverse().join('/')})`, usuario: u.login, aluno_id: v.aluno_id,
      tabela: 'saida_avisos', onde: 'id = ?', params: [v.id] });
    registrar(u.login, 'excluiu aviso de saída (foi para a lixeira)', { aluno_id: v.aluno_id, quem: v.quem });
    json(res, 200, { ok: true, lixeira_id });
  });

  // Lista por turma (tela e impressão do portão)
  rota('GET', '/api/saida/turmas', async (req, res, { url }) => {
    const data = url.searchParams.get('data') || hoje();
    const chave = url.searchParams.get('serie');
    const alunos = db.prepare(`SELECT * FROM alunos WHERE ativo = 1 ${chave ? 'AND serie_chave = ? AND COALESCE(turma, \'\') = ?' : ''} ORDER BY nome`)
      .all(...(chave ? [chave, url.searchParams.get('turma') || ''] : []));
    const cfgs = new Map(db.prepare('SELECT * FROM saida_config').all().map((x) => [x.aluno_id, x]));
    const autor = new Map();
    for (const x of db.prepare('SELECT * FROM saida_autorizados WHERE ativo = 1 ORDER BY nome').all()) {
      if (!autor.has(x.aluno_id)) autor.set(x.aluno_id, []);
      autor.get(x.aluno_id).push(x);
    }
    const avisos = new Map();
    for (const v of db.prepare('SELECT * FROM saida_avisos WHERE data = ?').all(data)) {
      if (!avisos.has(v.aluno_id)) avisos.set(v.aluno_id, []);
      avisos.get(v.aluno_id).push(v);
    }
    const ordem = Object.fromEntries(S.SERIES.map((s, i) => [s.chave, i]));
    json(res, 200, {
      data,
      alunos: alunos.map((a) => {
        const c = cfgs.get(a.id) || {};
        return {
          aluno_id: a.id, mat: a.mat, nome: a.nome, turma_rotulo: turmaRotulo(a), turno: a.turno,
          ordem: (a.novo ? 100 : 0) + (ordem[a.serie_chave] ?? 50),
          sai_sozinho: !!c.sai_sozinho, termo_em: c.termo_em || null, transporte: c.transporte || '', obs: c.obs || '',
          autorizados: autor.get(a.id) || [], avisos: avisos.get(a.id) || [],
          responsavel: a.nome_resp || a.nome_mae || a.nome_pai || '', whatsapp: foneWhats(a),
        };
      }),
    });
  });
};
