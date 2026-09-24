// Etapa 3 — Mutirão de fotos (POP 5.2): quem ainda não tem foto e em quais dos 3 sistemas ela já entrou.
'use strict';
const { fotoDe } = require('../lib/fotos');

module.exports = function fotos(ctx) {
  const { rota, db, cfg, registrar, falha, json, corpoJson, hoje, agoraIso, S, turmaRotulo, transacao } = ctx;

  const SISTEMAS = ['acadesc', 'sed', 'lanche'];

  // A foto do arquivo é só uma pista: neste PC (ou sem a pasta configurada) ela não aparece,
  // e a conferência continua valendo pelo que a secretaria marcar à mão.
  rota('GET', '/api/fotos/mutirao', async (req, res) => {
    const c = cfg();
    const nomes = String(c.fotos_sistemas || 'ACADESC;SED;Lanche Card').split(';').map((s) => s.trim());
    const alunos = db.prepare('SELECT * FROM alunos WHERE ativo = 1 ORDER BY nome').all();
    const st = new Map(db.prepare('SELECT * FROM fotos_status').all().map((x) => [x.aluno_id, x]));
    const ordem = Object.fromEntries(S.SERIES.map((s, i) => [s.chave, i]));
    let comArquivo = 0;
    const linhas = alunos.map((a) => {
      const f = fotoDe(c.pastas_fotos, a.mat);
      if (f) comArquivo++;
      const k = st.get(a.id) || {};
      const sistemas = { acadesc: !!k.acadesc, sed: !!k.sed, lanche: !!k.lanche };
      const feitos = SISTEMAS.filter((s) => sistemas[s]).length;
      return {
        aluno_id: a.id, mat: a.mat, nome: a.nome, turma_rotulo: turmaRotulo(a), novo: !!a.novo,
        ordem: (a.novo ? 100 : 0) + (ordem[a.serie_chave] ?? 50),
        tem_arquivo: !!f, tirada: !!k.tirada || !!f, data_foto: k.data_foto || null, ...sistemas, feitos,
        completo: feitos === SISTEMAS.length, obs: k.obs || '', atualizado_por: k.atualizado_por || '',
      };
    });
    json(res, 200, {
      sistemas: nomes, pastas: c.pastas_fotos || '', linhas,
      resumo: {
        total: linhas.length, com_arquivo: comArquivo, sem_foto: linhas.filter((l) => !l.tirada).length,
        completos: linhas.filter((l) => l.completo).length,
        faltando: linhas.filter((l) => l.tirada && !l.completo).length,
        por_sistema: Object.fromEntries(SISTEMAS.map((s, i) => [nomes[i] || s, linhas.filter((l) => l[s]).length])),
      },
    });
  });

  function gravarFoto(alunoId, b, u) {
    const a = db.prepare('SELECT id, nome FROM alunos WHERE id = ?').get(alunoId) || falha(404, 'Aluno não encontrado');
    const at = db.prepare('SELECT * FROM fotos_status WHERE aluno_id = ?').get(a.id) || {};
    const bit = (k) => (b[k] === undefined ? at[k] ?? 0 : b[k] ? 1 : 0);
    const novo = { tirada: bit('tirada'), acadesc: bit('acadesc'), sed: bit('sed'), lanche: bit('lanche') };
    if (novo.acadesc || novo.sed || novo.lanche) novo.tirada = 1; // se já foi para algum sistema, a foto existe
    const data = b.data_foto !== undefined ? b.data_foto || null : novo.tirada ? at.data_foto || hoje() : null;
    const obs = b.obs === undefined ? at.obs ?? null : String(b.obs).trim() || null;
    db.prepare(`INSERT INTO fotos_status (aluno_id, tirada, data_foto, acadesc, sed, lanche, obs, atualizado_em, atualizado_por)
      VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(aluno_id) DO UPDATE SET tirada = excluded.tirada, data_foto = excluded.data_foto,
      acadesc = excluded.acadesc, sed = excluded.sed, lanche = excluded.lanche, obs = excluded.obs,
      atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por`)
      .run(a.id, novo.tirada, data, novo.acadesc, novo.sed, novo.lanche, obs, agoraIso(), u.login);
    return a;
  }

  rota('PUT', '/api/fotos/mutirao/:aluno', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const a = gravarFoto(+p.aluno, b, u);
    registrar(u.login, 'atualizou o mutirão de fotos', { aluno_id: a.id, nome: a.nome, ...b });
    json(res, 200, { ok: true });
  });

  // Marca a turma inteira de uma vez (ex.: "inseri a turma toda no Lanche Card")
  rota('POST', '/api/fotos/mutirao/lote', async (req, res, { u }) => {
    const b = await corpoJson(req);
    const ids = (Array.isArray(b.alunos) ? b.alunos : []).map(Number).filter(Boolean).slice(0, 800);
    if (!ids.length) falha(400, 'Nenhum aluno selecionado');
    transacao(() => { for (const id of ids) gravarFoto(id, b, u); });
    registrar(u.login, 'atualizou o mutirão de fotos em lote', { qtd: ids.length, ...b });
    json(res, 200, { ok: true, alterados: ids.length });
  });
};
