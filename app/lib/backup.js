// Etapa 4 — Cópias de segurança do banco.
// A cópia é feita com "VACUUM INTO": funciona com o sistema aberto e já sai com tudo o que está no WAL.
// Se houver senha de backup, o arquivo sai cifrado (AES-256-GCM) — é ele que viaja no pen drive/OneDrive.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MARCA = Buffer.from('IELBK1');           // marca para reconhecer arquivo cifrado nosso
const CABECALHO_SQLITE = 'SQLite format 3\0';
const MOTIVOS = { inicio: 'ao abrir o sistema', automatico: 'automática', manual: 'feita à mão', restauracao: 'antes de restaurar', config: 'mudança de configuração' };

function pastaDe(cfg, PASTA_DADOS) {
  const p = String(cfg.backup_pasta || '').trim() || path.join(PASTA_DADOS, 'backups');
  fs.mkdirSync(p, { recursive: true });
  return p;
}

const carimbo = (d = new Date()) => `${d.toLocaleDateString('sv-SE')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`;

// ───────────────────────── cifra ─────────────────────────
function cifrar(dados, senha) {
  const sal = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const chave = crypto.scryptSync(senha, sal, 32);
  const c = crypto.createCipheriv('aes-256-gcm', chave, iv);
  const corpo = Buffer.concat([c.update(dados), c.final()]);
  return Buffer.concat([MARCA, sal, iv, c.getAuthTag(), corpo]);
}

function decifrar(buf, senha) {
  if (!buf.subarray(0, MARCA.length).equals(MARCA)) throw new Error('Este arquivo não é um backup cifrado do Secretaria IEL.');
  const sal = buf.subarray(6, 22), iv = buf.subarray(22, 34), tag = buf.subarray(34, 50), corpo = buf.subarray(50);
  const chave = crypto.scryptSync(senha, sal, 32);
  const d = crypto.createDecipheriv('aes-256-gcm', chave, iv);
  d.setAuthTag(tag);
  try { return Buffer.concat([d.update(corpo), d.final()]); }
  catch { throw new Error('Senha do backup incorreta (ou o arquivo está danificado).'); }
}

const pareceBanco = (buf) => buf.subarray(0, 16).toString('latin1') === CABECALHO_SQLITE;

// ───────────────────────── fazer e listar ─────────────────────────
function fazerBackup(db, cfg, PASTA_DADOS, motivo = 'manual') {
  const pasta = pastaDe(cfg, PASTA_DADOS);
  const senha = String(cfg.backup_senha || '');
  const base = `secretaria-${carimbo()}-${motivo}`;
  const temporario = path.join(pasta, base + '.tmp');
  try { fs.rmSync(temporario, { force: true }); } catch { /* não existia */ }
  db.exec(`VACUUM INTO '${temporario.replace(/'/g, "''")}'`);

  let destino = path.join(pasta, base + '.db');
  if (senha) {
    destino = path.join(pasta, base + '.db.cifrado');
    fs.writeFileSync(destino, cifrar(fs.readFileSync(temporario), senha));
    fs.rmSync(temporario, { force: true });
  } else {
    fs.renameSync(temporario, destino);
  }
  const tamanho = fs.statSync(destino).size;
  limpar(cfg, PASTA_DADOS);
  return { arquivo: path.basename(destino), caminho: destino, tamanho, cifrado: !!senha, quando: new Date().toISOString(), motivo };
}

function listar(cfg, PASTA_DADOS) {
  const pasta = pastaDe(cfg, PASTA_DADOS);
  let itens = [];
  try { itens = fs.readdirSync(pasta); } catch { return []; }
  return itens
    .filter((n) => /^secretaria-.*\.db(\.cifrado)?$/.test(n))
    .map((n) => {
      let st;
      try { st = fs.statSync(path.join(pasta, n)); } catch { return null; }
      const m = n.match(/^secretaria-(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-\d{2}-([a-z]+)\./);
      return {
        arquivo: n, tamanho: st.size, quando: st.mtime.toISOString(),
        data: m ? m[1] : null, hora: m ? `${m[2]}:${m[3]}` : null,
        motivo: m ? m[4] : '', motivo_rotulo: m ? MOTIVOS[m[4]] || m[4] : '',
        cifrado: n.endsWith('.cifrado'),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.quando.localeCompare(a.quando));
}

function limpar(cfg, PASTA_DADOS) {
  const manter = Math.max(3, Number(cfg.backup_manter) || 30);
  const pasta = pastaDe(cfg, PASTA_DADOS);
  const velhos = listar(cfg, PASTA_DADOS).slice(manter);
  for (const b of velhos) { try { fs.rmSync(path.join(pasta, b.arquivo), { force: true }); } catch { /* segue */ } }
  return velhos.length;
}

function estado(cfg, PASTA_DADOS) {
  const lista = listar(cfg, PASTA_DADOS);
  const ultimo = lista[0] || null;
  const horas = ultimo ? (Date.now() - Date.parse(ultimo.quando)) / 3600000 : null;
  const avisarDias = Math.max(1, Number(cfg.backup_avisar_dias) || 2);
  let pasta = '';
  let acessivel = true;
  try { pasta = pastaDe(cfg, PASTA_DADOS); } catch { acessivel = false; }
  return {
    pasta, acessivel, total: lista.length, ultimo,
    idade_horas: horas == null ? null : Math.round(horas * 10) / 10,
    atrasado: horas == null || horas > avisarDias * 24,
    nunca: !ultimo,
    cifrado: !!String(cfg.backup_senha || ''),
    espaco: lista.reduce((s, b) => s + b.tamanho, 0),
    intervalo_horas: Math.max(1, Number(cfg.backup_horas) || 6),
    manter: Math.max(3, Number(cfg.backup_manter) || 30),
    avisar_dias: avisarDias,
  };
}

// Já passou da hora do próximo backup automático?
const naHora = (cfg, PASTA_DADOS) => {
  const e = estado(cfg, PASTA_DADOS);
  return e.nunca || e.idade_horas >= e.intervalo_horas;
};

// ───────────────────────── restauração ─────────────────────────
// Trocar o banco com ele aberto dá problema, então a troca fica agendada e acontece
// na próxima abertura do sistema, antes de qualquer coisa tocar no arquivo.
const AVISO = 'RESTAURAR.pendente';
const PRONTO = 'RESTAURAR.db';

function prepararRestauracao(cfg, PASTA_DADOS, arquivo, senha) {
  const pasta = pastaDe(cfg, PASTA_DADOS);
  const origem = path.join(pasta, path.basename(arquivo));
  if (!fs.existsSync(origem)) throw new Error('Backup não encontrado: ' + path.basename(arquivo));
  let dados = fs.readFileSync(origem);
  if (origem.endsWith('.cifrado')) {
    if (!senha) throw new Error('Este backup está cifrado: informe a senha do backup.');
    dados = decifrar(dados, senha);
  }
  if (!pareceBanco(dados)) throw new Error('O arquivo escolhido não parece um banco do sistema.');
  fs.writeFileSync(path.join(PASTA_DADOS, PRONTO), dados);
  fs.writeFileSync(path.join(PASTA_DADOS, AVISO), path.basename(arquivo), 'utf8');
  return { arquivo: path.basename(arquivo), tamanho: dados.length };
}

const restauracaoPendente = (PASTA_DADOS) => {
  try { return fs.readFileSync(path.join(PASTA_DADOS, AVISO), 'utf8').trim(); } catch { return null; }
};

const cancelarRestauracao = (PASTA_DADOS) => {
  for (const f of [AVISO, PRONTO]) { try { fs.rmSync(path.join(PASTA_DADOS, f), { force: true }); } catch { /* segue */ } }
};

// Chamada por lib/db.js na abertura do sistema, ANTES de abrir o banco.
function aplicarPendente(PASTA_DADOS) {
  const marcado = restauracaoPendente(PASTA_DADOS);
  if (!marcado) return null;
  const pronto = path.join(PASTA_DADOS, PRONTO);
  const banco = path.join(PASTA_DADOS, 'secretaria.db');
  try {
    if (!fs.existsSync(pronto) || !pareceBanco(fs.readFileSync(pronto).subarray(0, 16))) throw new Error('arquivo preparado sumiu ou está danificado');
    // Guarda o banco atual antes de trocar — se a restauração for um engano, ele continua aqui
    if (fs.existsSync(banco)) fs.copyFileSync(banco, path.join(PASTA_DADOS, `antes-da-restauracao-${carimbo()}.db`));
    for (const sufixo of ['-wal', '-shm']) { try { fs.rmSync(banco + sufixo, { force: true }); } catch { /* segue */ } }
    fs.copyFileSync(pronto, banco);
    cancelarRestauracao(PASTA_DADOS);
    return { restaurado: marcado };
  } catch (e) {
    cancelarRestauracao(PASTA_DADOS);
    return { erro: e.message, arquivo: marcado };
  }
}

module.exports = { fazerBackup, listar, limpar, estado, naHora, pastaDe, prepararRestauracao, restauracaoPendente, cancelarRestauracao, aplicarPendente, cifrar, decifrar, MOTIVOS };
