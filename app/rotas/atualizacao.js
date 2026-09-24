// Etapa 4 — Botão "Verificar atualizações": sempre com cópia de segurança antes e reinício depois.
'use strict';
const A = require('../lib/atualizacao');
const B = require('../lib/backup');
const { VERSAO } = require('../lib/versao');

module.exports = function atualizacao(ctx) {
  const { rota, db, cfg, registrar, json, exigirAdmin, PASTA_DADOS } = ctx;

  rota('GET', '/api/admin/atualizacao', async (req, res, { u }) => {
    exigirAdmin(u);
    json(res, 200, { versao: VERSAO, ...(await A.estado()) });
  });

  // Fala com o GitHub — pode demorar alguns segundos
  rota('POST', '/api/admin/atualizacao/verificar', async (req, res, { u }) => {
    exigirAdmin(u);
    const r = await A.verificar();
    registrar(u.login, 'verificou atualizações', r.verificado ? { disponivel: !!r.disponivel, novidades: (r.novidades || []).length } : r.aviso);
    json(res, 200, { versao: VERSAO, ...r });
  });

  // Copia o banco, traz a versão nova e avisa que precisa reiniciar
  rota('POST', '/api/admin/atualizacao/aplicar', async (req, res, { u }) => {
    exigirAdmin(u);
    let copia = null;
    try { copia = B.fazerBackup(db, cfg(), PASTA_DADOS, 'config'); }
    catch (e) {
      return json(res, 200, { ok: false, aviso: 'Não consegui gravar a cópia de segurança antes de atualizar (' + e.message +
        '). Por segurança, a atualização foi cancelada. Confira a pasta em Configurações › Cópias de segurança.' });
    }
    const r = await A.aplicar();
    registrar(u.login, r.ok ? 'atualizou o sistema' : 'tentou atualizar o sistema', { de: r.de, para: r.para, aviso: r.aviso, copia: copia.arquivo });
    json(res, 200, { ...r, copia: copia.arquivo, precisa_reiniciar: !!r.atualizou });
  });
};
