// Banco de dados SQLite (embutido no Node) e estrutura inicial.
'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PASTA_DADOS = process.env.IEL_DADOS || path.join(__dirname, '..', '..', 'dados');
fs.mkdirSync(PASTA_DADOS, { recursive: true });
const db = new DatabaseSync(path.join(PASTA_DADOS, 'secretaria.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY, login TEXT UNIQUE NOT NULL, nome TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('admin','aprendiz')),
  senha_hash TEXT NOT NULL, trocar_senha INTEGER NOT NULL DEFAULT 1, ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE IF NOT EXISTS alunos (
  id INTEGER PRIMARY KEY, mat TEXT UNIQUE, nome TEXT NOT NULL, nome_social TEXT, dt_nasc TEXT,
  cpf TEXT, nis TEXT, descricao TEXT, serie TEXT, turma TEXT, turno TEXT, serie_chave TEXT, ano_letivo INTEGER,
  filho_funcionario INTEGER DEFAULT 0, nome_mae TEXT, nome_pai TEXT, nome_resp TEXT,
  email TEXT, email_mae TEXT, email_pai TEXT, telefone TEXT, tel_mae TEXT, cel_mae TEXT, tel_pai TEXT, cel_pai TEXT,
  novo INTEGER NOT NULL DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1, demo INTEGER NOT NULL DEFAULT 0,
  obs TEXT, atualizado_em TEXT
);
CREATE TABLE IF NOT EXISTS rematriculas (
  aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE, ano INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente', serie_destino TEXT, data_matricula TEXT, spc TEXT, obs TEXT,
  atualizado_em TEXT, atualizado_por TEXT, PRIMARY KEY (aluno_id, ano)
);
CREATE TABLE IF NOT EXISTS doc_tipos (
  id INTEGER PRIMARY KEY, nome TEXT NOT NULL, arquivo TEXT, obrigatorio INTEGER NOT NULL DEFAULT 1,
  aplica TEXT NOT NULL DEFAULT 'todos' CHECK (aplica IN ('todos','novos')), ordem INTEGER DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS entregas (
  aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE, doc_id INTEGER NOT NULL REFERENCES doc_tipos(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL, entregue INTEGER NOT NULL DEFAULT 0, data_entrega TEXT, obs TEXT, atualizado_por TEXT,
  PRIMARY KEY (aluno_id, doc_id, ano)
);
CREATE TABLE IF NOT EXISTS vagas (serie_chave TEXT NOT NULL, ano INTEGER NOT NULL, capacidade INTEGER, PRIMARY KEY (serie_chave, ano));
CREATE TABLE IF NOT EXISTS interessados (
  id INTEGER PRIMARY KEY, data TEXT, tipo_contato TEXT, aluno TEXT NOT NULL, dt_nasc TEXT, responsavel TEXT, contato TEXT,
  endereco TEXT, email TEXT, escola_atual TEXT, serie_interesse TEXT, obs TEXT, ultimo_contato TEXT,
  status TEXT NOT NULL DEFAULT 'novo', demo INTEGER NOT NULL DEFAULT 0, criado_por TEXT
);
CREATE TABLE IF NOT EXISTS modelos (id INTEGER PRIMARY KEY, titulo TEXT NOT NULL, texto TEXT NOT NULL, ordem INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY, quando TEXT NOT NULL, usuario TEXT, acao TEXT, detalhe TEXT);
CREATE TABLE IF NOT EXISTS emissoes (
  id INTEGER PRIMARY KEY, quando TEXT NOT NULL, usuario TEXT, tipo TEXT NOT NULL, aluno_id INTEGER, descricao TEXT
);
CREATE TABLE IF NOT EXISTS atividades (
  id INTEGER PRIMARY KEY, nome TEXT NOT NULL, publico TEXT, dias TEXT, horario TEXT, valor REAL, professor TEXT,
  vagas INTEGER, ativo INTEGER NOT NULL DEFAULT 1, ordem INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS inscricoes (
  id INTEGER PRIMARY KEY, aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  atividade_id INTEGER NOT NULL REFERENCES atividades(id), ano INTEGER NOT NULL, data_inscricao TEXT NOT NULL,
  parcelas INTEGER, valor_parcela REAL, primeiro_venc TEXT, desconto_folha INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','cancelada')), data_cancelamento TEXT, motivo TEXT,
  obs TEXT, criado_por TEXT, demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS eventos (id INTEGER PRIMARY KEY, nome TEXT NOT NULL, data TEXT, limite_por_aluno INTEGER, obs TEXT);
CREATE TABLE IF NOT EXISTS ingressos (
  evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE, aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 0, retirado_em TEXT, retirado_por TEXT, obs TEXT, PRIMARY KEY (evento_id, aluno_id)
);
CREATE TABLE IF NOT EXISTS funcionarios (id INTEGER PRIMARY KEY, nome TEXT NOT NULL, cargo TEXT, ativo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS feriados (data TEXT PRIMARY KEY, nome TEXT);
CREATE TABLE IF NOT EXISTS bolsas (
  id INTEGER PRIMARY KEY, ano INTEGER NOT NULL, tipo TEXT NOT NULL DEFAULT 'renovacao' CHECK (tipo IN ('renovacao','novo')),
  aluno_id INTEGER REFERENCES alunos(id) ON DELETE SET NULL, nome_aluno TEXT NOT NULL, serie TEXT, responsavel TEXT, telefone TEXT,
  endereco TEXT, escola_origem TEXT, req_enviado TEXT, req_entregue TEXT, visitas TEXT, percentual_atual REAL, per_capita REAL,
  ofertado REAL, aprovado REAL, contrato_assinado INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'inscrito',
  checklist TEXT, obs TEXT, atualizado_em TEXT, atualizado_por TEXT, demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_alunos_nome ON alunos(nome);
CREATE INDEX IF NOT EXISTS ix_log_quando ON log(quando);
`);

// Colunas novas (Etapa 2) em bancos já existentes
const colunasAluno = new Set(db.prepare('PRAGMA table_info(alunos)').all().map((c) => c.name));
for (const c of ['ra', 'rg', 'endereco', 'bairro', 'cidade', 'uf', 'cep', 'cpf_resp', 'rg_resp', 'tel_resp']) {
  if (!colunasAluno.has(c)) db.exec(`ALTER TABLE alunos ADD COLUMN ${c} TEXT`);
}

function hashSenha(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  return sal + ':' + crypto.scryptSync(senha, sal, 32).toString('hex');
}
function conferirSenha(senha, guardado) {
  const [sal, h] = String(guardado).split(':');
  const calc = crypto.scryptSync(senha, sal, 32);
  return crypto.timingSafeEqual(calc, Buffer.from(h, 'hex'));
}

const cfgPadrao = {
  ano_matricula: '2027',
  prazo_dias: '30',
  data_inicio: '2026-09-24',
  data_desconto: '2026-11-07',
  data_garantia_vaga: '2026-12-04',
  data_fim: '2027-01-22',
  pasta_prontuario: 'C:\\Users\\Desktop\\Desktop\\Contratos',
  // Etapa 2
  pastas_fotos: 'C:\\Users\\Desktop\\Desktop\\fotos alunos;C:\\Users\\Desktop\\Desktop\\FOTOS - ALUNOS;C:\\Users\\Desktop\\Desktop\\ACADESC',
  inep: '126640',
  horario_infantil: 'das 13h às 17h30',
  horario_fund1: 'das 13h30 às 18h',
  horario_fund2: 'das 07h às 12h35',
  horario_medio: 'das 07h às 13h20',
  extras_dia_venc: '10',
  extras_ultimo_mes: '11',
  olimpiada_titulo: 'XXI OLIMPÍADA ESTUDANTIL - FV',
  olimpiada_validade: '2026-09-26',
  cebas_ano: '2027',
  cebas_retirada: '2026-06-03',
  cebas_entrega_ini: '2026-07-01',
  cebas_entrega_fim: '2026-07-15',
  cebas_resultado: '2026-08-28',
  cebas_prestacao: '2027-04-30',
};

function inicializar() {
  if (!db.prepare('SELECT 1 FROM usuarios LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO usuarios (login, nome, perfil, senha_hash) VALUES (?, ?, ?, ?)');
    ins.run('samara', 'Samara', 'admin', hashSenha('luterano'));
    ins.run('duda', 'Maria Eduarda', 'aprendiz', hashSenha('luterano'));
    ins.run('kevin', 'Kevin', 'admin', hashSenha('luterano'));
  }
  const insCfg = db.prepare('INSERT OR IGNORE INTO config (chave, valor) VALUES (?, ?)');
  for (const [k, v] of Object.entries(cfgPadrao)) insCfg.run(k, v);

  if (!db.prepare('SELECT 1 FROM doc_tipos LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO doc_tipos (nome, arquivo, obrigatorio, aplica, ordem) VALUES (?, ?, ?, ?, ?)');
    [
      ['Contrato de prestação de serviços (assinado)', 'CONTRATO EDUCACIONAL {ano}', 1, 'todos'],
      ['Formulário de matrícula', 'FORMULARIO DE MATRICULA {ano}', 1, 'todos'],
      ['Ficha de saúde', 'FICHA MEDICA ESCOLAR {ano}', 1, 'todos'],
      ['Carteira / atestado de vacinação', 'DOCUMENTOS', 1, 'todos'],
      ['RG e CPF do aluno', 'DOCUMENTOS', 1, 'todos'],
      ['Certidão de nascimento', 'DOCUMENTOS', 1, 'todos'],
      ['Comprovante de residência atualizado', 'DOCUMENTOS', 1, 'todos'],
      ['Histórico escolar', 'DOCUMENTOS', 1, 'novos'],
      ['Capa financeiro', 'CAPA FINANCEIRO {ano}', 0, 'todos'],
      ['Atestado de inaptidão para Ed. Física', '', 0, 'todos'],
    ].forEach((d, i) => ins.run(d[0], d[1], d[2], d[3], i + 1));
  }

  // Atividades extras de 2026 (planilha "Contrato Atividade Extra 2026", aba Planilha2) — editáveis em Atividades
  if (!db.prepare('SELECT 1 FROM atividades LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO atividades (nome, publico, dias, horario, valor, professor, ordem) VALUES (?,?,?,?,?,?,?)');
    [
      ['Futsal', 'Todas', 'Terças e quintas', '18h às 19h40', 110, 'Fabiano'],
      ['Judô Baby', 'Educação Infantil', 'Terças-feiras', '11h às 12h', 60, 'Fabiano'],
      ['Judô Infantil', '1º ao 5º ano', 'Terças-feiras', '9h30 às 11h', 110, 'Fabiano'],
      ['Ballet Baby Class', 'Educação Infantil', 'Sextas-feiras', '11h às 12h', 60, 'Kaylane'],
      ['Ballet Infantil', '1º ao 3º ano', 'Segundas e quintas', '18h às 19h', 110, 'Larissa'],
      ['Ballet Infanto Juvenil', '4º e 5º ano', 'Terças-feiras', '18h às 20h', 110, 'Larissa'],
      ['Ballet Juvenil', '6º ao 9º ano', 'Terças e quintas', '12h30 às 13h30', 110, 'Kaylane'],
      ['Ballet Juvenil Preparatório', '7º ano ao Ensino Médio', 'Quartas-feiras', '18h às 19h', 110, 'Larissa'],
      ['Recreação', 'Educação Infantil e Fund. I', '', '', null, ''],
    ].forEach((a, i) => ins.run(...a, i + 1));
  }
  if (!db.prepare('SELECT 1 FROM funcionarios LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO funcionarios (nome) VALUES (?)');
    ['ANDÉ LUIZ PEREIRA TORRES', 'CLARA DE SOUZA NOGUEIRA', 'FERNANDA CASTILHO RODRIGUES BARDUCHI', 'GISLAINE MENDES FEITOSA',
      'LUDMILA AMELIA ALVES DA SILVA', 'MAYARA DE OLIVEIRA SOARES', 'SANDRA REGINA RODRIGUES LEMOS'].forEach((n) => ins.run(n));
  }
  if (!db.prepare('SELECT 1 FROM feriados LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO feriados (data, nome) VALUES (?, ?)');
    [
      ['2026-01-01', 'Confraternização Universal'], ['2026-02-16', 'Carnaval'], ['2026-02-17', 'Carnaval'], ['2026-04-03', 'Sexta-feira Santa'],
      ['2026-04-21', 'Tiradentes'], ['2026-05-01', 'Dia do Trabalho'], ['2026-06-04', 'Corpus Christi'], ['2026-07-09', 'Revolução Constitucionalista (SP)'],
      ['2026-09-07', 'Independência'], ['2026-10-12', 'Nossa Senhora Aparecida'], ['2026-11-02', 'Finados'], ['2026-11-15', 'Proclamação da República'],
      ['2026-11-20', 'Consciência Negra'], ['2026-12-25', 'Natal'],
      ['2027-01-01', 'Confraternização Universal'], ['2027-02-08', 'Carnaval'], ['2027-02-09', 'Carnaval'], ['2027-03-26', 'Sexta-feira Santa'],
      ['2027-04-21', 'Tiradentes'], ['2027-05-01', 'Dia do Trabalho'], ['2027-05-27', 'Corpus Christi'], ['2027-07-09', 'Revolução Constitucionalista (SP)'],
      ['2027-09-07', 'Independência'], ['2027-10-12', 'Nossa Senhora Aparecida'], ['2027-11-02', 'Finados'], ['2027-11-15', 'Proclamação da República'],
      ['2027-11-20', 'Consciência Negra'], ['2027-12-25', 'Natal'],
    ].forEach((f) => ins.run(...f));
  }

  if (!db.prepare('SELECT 1 FROM modelos LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO modelos (titulo, texto, ordem) VALUES (?, ?, ?)');
    ins.run('Cobrança de documentos faltantes',
      'Olá, {responsavel}! Verificamos aqui no sistema que ainda constam pendências na documentação do(a) aluno(a) {aluno} ({serie}).\n\n📄 Documentos em falta: {documentos}\n📅 Prazo para entrega: até {prazo}.\n\nVocê pode trazer os documentos físicos à secretaria ou enviá-los digitalizados por este WhatsApp. A regularização é fundamental para a emissão de históricos e certidões. Contamos com sua colaboração!\n\n🏛️ Instituto Educacional Luterano - Secretaria', 1);
    ins.run('Lembrete de rematrícula 2027',
      'Olá, {responsavel}! O período de rematrícula 2027 do Instituto Educacional Luterano está aberto até 22/01/2027.\n\n✅ Valores com desconto para rematrículas até 07/11/2026.\n⚠️ A garantia de vaga para alunos da escola vai até 04/12/2026.\n\nPara rematricular {aluno} no {serie_destino}, procure a secretaria (seg. a sex., 8h às 17h) ou responda esta mensagem.\n\n🏛️ Instituto Educacional Luterano - Secretaria', 2);
    ins.run('Rematrícula concluída',
      'Olá, {responsavel}! A rematrícula de {aluno} para o {serie_destino} em 2027 foi concluída com sucesso. 🎉\nA sua via do contrato será enviada por e-mail após a assinatura do colégio.\n\n🏛️ Instituto Educacional Luterano - Secretaria', 3);
  }
}

function cfg() {
  const o = {};
  for (const r of db.prepare('SELECT chave, valor FROM config').all()) o[r.chave] = r.valor;
  return o;
}

function registrar(usuario, acao, detalhe) {
  db.prepare('INSERT INTO log (quando, usuario, acao, detalhe) VALUES (?, ?, ?, ?)')
    .run(new Date().toISOString(), usuario, acao, typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe));
}

function transacao(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

module.exports = { db, inicializar, cfg, registrar, transacao, hashSenha, conferirSenha, PASTA_DADOS };
