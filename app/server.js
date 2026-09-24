// Secretaria IEL — servidor do aplicativo de gestão da secretaria do Instituto Educacional Luterano.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { db, inicializar, cfg, cfgPublica, registrar, registrarAcesso, transacao, hashSenha, conferirSenha, PASTA_DADOS, restauracao } = require('./lib/db');
const copias = require('./lib/backup');
const { VERSAO } = require('./lib/versao');
const { lerPlanilha, serialParaIso } = require('./lib/planilha');
const S = require('./lib/series');
const { gerarContrato } = require('./lib/contrato');
const prontuario = require('./lib/prontuario');
const { gerarDemo, gerarDemoEtapa2, gerarDemoEtapa3 } = require('./lib/demo');

inicializar();

const PORTA = Number(process.env.IEL_PORTA || 3000);
// Por enquanto só este PC acessa. Para liberar aos outros PCs da rede, rode com IEL_REDE=1 (veja LEIA-ME).
const HOST = process.env.IEL_REDE === '1' ? '0.0.0.0' : '127.0.0.1';
const PUBLICO = path.join(__dirname, 'public');

// ───────────────────────── sessões ─────────────────────────
// As sessões ficam na memória e também no banco (só o hash do token, nunca o token): se o servidor cair ou
// reiniciar (atualização, restauração), ninguém é jogado para a tela de entrada e perde o que estava digitando.
const DOZE_HORAS = 12 * 3600 * 1000;
const sessoes = {
  mem: new Map(),
  hash: (tok) => crypto.createHash('sha256').update(String(tok)).digest('hex'),
  get(tok) {
    let s = this.mem.get(tok);
    if (!s) {
      const r = db.prepare('SELECT uid, expira, bloqueada FROM sessoes WHERE hash = ?').get(this.hash(tok));
      if (r) { s = { uid: r.uid, expira: r.expira, bloqueada: !!r.bloqueada, gravado: r.expira }; this.mem.set(tok, s); }
    }
    return s;
  },
  set(tok, s) {
    this.mem.set(tok, { ...s, gravado: s.expira });
    db.prepare('INSERT OR REPLACE INTO sessoes (hash, uid, expira, bloqueada) VALUES (?, ?, ?, ?)').run(this.hash(tok), s.uid, s.expira, s.bloqueada ? 1 : 0);
  },
  // Grava no banco o que mudou (prazo ou bloqueio de tela)
  gravar(tok) {
    const s = this.mem.get(tok);
    if (!s) return;
    db.prepare('UPDATE sessoes SET expira = ?, bloqueada = ? WHERE hash = ?').run(s.expira, s.bloqueada ? 1 : 0, this.hash(tok));
    s.gravado = s.expira;
  },
  delete(tok) { this.mem.delete(tok); db.prepare('DELETE FROM sessoes WHERE hash = ?').run(this.hash(tok)); },
};
db.prepare('DELETE FROM sessoes WHERE expira < ?').run(Date.now());
function sessaoDe(req) {
  const tok = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith('iel='))?.slice(4);
  const s = tok && sessoes.get(tok);
  if (!s || s.expira < Date.now()) { if (tok) sessoes.delete(tok); return null; }
  s.expira = Date.now() + DOZE_HORAS;
  if (s.expira - s.gravado > 10 * 60 * 1000) sessoes.gravar(tok); // não escreve no banco a cada clique
  const u = db.prepare('SELECT id, login, nome, perfil, trocar_senha, ativo FROM usuarios WHERE id = ?').get(s.uid);
  return u && u.ativo ? { token: tok, usuario: u, bloqueada: !!s.bloqueada } : null;
}

// ───────────────────────── utilitários HTTP ─────────────────────────
class ErroHttp extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra; } }
const falha = (status, msg, extra) => { throw new ErroHttp(status, msg, extra); };

// Duas pessoas editando a mesma ficha: quem salva por último não passa por cima em silêncio.
// A tela manda _versao (o atualizado_em que ela carregou). Se outra pessoa gravou depois, devolve 409 com quem e quando,
// e a tela pergunta se quer salvar mesmo assim (_forcar). Tira _versao e _forcar do corpo antes de gravar.
function conferirVersao(atual, b, u) {
  const versao = b._versao, forcar = b._forcar;
  delete b._versao; delete b._forcar;
  if (versao === undefined || forcar) return;
  if ((atual.atualizado_em || null) === (versao || null)) return;
  if (!atual.atualizado_por || atual.atualizado_por === u.login) return;
  const nome = atual.atualizado_por === 'importacao' ? 'A importação do ACADESC'
    : db.prepare('SELECT nome FROM usuarios WHERE login = ?').get(atual.atualizado_por)?.nome || atual.atualizado_por;
  falha(409, `${nome} alterou isto enquanto você editava.`, { conflito: { por: nome, em: atual.atualizado_em } });
}

function json(res, status, dados, extras = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extras });
  res.end(JSON.stringify(dados));
}

function lerCorpo(req, limite = 25 * 1024 * 1024) {
  return new Promise((ok, erro) => {
    const partes = []; let tam = 0;
    req.on('data', (c) => { tam += c.length; if (tam > limite) { erro(new ErroHttp(413, 'Arquivo grande demais')); req.destroy(); } else partes.push(c); });
    req.on('end', () => ok(Buffer.concat(partes)));
    req.on('error', erro);
  });
}
async function corpoJson(req) {
  const b = await lerCorpo(req, 1024 * 1024);
  if (!b.length) return {};
  try { return JSON.parse(b.toString('utf8')); } catch { falha(400, 'JSON inválido'); }
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function servirEstatico(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const arq = path.normalize(path.join(PUBLICO, rel));
  if (!arq.startsWith(PUBLICO + path.sep)) return json(res, 403, { erro: 'Proibido' });
  fs.readFile(arq, (e, dados) => {
    if (e) { // SPA: qualquer rota desconhecida volta para o index
      return fs.readFile(path.join(PUBLICO, 'index.html'), (e2, idx) => {
        res.writeHead(e2 ? 404 : 200, { 'Content-Type': TIPOS['.html'] }); res.end(e2 ? 'Não encontrado' : idx);
      });
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(dados);
  });
}

// ───────────────────────── regras de negócio ─────────────────────────
const hoje = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso local
const somarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
const agoraIso = () => new Date().toISOString();
const L = require('./lib/lixeira')({ db, transacao, agoraIso });

const STATUS = {
  pendente: 'Não iniciada',
  reservada: 'Em andamento',
  concluida: 'Concluída',
  nao_renova: 'Não vai renovar',
  transferido: 'Transferido',
};
const STATUS_MATRICULADO = ['reservada', 'concluida'];

function destinoDe(aluno, ano) {
  const r = db.prepare('SELECT serie_destino FROM rematriculas WHERE aluno_id = ? AND ano = ?').get(aluno.id, ano);
  if (r && r.serie_destino) return S.porChave(r.serie_destino);
  if (aluno.novo) return S.porChave(aluno.serie_chave); // aluno novo já é cadastrado na série que vai cursar
  return S.proxima(aluno.serie_chave);
}

function docsAplicaveis(aluno) {
  return db.prepare('SELECT * FROM doc_tipos WHERE ativo = 1 ORDER BY ordem, id').all()
    .filter((d) => d.aplica === 'todos' || aluno.novo);
}

function turmaRotulo(a) {
  const s = S.porChave(a.serie_chave);
  return s ? `${s.rotulo}${a.turma ? ' ' + a.turma : ''}` : [a.descricao, a.serie, a.turma].filter(Boolean).join(' ');
}

// Calcula as pendências de documentos de todos os alunos já (re)matriculados no ano
function calcularPendencias(ano, prazoDias) {
  const alunos = db.prepare(`SELECT a.*, r.status, r.data_matricula FROM alunos a JOIN rematriculas r ON r.aluno_id = a.id AND r.ano = ?
    WHERE a.ativo = 1 AND r.status IN ('reservada','concluida') ORDER BY a.nome`).all(ano);
  const tipos = db.prepare('SELECT * FROM doc_tipos WHERE ativo = 1 AND obrigatorio = 1 ORDER BY ordem, id').all();
  const entregues = new Set(db.prepare('SELECT aluno_id, doc_id FROM entregas WHERE ano = ? AND entregue = 1').all(ano).map((e) => e.aluno_id + ':' + e.doc_id));
  const h = hoje();
  const lista = [];
  for (const a of alunos) {
    const faltam = tipos.filter((t) => (t.aplica === 'todos' || a.novo) && !entregues.has(a.id + ':' + t.id));
    if (!faltam.length) continue;
    const prazo = a.data_matricula ? somarDias(a.data_matricula, prazoDias) : null;
    const dias = prazo ? Math.round((Date.parse(prazo) - Date.parse(h)) / 86400000) : null;
    const serieOrdem = S.SERIES.findIndex((s) => s.chave === a.serie_chave);
    lista.push({
      aluno_id: a.id, mat: a.mat, nome: a.nome, novo: !!a.novo, serie_chave: a.serie_chave,
      turma: a.novo ? `Alunos novos · ${(S.porChave(a.serie_chave) || {}).rotulo || '?'} ${ano}` : turmaRotulo(a),
      ordem: (a.novo ? 100 : 0) + (serieOrdem < 0 ? 50 : serieOrdem),
      destino: (destinoDe(a, ano) || {}).rotulo || '', responsavel: a.nome_resp || a.nome_mae || a.nome_pai || '',
      whatsapp: foneWhats(a), faltam: faltam.map((t) => t.nome), data_matricula: a.data_matricula, prazo, dias,
      situacao: dias == null ? 'sem_prazo' : dias < 0 ? 'vencida' : dias <= 7 ? 'vencendo' : 'no_prazo',
    });
  }
  return lista;
}

function foneWhats(a) {
  for (const t of [a.cel_mae, a.cel_pai, a.telefone, a.tel_mae, a.tel_pai]) {
    let d = String(t || '').replace(/\D/g, '');
    if (d.startsWith('0')) d = d.slice(1);
    if (d.length === 11 && d[2] === '9') return '55' + d;
    if (d.length === 9 && d[0] === '9') return '5511' + d; // sem DDD: assume 11
  }
  return '';
}

function exigirAdmin(u) { if (u.perfil !== 'admin') falha(403, 'Somente a administração (Samara) pode fazer isso'); }

// Importa uma exportação de alunos do ACADESC (mesmas colunas da aba Planilha1 do contrato)
const APELIDOS = {
  mat: ['mat', 'matricula', 'matrícula', 'ra'], nome: ['nome', 'nome do aluno', 'aluno'], telefone: ['telefone'],
  ano_letivo: ['anoletivo', 'ano letivo'], descricao: ['descricao', 'descrição', 'curso'], serie: ['serie', 'série'],
  turma: ['turma'], turno: ['turno'], filho_funcionario: ['filhofuncionario', 'filho funcionario'],
  nome_mae: ['nomemae', 'nome mae', 'mae'], nome_pai: ['nomepai', 'nome pai', 'pai'], nome_resp: ['nomeresp', 'responsavel', 'nome responsavel'],
  email: ['email'], email_mae: ['emailmae'], email_pai: ['emailpai'], tel_mae: ['telefonemae'], cel_mae: ['celularmae'],
  tel_pai: ['telefonepai'], cel_pai: ['celularpai'], dt_nasc: ['dtnascimento', 'data nascimento', 'nascimento', 'dt nasc', 'data nasc'],
  nis: ['nis'], cpf: ['cpf'], nome_social: ['nomesocial', 'nome social'],
  // Exportação de responsáveis/endereços (aba Planilha3 do contrato de atividade extra)
  descclasse: ['descclasse', 'classe'], ra: ['ra aluno', 'r.a.', 'ra sed'], rg: ['rg', 'rgaluno', 'rg aluno'],
  endereco: ['endereco', 'endereço'], bairro: ['bairro'], cidade: ['cidade'], uf: ['estado', 'uf'], cep: ['cep'],
  cpf_resp: ['cpfresp', 'cpf resp', 'cpf responsavel'], rg_resp: ['rgresp', 'rg resp', 'rg responsavel'], tel_resp: ['telefoneresp', 'telefone resp'],
};
function importarAlunos(abas, usuario) {
  let aba, cab = -1;
  for (const a of abas) {
    const i = a.linhas.findIndex((l) => l.some((c) => S.norm(c) === 'nome') && l.some((c) => ['mat', 'matricula'].includes(S.norm(c))));
    if (i >= 0) { aba = a; cab = i; break; }
  }
  if (!aba) falha(400, 'Não encontrei o cabeçalho com as colunas "Mat" e "Nome". Use a exportação de alunos do ACADESC.');
  const col = {};
  aba.linhas[cab].forEach((c, i) => {
    const n = S.norm(c);
    for (const [campo, nomes] of Object.entries(APELIDOS)) if (col[campo] == null && nomes.includes(n)) col[campo] = i;
  });
  const res = { novos: 0, atualizados: 0, ignorados: 0, sem_serie: [] };
  const buscar = db.prepare('SELECT id FROM alunos WHERE mat = ?');
  const campos = Object.keys(APELIDOS).filter((k) => k !== 'mat');
  transacao(() => {
    for (const l of aba.linhas.slice(cab + 1)) {
      const val = (k) => (col[k] == null ? undefined : l[col[k]]);
      const mat = String(val('mat') ?? '').trim();
      const nome = String(val('nome') ?? '').trim();
      if (!mat || !nome || !/^\d+$/.test(mat)) { if (mat || nome) res.ignorados++; continue; }
      const reg = {};
      for (const k of campos) {
        let v = val(k);
        if (v === undefined) continue;
        if (k === 'dt_nasc') v = serialParaIso(v);
        else if (k === 'filho_funcionario') v = /^s/i.test(String(v)) ? 1 : 0;
        else if (k === 'ano_letivo') v = Number(v) || null;
        else if (k === 'nome_social' && typeof v === 'number') continue; // coluna às vezes reaproveitada para valores
        else if (k === 'cep' && v != null && v !== '') { const d = String(v).replace(/\D/g, '').padStart(8, '0'); v = d.slice(0, 5) + '-' + d.slice(5, 8); }
        else v = v == null ? null : String(v).trim() || null;
        reg[k] = v;
      }
      let s = null;
      if (reg.descricao !== undefined || reg.serie !== undefined) s = S.identificar(reg.descricao, reg.serie);
      if (reg.descclasse !== undefined) {
        const c = S.identificarClasse(reg.descclasse);
        if (c && !s) { s = c.serie; reg.descricao = s.descricao; reg.serie = s.serie; if (c.turma && reg.turma === undefined) reg.turma = c.turma; }
      }
      delete reg.descclasse;
      if (s) reg.serie_chave = s.chave;
      else if (!buscar.get(mat)) res.sem_serie.push(nome);
      reg.atualizado_em = agoraIso(); reg.atualizado_por = 'importacao';
      const ex = buscar.get(mat);
      const ks = Object.keys(reg);
      if (ex) {
        db.prepare(`UPDATE alunos SET ${ks.map((k) => k + ' = ?').join(', ')}, ativo = 1, demo = 0 WHERE id = ?`).run(...ks.map((k) => reg[k]), ex.id);
        res.atualizados++;
      } else {
        db.prepare(`INSERT INTO alunos (mat, ${ks.join(', ')}) VALUES (?, ${ks.map(() => '?').join(', ')})`).run(mat, ...ks.map((k) => reg[k]));
        res.novos++;
      }
    }
  });
  registrar(usuario, 'importou alunos do ACADESC', res);
  return res;
}

// Importa a planilha "Cadastros_SIG" (primeiro contato das famílias)
function importarInteressados(abas, usuario) {
  let aba, cab = -1;
  for (const a of abas) {
    const i = a.linhas.findIndex((l) => l.some((c) => S.norm(c) === 'aluno') && l.some((c) => S.norm(c) === 'responsavel'));
    if (i >= 0) { aba = a; cab = i; break; }
  }
  if (!aba) falha(400, 'Não encontrei as colunas "Aluno" e "Responsável" (planilha Cadastros SIG).');
  const idx = {};
  aba.linhas[cab].forEach((c, i) => { idx[S.norm(c)] = i; });
  const pega = (l, ...nomes) => { for (const n of nomes) if (idx[n] != null && l[idx[n]] != null) return l[idx[n]]; return null; };
  let n = 0;
  const ins = db.prepare(`INSERT INTO interessados (data, tipo_contato, aluno, dt_nasc, responsavel, contato, endereco, email, escola_atual, serie_interesse, obs, ultimo_contato, status, criado_por)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  transacao(() => {
    for (const l of aba.linhas.slice(cab + 1)) {
      const aluno = String(pega(l, 'aluno') ?? '').trim();
      if (!aluno) continue;
      const matric = S.norm(pega(l, 'matriculado?', 'matriculado'));
      const status = matric.startsWith('sim') ? 'matriculado' : matric.startsWith('nao') ? 'contatado' : 'novo';
      const txt = (v) => (v == null ? null : String(v).trim() || null);
      ins.run(serialParaIso(pega(l, 'data')), txt(pega(l, 'tipo contato')), aluno, serialParaIso(pega(l, 'data nascimento')),
        txt(pega(l, 'responsavel')), txt(pega(l, 'contato')), txt(pega(l, 'endereco completo (bairro e cep)', 'endereco')),
        txt(pega(l, 'e-mail', 'email')), txt(pega(l, 'escola atual')), txt(pega(l, 'turma', 'serie')), txt(pega(l, 'observacao')),
        serialParaIso(pega(l, 'ultimo contato')), status, usuario);
      n++;
    }
  });
  registrar(usuario, 'importou interessados (SIG)', { linhas: n });
  return { importados: n };
}

// ───────────────────────── rotas ─────────────────────────
const rotas = [];
const rota = (metodo, padrao, fn, publica = false) => {
  const chaves = [];
  const re = new RegExp('^' + padrao.replace(/:(\w+)/g, (_, k) => { chaves.push(k); return '([^/]+)'; }) + '$');
  rotas.push({ metodo, re, chaves, fn, publica });
};

// Tentativas de login (proteção simples contra força bruta)
const tentativas = new Map();
rota('POST', '/api/login', async (req, res) => {
  const { login, senha } = await corpoJson(req);
  const chave = String(login || '').toLowerCase();
  const t = tentativas.get(chave) || { n: 0, ate: 0 };
  if (t.ate > Date.now()) falha(429, 'Muitas tentativas. Aguarde 1 minuto.');
  const u = db.prepare('SELECT * FROM usuarios WHERE login = ? AND ativo = 1').get(chave);
  if (!u || !conferirSenha(String(senha || ''), u.senha_hash)) {
    t.n++; if (t.n >= 5) { t.ate = Date.now() + 60_000; t.n = 0; } tentativas.set(chave, t);
    falha(401, 'Usuário ou senha incorretos');
  }
  tentativas.delete(chave);
  const token = crypto.randomBytes(32).toString('hex');
  sessoes.set(token, { uid: u.id, expira: Date.now() + DOZE_HORAS });
  registrar(u.login, 'entrou no sistema', '');
  json(res, 200, { ok: true }, { 'Set-Cookie': `iel=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200` });
}, true);

rota('POST', '/api/logout', async (req, res, { sessao }) => {
  sessoes.delete(sessao.token);
  json(res, 200, { ok: true }, { 'Set-Cookie': 'iel=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
});

// Pública e sem dado nenhum: a tela usa para saber se o servidor voltou depois de cair
rota('GET', '/api/versao', async (req, res) => json(res, 200, { versao: VERSAO }), true);
rota('GET', '/api/eu', async (req, res, { u, sessao }) => json(res, 200, { ...u, versao: VERSAO, bloqueada: !!sessao.bloqueada, config: cfgPublica() }));

// ── Bloqueio de tela (balcão sem ninguém por perto) ──
rota('POST', '/api/bloquear', async (req, res, { u, sessao }) => {
  const s = sessoes.get(sessao.token);
  if (s) { s.bloqueada = true; sessoes.gravar(sessao.token); }
  registrar(u.login, 'bloqueou a tela', '');
  json(res, 200, { ok: true });
});
rota('POST', '/api/desbloquear', async (req, res, { u, sessao }) => {
  const { senha } = await corpoJson(req);
  const reg = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(u.id);
  if (!conferirSenha(String(senha || ''), reg.senha_hash)) {
    registrar(u.login, 'errou a senha ao desbloquear a tela', '');
    falha(403, 'Senha incorreta'); // 403 e não 401: a sessão continua válida, só a tela está bloqueada
  }
  const s = sessoes.get(sessao.token);
  if (s) { s.bloqueada = false; sessoes.gravar(sessao.token); }
  json(res, 200, { ok: true });
});

rota('POST', '/api/trocar-senha', async (req, res, { u }) => {
  const { atual, nova } = await corpoJson(req);
  const reg = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(u.id);
  if (!conferirSenha(String(atual || ''), reg.senha_hash)) falha(400, 'Senha atual incorreta');
  const nv = String(nova || '');
  if (nv.length < 8) falha(400, 'A nova senha precisa ter pelo menos 8 caracteres');
  const fracas = ['luterano', '12345678', '123456789', 'secretaria', 'senha123', 'iel12345', 'password'];
  if (fracas.includes(nv.toLowerCase()) || nv.toLowerCase() === u.login) falha(400, 'Essa senha é fácil demais de adivinhar. Escolha outra.');
  db.prepare('UPDATE usuarios SET senha_hash = ?, trocar_senha = 0 WHERE id = ?').run(hashSenha(nova), u.id);
  registrar(u.login, 'trocou a própria senha', '');
  json(res, 200, { ok: true });
});

// Painel inicial
rota('GET', '/api/painel', async (req, res) => {
  const c = cfg(); const ano = +c.ano_matricula;
  const tot = db.prepare(`SELECT COALESCE(r.status,'pendente') st, COUNT(*) n FROM alunos a LEFT JOIN rematriculas r ON r.aluno_id = a.id AND r.ano = ?
    WHERE a.ativo = 1 AND a.novo = 0 AND COALESCE(a.serie_chave,'') <> 'EM3' GROUP BY st`).all(ano);
  const porStatus = Object.fromEntries(Object.keys(STATUS).map((k) => [k, 0]));
  tot.forEach((r) => { porStatus[r.st] = r.n; });
  const veteranos = Object.values(porStatus).reduce((s, n) => s + n, 0);
  const novos = db.prepare(`SELECT COUNT(*) n FROM alunos a JOIN rematriculas r ON r.aluno_id = a.id AND r.ano = ? WHERE a.novo = 1 AND a.ativo = 1 AND r.status IN ('reservada','concluida')`).get(ano).n;
  const pend = calcularPendencias(ano, +c.prazo_dias);
  const interessados = db.prepare(`SELECT status, COUNT(*) n FROM interessados GROUP BY status`).all();
  json(res, 200, {
    ano, porStatus, veteranos, novos,
    concluintes: db.prepare(`SELECT COUNT(*) n FROM alunos WHERE ativo = 1 AND serie_chave = 'EM3'`).get().n,
    pendencias: { total: pend.length, vencidas: pend.filter((p) => p.situacao === 'vencida').length, vencendo: pend.filter((p) => p.situacao === 'vencendo').length },
    urgentes: pend.filter((p) => p.situacao !== 'no_prazo').sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999)).slice(0, 8),
    interessados: Object.fromEntries(interessados.map((r) => [r.status, r.n])),
    total_alunos: db.prepare('SELECT COUNT(*) n FROM alunos WHERE ativo = 1').get().n,
    demo: !!db.prepare('SELECT 1 FROM alunos WHERE demo = 1 LIMIT 1').get(),
  });
});

// Lista de alunos
rota('GET', '/api/alunos', async (req, res, { url }) => {
  const ano = +cfg().ano_matricula;
  const q = S.norm(url.searchParams.get('q') || '');
  const lin = db.prepare(`SELECT a.id, a.mat, a.nome, a.serie_chave, a.turma, a.turno, a.novo, a.nome_mae, a.nome_pai, a.nome_resp, a.cpf,
      COALESCE(r.status,'pendente') status, r.serie_destino
    FROM alunos a LEFT JOIN rematriculas r ON r.aluno_id = a.id AND r.ano = ? WHERE a.ativo = 1 ORDER BY a.nome`).all(ano);
  const ordem = Object.fromEntries(S.SERIES.map((s, i) => [s.chave, i]));
  const saida = lin
    .filter((a) => !q || [a.nome, a.mat, a.nome_mae, a.nome_pai, a.nome_resp, a.cpf].some((v) => S.norm(v).includes(q)))
    .map((a) => ({ ...a, turma_rotulo: turmaRotulo(a), ordem: ordem[a.serie_chave] ?? 99, destino: (a.serie_destino ? S.porChave(a.serie_destino) : a.novo ? S.porChave(a.serie_chave) : S.proxima(a.serie_chave))?.rotulo || '' }));
  json(res, 200, saida);
});

// Ficha completa do aluno
rota('GET', '/api/alunos/:id', async (req, res, { p, u }) => {
  const c = cfg(); const ano = +c.ano_matricula;
  const a = db.prepare('SELECT * FROM alunos WHERE id = ?').get(+p.id) || falha(404, 'Aluno não encontrado');
  registrarAcesso(u.login, a.id); // LGPD: fica registrado quem abriu a ficha de quem
  const r = db.prepare('SELECT * FROM rematriculas WHERE aluno_id = ? AND ano = ?').get(a.id, ano) || { status: 'pendente' };
  const pastas = prontuario.doAluno(c.pasta_prontuario, a.nome);
  const ent = Object.fromEntries(db.prepare('SELECT * FROM entregas WHERE aluno_id = ? AND ano = ?').all(a.id, ano).map((e) => [e.doc_id, e]));
  const docs = docsAplicaveis(a).map((d) => ({
    id: d.id, nome: d.nome, obrigatorio: !!d.obrigatorio, arquivo: d.arquivo ? d.arquivo.replace('{ano}', ano) : '',
    entregue: !!ent[d.id]?.entregue, data_entrega: ent[d.id]?.data_entrega || null, obs: ent[d.id]?.obs || '',
    atualizado_por: ent[d.id]?.atualizado_por || '', pdf: prontuario.temArquivo(pastas, d.arquivo, ano),
  }));
  const destino = destinoDe(a, ano);
  const prazo = r.data_matricula ? somarDias(r.data_matricula, +c.prazo_dias) : null;
  json(res, 200, {
    aluno: { ...a, turma_rotulo: turmaRotulo(a), whatsapp: foneWhats(a) }, rematricula: { ...r, rotulo: STATUS[r.status] },
    destino, prazo, docs, pastas, opcoes_serie: [...S.SERIES, S.CONCLUINTE],
    historico: db.prepare(`SELECT quando, usuario, acao, detalhe FROM log WHERE detalhe LIKE ? ORDER BY id DESC LIMIT 15`).all(`%"aluno_id":${a.id},%`),
  });
});

const CAMPOS_EDITAVEIS = ['nome', 'nome_social', 'dt_nasc', 'cpf', 'nis', 'turma', 'turno', 'serie_chave', 'nome_mae', 'nome_pai', 'nome_resp',
  'email', 'email_mae', 'email_pai', 'telefone', 'tel_mae', 'cel_mae', 'tel_pai', 'cel_pai', 'obs', 'filho_funcionario',
  'ra', 'rg', 'endereco', 'bairro', 'cidade', 'uf', 'cep', 'cpf_resp', 'rg_resp', 'tel_resp'];

// Cadastro de aluno novo (ingresso 2027)
rota('POST', '/api/alunos', async (req, res, { u }) => {
  const b = await corpoJson(req);
  if (!String(b.nome || '').trim()) falha(400, 'Informe o nome do aluno');
  if (!S.porChave(b.serie_chave)) falha(400, 'Escolha a série que o aluno vai cursar');
  if (b.mat && db.prepare('SELECT 1 FROM alunos WHERE mat = ?').get(String(b.mat))) falha(400, 'Já existe aluno com essa matrícula');
  const reg = {};
  for (const k of CAMPOS_EDITAVEIS) if (b[k] !== undefined) reg[k] = b[k] === '' ? null : b[k];
  const s = S.porChave(b.serie_chave);
  Object.assign(reg, { descricao: s.descricao, serie: s.serie, novo: 1, atualizado_em: agoraIso(), atualizado_por: u.login, mat: b.mat ? String(b.mat) : null });
  const ks = Object.keys(reg);
  const r = db.prepare(`INSERT INTO alunos (${ks.join(', ')}) VALUES (${ks.map(() => '?').join(', ')})`).run(...ks.map((k) => reg[k]));
  const id = Number(r.lastInsertRowid);
  registrar(u.login, 'cadastrou aluno novo', { aluno_id: id, nome: reg.nome });
  json(res, 201, { id });
});

rota('PUT', '/api/alunos/:id', async (req, res, { u, p }) => {
  const b = await corpoJson(req);
  const a = db.prepare('SELECT * FROM alunos WHERE id = ?').get(+p.id) || falha(404, 'Aluno não encontrado');
  conferirVersao(a, b, u);
  const reg = {};
  for (const k of CAMPOS_EDITAVEIS) if (b[k] !== undefined) reg[k] = b[k] === '' ? null : b[k];
  if (reg.filho_funcionario !== undefined) { exigirAdmin(u); reg.filho_funcionario = reg.filho_funcionario ? 1 : 0; }
  if (reg.serie_chave) { const s = S.porChave(reg.serie_chave) || falha(400, 'Série inválida'); reg.descricao = s.descricao; reg.serie = s.serie; }
  if (!Object.keys(reg).length) return json(res, 200, { ok: true });
  reg.atualizado_em = agoraIso(); reg.atualizado_por = u.login;
  const ks = Object.keys(reg);
  db.prepare(`UPDATE alunos SET ${ks.map((k) => k + ' = ?').join(', ')} WHERE id = ?`).run(...ks.map((k) => reg[k]), a.id);
  const mud = ks.filter((k) => k !== 'atualizado_em' && k !== 'atualizado_por' && String(a[k] ?? '') !== String(reg[k] ?? ''));
  registrar(u.login, 'editou dados do aluno', { aluno_id: a.id, nome: a.nome, campos: mud });
  json(res, 200, { ok: true });
});

rota('PUT', '/api/alunos/:id/rematricula', async (req, res, { u, p }) => {
  const b = await corpoJson(req);
  const ano = +cfg().ano_matricula;
  const a = db.prepare('SELECT id, nome FROM alunos WHERE id = ?').get(+p.id) || falha(404, 'Aluno não encontrado');
  if (b.status && !STATUS[b.status]) falha(400, 'Status inválido');
  if (b.serie_destino && !S.porChave(b.serie_destino)) falha(400, 'Série inválida');
  const atual = db.prepare('SELECT * FROM rematriculas WHERE aluno_id = ? AND ano = ?').get(a.id, ano) || { status: 'pendente' };
  const novo = { ...atual, ...Object.fromEntries(['status', 'serie_destino', 'spc', 'obs'].filter((k) => b[k] !== undefined).map((k) => [k, b[k] === '' ? null : b[k]])) };
  if (STATUS_MATRICULADO.includes(novo.status) && !novo.data_matricula) novo.data_matricula = b.data_matricula || hoje();
  if (b.data_matricula) novo.data_matricula = b.data_matricula;
  if (!STATUS_MATRICULADO.includes(novo.status)) novo.data_matricula = null;
  db.prepare(`INSERT INTO rematriculas (aluno_id, ano, status, serie_destino, data_matricula, spc, obs, atualizado_em, atualizado_por)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(aluno_id, ano) DO UPDATE SET status=excluded.status, serie_destino=excluded.serie_destino,
    data_matricula=excluded.data_matricula, spc=excluded.spc, obs=excluded.obs, atualizado_em=excluded.atualizado_em, atualizado_por=excluded.atualizado_por`)
    .run(a.id, ano, novo.status, novo.serie_destino ?? null, novo.data_matricula ?? null, novo.spc ?? null, novo.obs ?? null, agoraIso(), u.login);
  if (b.status && b.status !== atual.status) registrar(u.login, `rematrícula: ${STATUS[atual.status]} → ${STATUS[b.status]}`, { aluno_id: a.id, nome: a.nome });
  json(res, 200, { ok: true });
});

rota('PUT', '/api/alunos/:id/documentos/:doc', async (req, res, { u, p }) => {
  const b = await corpoJson(req);
  const ano = +cfg().ano_matricula;
  const a = db.prepare('SELECT id, nome FROM alunos WHERE id = ?').get(+p.id) || falha(404, 'Aluno não encontrado');
  const d = db.prepare('SELECT id, nome FROM doc_tipos WHERE id = ?').get(+p.doc) || falha(404, 'Documento não encontrado');
  const entregue = b.entregue ? 1 : 0;
  db.prepare(`INSERT INTO entregas (aluno_id, doc_id, ano, entregue, data_entrega, obs, atualizado_por) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(aluno_id, doc_id, ano) DO UPDATE SET entregue=excluded.entregue, data_entrega=excluded.data_entrega, obs=COALESCE(excluded.obs, obs), atualizado_por=excluded.atualizado_por`)
    .run(a.id, d.id, ano, entregue, entregue ? (b.data_entrega || hoje()) : null, b.obs ?? null, u.login);
  registrar(u.login, `${entregue ? 'marcou entregue' : 'desmarcou'}: ${d.nome}`, { aluno_id: a.id, nome: a.nome });
  json(res, 200, { ok: true });
});

// Marca como entregues os documentos cujo PDF padronizado já está na pasta do prontuário
rota('POST', '/api/alunos/:id/documentos/pelos-pdfs', async (req, res, { u, p }) => {
  const c = cfg(); const ano = +c.ano_matricula;
  const a = db.prepare('SELECT * FROM alunos WHERE id = ?').get(+p.id) || falha(404, 'Aluno não encontrado');
  prontuario.limparCache();
  const pastas = prontuario.doAluno(c.pasta_prontuario, a.nome);
  const marcados = [];
  for (const d of docsAplicaveis(a)) {
    if (d.arquivo && d.arquivo !== 'DOCUMENTOS' && prontuario.temArquivo(pastas, d.arquivo, ano)) {
      db.prepare(`INSERT INTO entregas (aluno_id, doc_id, ano, entregue, data_entrega, atualizado_por) VALUES (?,?,?,1,?,?)
        ON CONFLICT(aluno_id, doc_id, ano) DO UPDATE SET entregue=1, data_entrega=COALESCE(data_entrega, excluded.data_entrega), atualizado_por=excluded.atualizado_por`)
        .run(a.id, d.id, ano, hoje(), u.login);
      marcados.push(d.nome);
    }
  }
  if (marcados.length) registrar(u.login, 'marcou entregues pelos PDFs do prontuário', { aluno_id: a.id, nome: a.nome, docs: marcados });
  json(res, 200, { marcados });
});

rota('GET', '/api/alunos/:id/contrato', async (req, res, { u, p }) => {
  const ano = +cfg().ano_matricula;
  const a = db.prepare('SELECT * FROM alunos WHERE id = ?').get(+p.id) || falha(404, 'Aluno não encontrado');
  if (!a.mat) falha(400, 'O aluno precisa ter número de matrícula (Mat) do ACADESC para gerar o contrato');
  const d = destinoDe(a, ano);
  if (!d || d.chave === 'CONC') falha(400, 'Aluno concluinte: não há série para 2027');
  const buf = gerarContrato(a, { ano, descricao: d.descricao, serie: d.serie });
  registrar(u.login, 'gerou contrato ' + ano, { aluno_id: a.id, nome: a.nome });
  const nomeArq = `CONTRATO EDUCACIONAL ${ano} - ${a.nome}.xlsx`;
  res.writeHead(200, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="contrato.xlsx"; filename*=UTF-8''${encodeURIComponent(nomeArq)}`,
  });
  res.end(buf);
});

// Abre a pasta do prontuário no Windows Explorer (só funciona no PC onde o app está rodando)
rota('POST', '/api/alunos/:id/abrir-pasta', async (req, res, { p }) => {
  const c = cfg();
  const a = db.prepare('SELECT nome FROM alunos WHERE id = ?').get(+p.id) || falha(404, 'Aluno não encontrado');
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if (!local) falha(400, 'Abrir pasta só funciona no computador onde o app está instalado');
  const pastas = prontuario.doAluno(c.pasta_prontuario, a.nome);
  const alvo = pastas[0]?.pasta || c.pasta_prontuario;
  execFile('explorer.exe', [alvo], () => {});
  json(res, 200, { pasta: alvo });
});

// Painel de rematrícula por série de destino
rota('GET', '/api/rematricula', async (req, res) => {
  const ano = +cfg().ano_matricula;
  const alunos = db.prepare(`SELECT a.*, COALESCE(r.status,'pendente') status, r.serie_destino, r.data_matricula FROM alunos a
    LEFT JOIN rematriculas r ON r.aluno_id = a.id AND r.ano = ? WHERE a.ativo = 1`).all(ano);
  const vagas = Object.fromEntries(db.prepare('SELECT serie_chave, capacidade FROM vagas WHERE ano = ?').all(ano).map((v) => [v.serie_chave, v.capacidade]));
  const grupos = new Map(S.SERIES.map((s) => [s.chave, { chave: s.chave, rotulo: s.rotulo, capacidade: vagas[s.chave] ?? null, ...Object.fromEntries(Object.keys(STATUS).map((k) => [k, 0])), novos: 0 }]));
  for (const a of alunos) {
    const d = a.serie_destino ? S.porChave(a.serie_destino) : a.novo ? S.porChave(a.serie_chave) : S.proxima(a.serie_chave);
    if (!d || !grupos.has(d.chave)) continue;
    const g = grupos.get(d.chave);
    g[a.status]++;
    if (a.novo && STATUS_MATRICULADO.includes(a.status)) g.novos++;
  }
  json(res, 200, { ano, status: STATUS, grupos: [...grupos.values()] });
});

rota('GET', '/api/pendencias', async (req, res) => {
  const c = cfg();
  json(res, 200, calcularPendencias(+c.ano_matricula, +c.prazo_dias));
});

// Interessados (SIG)
const CAMPOS_INT = ['data', 'tipo_contato', 'aluno', 'dt_nasc', 'responsavel', 'contato', 'endereco', 'email', 'escola_atual', 'serie_interesse', 'obs', 'ultimo_contato', 'status'];
const STATUS_INT = ['novo', 'contatado', 'visita', 'matriculado', 'desistiu'];
rota('GET', '/api/interessados', async (req, res) => json(res, 200, db.prepare('SELECT * FROM interessados ORDER BY COALESCE(ultimo_contato, data) DESC, id DESC').all()));
rota('POST', '/api/interessados', async (req, res, { u }) => {
  const b = await corpoJson(req);
  if (!String(b.aluno || '').trim()) falha(400, 'Informe o nome do aluno');
  if (b.status && !STATUS_INT.includes(b.status)) falha(400, 'Status inválido');
  const ks = CAMPOS_INT.filter((k) => b[k] !== undefined);
  const r = db.prepare(`INSERT INTO interessados (${[...ks, 'criado_por'].join(', ')}) VALUES (${[...ks, 'x'].map(() => '?').join(', ')})`)
    .run(...ks.map((k) => (b[k] === '' ? null : b[k])), u.login);
  if (!b.data) db.prepare('UPDATE interessados SET data = ? WHERE id = ?').run(hoje(), r.lastInsertRowid);
  registrar(u.login, 'cadastrou interessado', { nome: b.aluno });
  json(res, 201, { id: Number(r.lastInsertRowid) });
});
rota('PUT', '/api/interessados/:id', async (req, res, { u, p }) => {
  const b = await corpoJson(req);
  if (b.status && !STATUS_INT.includes(b.status)) falha(400, 'Status inválido');
  const atual = db.prepare('SELECT * FROM interessados WHERE id = ?').get(+p.id) || falha(404, 'Contato não encontrado');
  conferirVersao(atual, b, u);
  const ks = CAMPOS_INT.filter((k) => b[k] !== undefined);
  if (!ks.length) return json(res, 200, { ok: true });
  db.prepare(`UPDATE interessados SET ${ks.map((k) => k + ' = ?').join(', ')}, atualizado_em = ?, atualizado_por = ? WHERE id = ?`)
    .run(...ks.map((k) => (b[k] === '' ? null : b[k])), agoraIso(), u.login, +p.id);
  registrar(u.login, 'atualizou interessado', { id: +p.id, campos: ks });
  json(res, 200, { ok: true });
});
rota('DELETE', '/api/interessados/:id', async (req, res, { u, p }) => {
  const i = db.prepare('SELECT aluno FROM interessados WHERE id = ?').get(+p.id) || falha(404, 'Contato não encontrado');
  const lixeira_id = L.excluir({ tipo: 'interessado', rotulo: i.aluno, usuario: u.login, tabela: 'interessados', onde: 'id = ?', params: [+p.id] });
  registrar(u.login, 'excluiu interessado (foi para a lixeira)', { id: +p.id });
  json(res, 200, { ok: true, lixeira_id });
});
rota('POST', '/api/interessados/importar', async (req, res, { u, url }) => {
  const buf = await lerCorpo(req);
  json(res, 200, importarInteressados(lerPlanilha(buf, url.searchParams.get('arquivo') || 'x.xlsx'), u.login));
});

// Modelos de mensagem
rota('GET', '/api/modelos', async (req, res) => json(res, 200, db.prepare('SELECT * FROM modelos ORDER BY ordem, id').all()));
rota('POST', '/api/modelos', async (req, res, { u }) => {
  const b = await corpoJson(req);
  if (!b.titulo || !b.texto) falha(400, 'Preencha título e texto');
  const r = db.prepare('INSERT INTO modelos (titulo, texto, ordem) VALUES (?, ?, 99)').run(b.titulo, b.texto);
  registrar(u.login, 'criou modelo de mensagem', b.titulo);
  json(res, 201, { id: Number(r.lastInsertRowid) });
});
rota('PUT', '/api/modelos/:id', async (req, res, { u, p }) => {
  const b = await corpoJson(req);
  db.prepare('UPDATE modelos SET titulo = COALESCE(?, titulo), texto = COALESCE(?, texto) WHERE id = ?').run(b.titulo ?? null, b.texto ?? null, +p.id);
  registrar(u.login, 'editou modelo de mensagem', b.titulo || p.id);
  json(res, 200, { ok: true });
});
rota('DELETE', '/api/modelos/:id', async (req, res, { u, p }) => {
  const m = db.prepare('SELECT titulo FROM modelos WHERE id = ?').get(+p.id) || falha(404, 'Modelo não encontrado');
  const lixeira_id = L.excluir({ tipo: 'modelo', rotulo: m.titulo, usuario: u.login, tabela: 'modelos', onde: 'id = ?', params: [+p.id] });
  registrar(u.login, 'excluiu modelo de mensagem (foi para a lixeira)', m.titulo);
  json(res, 200, { ok: true, lixeira_id });
});

// ── Administração ──
rota('GET', '/api/admin', async (req, res, { u }) => {
  exigirAdmin(u);
  const ano = +cfg().ano_matricula;
  const vagas = Object.fromEntries(db.prepare('SELECT serie_chave, capacidade FROM vagas WHERE ano = ?').all(ano).map((v) => [v.serie_chave, v.capacidade]));
  json(res, 200, {
    config: cfgPublica(),
    usuarios: db.prepare('SELECT id, login, nome, perfil, trocar_senha, ativo FROM usuarios ORDER BY nome').all(),
    documentos: db.prepare('SELECT * FROM doc_tipos ORDER BY ordem, id').all(),
    vagas: S.SERIES.map((s) => ({ chave: s.chave, rotulo: s.rotulo, capacidade: vagas[s.chave] ?? null })),
  });
});
rota('PUT', '/api/admin/config', async (req, res, { u }) => {
  exigirAdmin(u);
  const b = await corpoJson(req);
  const permitidas = ['ano_matricula', 'prazo_dias', 'data_inicio', 'data_desconto', 'data_garantia_vaga', 'data_fim', 'pasta_prontuario', 'pastas_fotos', 'inep',
    'horario_infantil', 'horario_fund1', 'horario_fund2', 'horario_medio', 'extras_dia_venc', 'extras_ultimo_mes', 'olimpiada_titulo', 'olimpiada_validade',
    'cebas_ano', 'cebas_retirada', 'cebas_entrega_ini', 'cebas_entrega_fim', 'cebas_resultado', 'cebas_prestacao',
    'desconto_funcionario', 'boletos_dia_venc', 'boletos_mes_massa', 'fotos_sistemas', 'saida_aviso_telefone',
    'backup_pasta', 'backup_horas', 'backup_manter', 'backup_avisar_dias', 'bloqueio_minutos', 'lgpd_anos_descarte', 'lixeira_dias'];
  for (const k of permitidas) if (b[k] !== undefined) db.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').run(k, String(b[k]));
  prontuario.limparCache();
  registrar(u.login, 'alterou configurações', b);
  json(res, 200, { ok: true });
});
rota('PUT', '/api/admin/vagas', async (req, res, { u }) => {
  exigirAdmin(u);
  const b = await corpoJson(req); const ano = +cfg().ano_matricula;
  transacao(() => {
    for (const [chave, cap] of Object.entries(b)) {
      if (!S.porChave(chave)) continue;
      db.prepare('INSERT INTO vagas (serie_chave, ano, capacidade) VALUES (?, ?, ?) ON CONFLICT(serie_chave, ano) DO UPDATE SET capacidade = excluded.capacidade')
        .run(chave, ano, cap === '' || cap == null ? null : Number(cap));
    }
  });
  registrar(u.login, 'alterou vagas por série', b);
  json(res, 200, { ok: true });
});
rota('POST', '/api/admin/documentos', async (req, res, { u }) => {
  exigirAdmin(u);
  const b = await corpoJson(req);
  if (!b.nome) falha(400, 'Informe o nome do documento');
  db.prepare('INSERT INTO doc_tipos (nome, arquivo, obrigatorio, aplica, ordem) VALUES (?, ?, ?, ?, 99)').run(b.nome, b.arquivo || '', b.obrigatorio ? 1 : 0, b.aplica === 'novos' ? 'novos' : 'todos');
  registrar(u.login, 'criou tipo de documento', b.nome);
  json(res, 201, { ok: true });
});
rota('PUT', '/api/admin/documentos/:id', async (req, res, { u, p }) => {
  exigirAdmin(u);
  const b = await corpoJson(req);
  db.prepare(`UPDATE doc_tipos SET nome = COALESCE(?, nome), arquivo = COALESCE(?, arquivo), obrigatorio = COALESCE(?, obrigatorio),
    aplica = COALESCE(?, aplica), ativo = COALESCE(?, ativo), ordem = COALESCE(?, ordem) WHERE id = ?`)
    .run(b.nome ?? null, b.arquivo ?? null, b.obrigatorio == null ? null : b.obrigatorio ? 1 : 0,
      b.aplica == null ? null : b.aplica === 'novos' ? 'novos' : 'todos', b.ativo == null ? null : b.ativo ? 1 : 0, b.ordem ?? null, +p.id);
  registrar(u.login, 'alterou tipo de documento', { id: +p.id, ...b });
  json(res, 200, { ok: true });
});
rota('POST', '/api/admin/usuarios', async (req, res, { u }) => {
  exigirAdmin(u);
  const b = await corpoJson(req);
  const login = String(b.login || '').toLowerCase().trim();
  if (!/^[a-z0-9._]{3,}$/.test(login)) falha(400, 'Login inválido (mín. 3 letras/números, sem espaço)');
  if (!b.nome) falha(400, 'Informe o nome');
  if (db.prepare('SELECT 1 FROM usuarios WHERE login = ?').get(login)) falha(400, 'Esse login já existe');
  db.prepare('INSERT INTO usuarios (login, nome, perfil, senha_hash) VALUES (?, ?, ?, ?)').run(login, b.nome, b.perfil === 'admin' ? 'admin' : 'aprendiz', hashSenha('luterano'));
  registrar(u.login, 'criou usuário', login);
  json(res, 201, { ok: true, senha_inicial: 'luterano' });
});
rota('PUT', '/api/admin/usuarios/:id', async (req, res, { u, p }) => {
  exigirAdmin(u);
  const b = await corpoJson(req);
  const alvo = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(+p.id) || falha(404, 'Usuário não encontrado');
  if (alvo.id === u.id && (b.ativo === false || b.perfil === 'aprendiz')) falha(400, 'Você não pode desativar ou rebaixar a si mesmo');
  if (b.resetar_senha) {
    db.prepare('UPDATE usuarios SET senha_hash = ?, trocar_senha = 1 WHERE id = ?').run(hashSenha('luterano'), alvo.id);
    // Senha redefinida: quem estava logado com a senha antiga sai
    db.prepare('DELETE FROM sessoes WHERE uid = ?').run(alvo.id);
    for (const [tok, s] of sessoes.mem) if (s.uid === alvo.id) sessoes.mem.delete(tok);
  }
  if (b.perfil) db.prepare('UPDATE usuarios SET perfil = ? WHERE id = ?').run(b.perfil === 'admin' ? 'admin' : 'aprendiz', alvo.id);
  if (b.ativo != null) db.prepare('UPDATE usuarios SET ativo = ? WHERE id = ?').run(b.ativo ? 1 : 0, alvo.id);
  if (b.nome) db.prepare('UPDATE usuarios SET nome = ? WHERE id = ?').run(b.nome, alvo.id);
  registrar(u.login, 'alterou usuário', { login: alvo.login, ...b });
  json(res, 200, { ok: true });
});
rota('POST', '/api/admin/importar-alunos', async (req, res, { u, url }) => {
  exigirAdmin(u);
  const buf = await lerCorpo(req);
  json(res, 200, importarAlunos(lerPlanilha(buf, url.searchParams.get('arquivo') || 'x.xlsx'), u.login));
});
rota('POST', '/api/admin/demo', async (req, res, { u, url }) => {
  exigirAdmin(u);
  if (db.prepare('SELECT 1 FROM alunos WHERE demo = 0 LIMIT 1').get()) falha(400, 'Já existem alunos reais cadastrados; a demonstração não pode ser misturada a eles.');
  const n = gerarDemo(db, +cfg().ano_matricula, transacao, { real: url.searchParams.get('tamanho') === 'real' });
  gerarDemoEtapa2(db, +cfg().cebas_ano, transacao);
  gerarDemoEtapa3(db, +cfg().ano_matricula, transacao);
  registrar(u.login, 'carregou dados de demonstração', { alunos: n });
  json(res, 200, { alunos: n });
});
rota('DELETE', '/api/admin/demo', async (req, res, { u }) => {
  exigirAdmin(u);
  transacao(() => {
    db.prepare('DELETE FROM bolsas WHERE demo = 1').run();
    db.prepare('DELETE FROM alunos WHERE demo = 1').run();
    db.prepare('DELETE FROM interessados WHERE demo = 1').run();
    db.prepare("DELETE FROM eventos WHERE obs = 'DEMO'").run();
    // Etapa 3 (o que depende de aluno some junto com ele; o resto tem marca de demonstração)
    db.prepare('DELETE FROM remessas WHERE demo = 1').run();
    db.prepare('DELETE FROM atendimentos WHERE demo = 1').run();
    db.prepare('DELETE FROM tarefas_dia WHERE demo = 1').run();
    db.prepare("DELETE FROM rotina_feito WHERE usuario = 'demo'").run();
    db.prepare("DELETE FROM calendario_feito WHERE usuario = 'demo'").run();
    db.prepare('DELETE FROM lixeira WHERE demo = 1').run();
  });
  registrar(u.login, 'apagou dados de demonstração', '');
  json(res, 200, { ok: true });
});
rota('GET', '/api/admin/log', async (req, res, { u }) => {
  exigirAdmin(u);
  json(res, 200, db.prepare('SELECT * FROM log ORDER BY id DESC LIMIT 300').all());
});

// ── Etapa 2: documentos, atividades extras e bolsas ──
const ctx = { rota, db, cfg, cfgPublica, registrar, transacao, falha, conferirVersao, json, corpoJson, lerCorpo, exigirAdmin, hoje, somarDias, agoraIso, S, turmaRotulo, foneWhats, destinoDe, lerPlanilha, serialParaIso, PASTA_DADOS, sessoes, L };
require('./rotas/documentos')(ctx);
require('./rotas/extras')(ctx);
require('./rotas/cebas')(ctx);
require('./rotas/boletos')(ctx);
require('./rotas/fotos')(ctx);
require('./rotas/saida')(ctx);
require('./rotas/rotina')(ctx);
require('./rotas/backup')(ctx);
require('./rotas/lgpd')(ctx);
require('./rotas/relatorios')(ctx);
require('./rotas/atualizacao')(ctx);
require('./rotas/lixeira')(ctx);
require('./rotas/busca')(ctx);

// Quem carregou a demonstração antes da Etapa 2 ganha também inscrições, eventos e bolsas fictícias
if (db.prepare('SELECT 1 FROM alunos WHERE demo = 1 LIMIT 1').get() && !db.prepare('SELECT 1 FROM inscricoes LIMIT 1').get() && !db.prepare('SELECT 1 FROM bolsas LIMIT 1').get()) {
  gerarDemoEtapa2(db, +cfg().cebas_ano, transacao);
  registrar('sistema', 'completou a demonstração com atividades extras e bolsas', '');
}
// O mesmo para quem já tinha a demonstração antes da Etapa 3
if (db.prepare('SELECT 1 FROM alunos WHERE demo = 1 LIMIT 1').get() && !db.prepare('SELECT 1 FROM atendimentos LIMIT 1').get()
  && !db.prepare('SELECT 1 FROM saida_autorizados LIMIT 1').get()) {
  gerarDemoEtapa3(db, +cfg().ano_matricula, transacao);
  registrar('sistema', 'completou a demonstração com boletos, fotos, saída e atendimentos', '');
}

// ───────────────────────── servidor ─────────────────────────
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // O app não carrega nada de fora: trancar isso evita que um script estranho consiga rodar aqui dentro
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
    "script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  if (!url.pathname.startsWith('/api/')) return servirEstatico(req, res, url);
  try {
    // Pedidos que alteram dados precisam vir do próprio app (cabeçalho customizado bloqueia CSRF)
    if (req.method !== 'GET' && req.headers['x-iel'] !== '1') falha(403, 'Requisição bloqueada');
    for (const r of rotas) {
      if (r.metodo !== req.method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      const p = Object.fromEntries(r.chaves.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      if (r.publica) return await r.fn(req, res, { url, p });
      const sessao = sessaoDe(req);
      if (!sessao) falha(401, 'Faça login novamente');
      const u = sessao.usuario;
      if (u.trocar_senha && !['/api/trocar-senha', '/api/eu', '/api/logout'].includes(url.pathname)) falha(428, 'Troque sua senha antes de continuar');
      // Tela bloqueada: nada passa até digitar a senha de novo
      if (sessao.bloqueada && !['/api/desbloquear', '/api/eu', '/api/logout'].includes(url.pathname)) falha(423, 'Tela bloqueada');
      return await r.fn(req, res, { url, p, u, sessao });
    }
    falha(404, 'Rota não encontrada');
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(new Date().toISOString(), req.method, url.pathname, e);
    if (!res.headersSent) json(res, status, { erro: status === 500 ? 'Erro interno: ' + e.message : e.message, ...(e.extra || {}) });
  }
});

// ───────────────────────── cópias de segurança automáticas ─────────────────────────
function copiaAutomatica(motivo) {
  try {
    const r = copias.fazerBackup(db, cfg(), PASTA_DADOS, motivo);
    console.log(`  Cópia de segurança gravada: ${r.arquivo}${r.cifrado ? ' (cifrada)' : ''}`);
    registrar('sistema', 'cópia de segurança automática', { arquivo: r.arquivo, cifrado: r.cifrado });
  } catch (e) {
    console.error('  ATENÇÃO: não consegui gravar a cópia de segurança —', e.message);
    registrar('sistema', 'FALHA na cópia de segurança', e.message);
  }
}
if (restauracao) {
  if (restauracao.erro) { console.error('  A restauração do backup falhou:', restauracao.erro); registrar('sistema', 'FALHA ao restaurar backup', restauracao); }
  else { console.log('  Backup restaurado:', restauracao.restaurado); registrar('sistema', 'backup restaurado', restauracao.restaurado); }
}
if (copias.naHora(cfg(), PASTA_DADOS)) copiaAutomatica('inicio');
setInterval(() => { if (copias.naHora(cfg(), PASTA_DADOS)) copiaAutomatica('automatico'); }, 30 * 60 * 1000);

servidor.listen(PORTA, HOST, () => {
  console.log('');
  console.log('  Secretaria IEL rodando!');
  console.log(`  Abra no navegador:  http://localhost:${PORTA}`);
  if (HOST === '0.0.0.0') console.log('  (liberado para os outros PCs da rede)');
  console.log('  Não feche esta janela enquanto estiver usando o sistema.');
  console.log('');
});
