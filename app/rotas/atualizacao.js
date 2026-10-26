// Etapa 4 — Botão "Verificar atualizações": sempre com cópia de segurança antes e reinício depois.
'use strict';
const A = require('../lib/atualizacao');
const B = require('../lib/backup');
const { VERSAO } = require('../lib/versao');
const { execFile } = require('child_process');

module.exports = function atualizacao(ctx) {
  const { rota, db, cfg, registrar, json, exigirAdmin, falha, lerCorpo, PASTA_DADOS } = ctx;

  rota('GET', '/api/admin/atualizacao', async (req, res, { u }) => {
    exigirAdmin(u);
    json(res, 200, { versao: VERSAO, ...(await A.estado()) });
  });

  // ── Instalar o Git pelo winget (o instalador oficial da Microsoft que já vem no Windows 10/11) ──
  // Só no próprio computador do sistema: o Windows pode abrir a janela "Deseja permitir…" e alguém precisa clicar Sim ali.
  let instalacao = null; // { rodando, inicio, fim, ok, aviso }
  rota('GET', '/api/admin/atualizacao/instalar-git', async (req, res, { u }) => {
    exigirAdmin(u);
    json(res, 200, instalacao || { rodando: false });
  });
  rota('POST', '/api/admin/atualizacao/instalar-git', async (req, res, { u }) => {
    exigirAdmin(u);
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    if (!local) falha(400, 'A instalação só pode ser feita no computador onde o sistema está instalado (o servidor). Vá até ele e clique lá.');
    if (process.platform !== 'win32') falha(400, 'A instalação automática só funciona no Windows.');
    if (instalacao?.rodando) return json(res, 200, instalacao);
    instalacao = { rodando: true, inicio: new Date().toISOString() };
    registrar(u.login, 'começou a instalar o Git', '');
    execFile('winget', ['install', '--id', 'Git.Git', '-e', '--source', 'winget', '--silent', '--accept-package-agreements', '--accept-source-agreements'],
      { timeout: 15 * 60000, windowsHide: true }, async (erro, saida, saidaErro) => {
        const e = await A.estado();
        const semWinget = erro && (erro.code === 'ENOENT' || /não é reconhecido|not recognized/i.test(String(saidaErro)));
        instalacao = {
          rodando: false, inicio: instalacao.inicio, fim: new Date().toISOString(), ok: !!e.git,
          aviso: e.git ? '' : semWinget ? 'Este Windows não tem o instalador automático (winget). Use o botão "Baixar do site oficial" e siga o passo a passo.'
            : 'A instalação não terminou. Se apareceu a janela "Deseja permitir…", é preciso clicar em Sim. Tente de novo ou use o site oficial.',
        };
        registrar(u.login, e.git ? 'instalou o Git' : 'tentou instalar o Git', instalacao.aviso || '');
      });
    json(res, 200, instalacao);
  });

  // Atualizar sem Git: a tela manda o .zip; cópia de segurança antes, troca a pasta app (guardando app-antigo) e a tela pede o reinício
  rota('POST', '/api/admin/atualizacao/zip', async (req, res, { u }) => {
    exigirAdmin(u);
    const buf = await lerCorpo(req, 60 * 1024 * 1024);
    let copia;
    try { copia = B.fazerBackup(db, cfg(), PASTA_DADOS, 'atualizacao'); }
    catch (e) { return json(res, 200, { ok: false, aviso: 'Não consegui gravar a cópia de segurança antes de atualizar (' + e.message + '). A atualização foi cancelada.' }); }
    const r = A.aplicarZip(buf, VERSAO);
    registrar(u.login, r.ok ? 'atualizou o sistema por arquivo .zip' : 'tentou atualizar o sistema por arquivo .zip', { de: VERSAO, para: r.para, aviso: r.aviso, copia: copia.arquivo });
    json(res, 200, { ...r, copia: copia.arquivo, precisa_reiniciar: !!r.ok });
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
