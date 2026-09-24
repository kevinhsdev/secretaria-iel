// Etapa 4 — Cópias de segurança: fazer, listar, restaurar e avisar quando estão atrasadas.
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('../lib/backup');

module.exports = function backup(ctx) {
  const { rota, db, cfg, registrar, falha, json, corpoJson, exigirAdmin, agoraIso, PASTA_DADOS } = ctx;

  // Todo mundo pode ver se o backup está em dia (é o aviso do painel); mexer, só a administração.
  rota('GET', '/api/backups/estado', async (req, res) => {
    json(res, 200, { ...B.estado(cfg(), PASTA_DADOS), pendente: B.restauracaoPendente(PASTA_DADOS) });
  });

  rota('GET', '/api/backups', async (req, res, { u }) => {
    exigirAdmin(u);
    const c = cfg();
    json(res, 200, {
      estado: B.estado(c, PASTA_DADOS), lista: B.listar(c, PASTA_DADOS),
      pendente: B.restauracaoPendente(PASTA_DADOS), motivos: B.MOTIVOS, pasta_padrao: path.join(PASTA_DADOS, 'backups'),
    });
  });

  rota('POST', '/api/backups', async (req, res, { u }) => {
    exigirAdmin(u);
    let r;
    try { r = B.fazerBackup(db, cfg(), PASTA_DADOS, 'manual'); }
    catch (e) { falha(500, 'Não consegui gravar o backup: ' + e.message + ' (confira a pasta em Configurações).'); }
    registrar(u.login, 'fez cópia de segurança', { arquivo: r.arquivo, cifrado: r.cifrado });
    json(res, 201, r);
  });

  // Precisa vir ANTES de /api/backups/:arquivo, senão a rota genérica engole "restaurar"
  rota('DELETE', '/api/backups/restaurar', async (req, res, { u }) => {
    exigirAdmin(u);
    B.cancelarRestauracao(PASTA_DADOS);
    registrar(u.login, 'cancelou a restauração agendada', '');
    json(res, 200, { ok: true });
  });

  rota('DELETE', '/api/backups/:arquivo', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const nome = path.basename(p.arquivo);
    const alvo = path.join(B.pastaDe(cfg(), PASTA_DADOS), nome);
    if (!/^secretaria-.*\.db(\.cifrado)?$/.test(nome) || !fs.existsSync(alvo)) falha(404, 'Backup não encontrado');
    fs.rmSync(alvo, { force: true });
    registrar(u.login, 'apagou uma cópia de segurança', nome);
    json(res, 200, { ok: true });
  });

  // Senha do backup: fica guardada para os backups automáticos saírem cifrados.
  // Ela protege o arquivo que sai daqui (pen drive, OneDrive) — não o banco do PC.
  rota('PUT', '/api/backups/senha', async (req, res, { u }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    const senha = String(b.senha ?? '');
    if (senha && senha.length < 8) falha(400, 'A senha do backup precisa ter pelo menos 8 caracteres');
    db.prepare("INSERT INTO config (chave, valor) VALUES ('backup_senha', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").run(senha);
    registrar(u.login, senha ? 'definiu senha para os backups' : 'removeu a senha dos backups', '');
    // Gera já uma cópia no novo formato, para a pessoa conferir que consegue abrir
    let r = null;
    try { r = B.fazerBackup(db, cfg(), PASTA_DADOS, 'config'); } catch { /* a listagem mostra o que houver */ }
    json(res, 200, { ok: true, cifrado: !!senha, backup: r });
  });

  // Restaurar não troca o arquivo na hora: agenda a troca e o sistema reinicia.
  rota('POST', '/api/backups/restaurar', async (req, res, { u }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    if (!b.arquivo) falha(400, 'Escolha qual backup restaurar');
    let atual = null;
    try { atual = B.fazerBackup(db, cfg(), PASTA_DADOS, 'restauracao'); } catch { /* segue: o banco atual também é copiado na troca */ }
    let r;
    try { r = B.prepararRestauracao(cfg(), PASTA_DADOS, b.arquivo, b.senha); }
    catch (e) { falha(400, e.message); }
    registrar(u.login, 'agendou a restauração de um backup', { arquivo: r.arquivo, copia_do_atual: atual && atual.arquivo });
    json(res, 200, { ...r, copia_do_atual: atual && atual.arquivo });
  });

  // Reiniciar o sistema (o "Iniciar Secretaria.bat" sobe de novo sozinho)
  rota('POST', '/api/admin/reiniciar', async (req, res, { u }) => {
    exigirAdmin(u);
    registrar(u.login, 'reiniciou o sistema', '');
    json(res, 200, { ok: true });
    setTimeout(() => process.exit(90), 400); // 90 = combinado com o .bat para subir de novo
  });
};
