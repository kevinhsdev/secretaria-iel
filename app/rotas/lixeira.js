// Lixeira: ver o que foi excluído, restaurar e apagar de vez. A limpeza do que passou do prazo é automática.
'use strict';

module.exports = function lixeira(ctx) {
  const { rota, db, cfg, registrar, falha, json, exigirAdmin, L } = ctx;
  const dias = () => Math.max(1, +(cfg().lixeira_dias || 30));
  // A aprendiz vê e restaura só o que ela mesma excluiu; a administração vê tudo.
  const podeVer = (u, i) => u.perfil === 'admin' || (i.usuario === u.login && !L.SO_ADMIN.has(i.tipo));

  const limpar = () => { const n = L.limpar(dias()); if (n) registrar('sistema', 'esvaziou itens vencidos da lixeira', { quantidade: n }); };
  limpar();
  setInterval(limpar, 6 * 60 * 60 * 1000).unref();

  rota('GET', '/api/lixeira', async (req, res, { u }) => {
    const d = dias();
    const itens = db.prepare('SELECT id, tipo, rotulo, aluno_id, usuario, excluido_em FROM lixeira ORDER BY id DESC').all()
      .filter((i) => podeVer(u, i))
      .map((i) => ({ ...i, tipo_nome: L.TIPOS[i.tipo] || i.tipo, some_em: new Date(Date.parse(i.excluido_em) + d * 86400000).toISOString() }));
    json(res, 200, { dias: d, itens, tipos: L.TIPOS });
  });

  rota('POST', '/api/lixeira/:id/restaurar', async (req, res, { u, p }) => {
    const i = db.prepare('SELECT id, tipo, rotulo, aluno_id, usuario FROM lixeira WHERE id = ?').get(+p.id) || falha(404, 'Este item não está mais na lixeira.');
    if (!podeVer(u, i)) falha(403, 'Só a administração pode restaurar o que outra pessoa excluiu.');
    const r = L.restaurar(i.id);
    if (r.erro) falha(409, r.erro);
    registrar(u.login, 'restaurou da lixeira: ' + (L.TIPOS[i.tipo] || i.tipo).toLowerCase(), { rotulo: i.rotulo, ...(i.aluno_id ? { aluno_id: i.aluno_id } : {}) });
    json(res, 200, { ok: true, tipo: i.tipo });
  });

  rota('DELETE', '/api/lixeira/:id', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const i = db.prepare('SELECT tipo, rotulo FROM lixeira WHERE id = ?').get(+p.id) || falha(404, 'Este item não está mais na lixeira.');
    db.prepare('DELETE FROM lixeira WHERE id = ?').run(+p.id);
    registrar(u.login, 'apagou de vez da lixeira', { tipo: i.tipo, rotulo: i.rotulo });
    json(res, 200, { ok: true });
  });

  rota('DELETE', '/api/lixeira', async (req, res, { u }) => {
    exigirAdmin(u);
    const n = Number(db.prepare('DELETE FROM lixeira').run().changes);
    registrar(u.login, 'esvaziou a lixeira', { quantidade: n });
    json(res, 200, { ok: true, apagados: n });
  });
};
