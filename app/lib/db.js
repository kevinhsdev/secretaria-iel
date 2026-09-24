// Banco de dados SQLite (embutido no Node) e estrutura inicial.
'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PASTA_DADOS = process.env.IEL_DADOS || path.join(__dirname, '..', '..', 'dados');
fs.mkdirSync(PASTA_DADOS, { recursive: true });

// Se alguém pediu para restaurar um backup, a troca do arquivo acontece agora, antes de abrir o banco.
const backup = require('./backup');
const restauracao = backup.aplicarPendente(PASTA_DADOS);

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
-- ── Etapa 3 ──
-- Conferência de descontos antes da massa de boletos (POP 5.3)
CREATE TABLE IF NOT EXISTS boletos_conf (
  aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE, ano INTEGER NOT NULL,
  conferido INTEGER NOT NULL DEFAULT 0, desconto_acadesc REAL, lancado INTEGER NOT NULL DEFAULT 0,
  obs TEXT, atualizado_em TEXT, atualizado_por TEXT, PRIMARY KEY (aluno_id, ano)
);
-- Protocolo de entrega dos boletos físicos
CREATE TABLE IF NOT EXISTS remessas (
  id INTEGER PRIMARY KEY, nome TEXT NOT NULL, ano INTEGER NOT NULL, referencia TEXT,
  criado_em TEXT, criado_por TEXT, obs TEXT, demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS remessa_entregas (
  remessa_id INTEGER NOT NULL REFERENCES remessas(id) ON DELETE CASCADE,
  aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  entregue_em TEXT, recebido_por TEXT, canal TEXT, obs TEXT, usuario TEXT, PRIMARY KEY (remessa_id, aluno_id)
);
-- Mutirão de fotos: em quais dos 3 sistemas a foto já entrou
CREATE TABLE IF NOT EXISTS fotos_status (
  aluno_id INTEGER PRIMARY KEY REFERENCES alunos(id) ON DELETE CASCADE, tirada INTEGER NOT NULL DEFAULT 0, data_foto TEXT,
  acadesc INTEGER NOT NULL DEFAULT 0, sed INTEGER NOT NULL DEFAULT 0, lanche INTEGER NOT NULL DEFAULT 0,
  obs TEXT, atualizado_em TEXT, atualizado_por TEXT
);
-- Autorização de saída
CREATE TABLE IF NOT EXISTS saida_config (
  aluno_id INTEGER PRIMARY KEY REFERENCES alunos(id) ON DELETE CASCADE, sai_sozinho INTEGER NOT NULL DEFAULT 0,
  termo_em TEXT, transporte TEXT, obs TEXT, atualizado_em TEXT, atualizado_por TEXT
);
CREATE TABLE IF NOT EXISTS saida_autorizados (
  id INTEGER PRIMARY KEY, aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE, nome TEXT NOT NULL,
  parentesco TEXT, documento TEXT, telefone TEXT, ativo INTEGER NOT NULL DEFAULT 1, obs TEXT, criado_em TEXT, criado_por TEXT
);
CREATE TABLE IF NOT EXISTS saida_avisos (
  id INTEGER PRIMARY KEY, aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE, data TEXT NOT NULL,
  quem TEXT NOT NULL, parentesco TEXT, documento TEXT, canal TEXT, quem_avisou TEXT, horario TEXT, obs TEXT,
  conferido_em TEXT, conferido_por TEXT, criado_em TEXT, criado_por TEXT
);
-- Tarefas do dia (cronograma fixo + tarefas avulsas)
CREATE TABLE IF NOT EXISTS rotina_tarefas (
  id INTEGER PRIMARY KEY, titulo TEXT NOT NULL, detalhe TEXT, responsavel TEXT NOT NULL DEFAULT 'todos',
  dias TEXT, periodo TEXT, ordem INTEGER DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS rotina_feito (
  tarefa_id INTEGER NOT NULL REFERENCES rotina_tarefas(id) ON DELETE CASCADE, data TEXT NOT NULL,
  feito INTEGER NOT NULL DEFAULT 1, quando TEXT, usuario TEXT, PRIMARY KEY (tarefa_id, data)
);
CREATE TABLE IF NOT EXISTS tarefas_dia (
  id INTEGER PRIMARY KEY, data TEXT NOT NULL, responsavel TEXT, titulo TEXT NOT NULL, detalhe TEXT,
  feito INTEGER NOT NULL DEFAULT 0, feito_em TEXT, criado_em TEXT, criado_por TEXT, demo INTEGER NOT NULL DEFAULT 0
);
-- Calendário anual/sazonal da secretaria
CREATE TABLE IF NOT EXISTS calendario (
  id INTEGER PRIMARY KEY, titulo TEXT NOT NULL, detalhe TEXT, mes INTEGER NOT NULL, dia INTEGER,
  responsavel TEXT, categoria TEXT, ordem INTEGER DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS calendario_feito (
  item_id INTEGER NOT NULL REFERENCES calendario(id) ON DELETE CASCADE, ano INTEGER NOT NULL,
  feito_em TEXT, usuario TEXT, obs TEXT, PRIMARY KEY (item_id, ano)
);
-- Registro de atendimentos (balcão, telefone, WhatsApp)
CREATE TABLE IF NOT EXISTS atendimentos (
  id INTEGER PRIMARY KEY, data TEXT NOT NULL, hora TEXT, canal TEXT NOT NULL DEFAULT 'balcao',
  aluno_id INTEGER REFERENCES alunos(id) ON DELETE SET NULL, pessoa TEXT, telefone TEXT, assunto TEXT NOT NULL,
  categoria TEXT, detalhe TEXT, resolvido INTEGER NOT NULL DEFAULT 1, encaminhado TEXT, retorno_em TEXT,
  criado_em TEXT, usuario TEXT, demo INTEGER NOT NULL DEFAULT 0
);
-- ── Etapa 4 ──
-- LGPD: quem abriu a ficha de quem (uma linha por pessoa/aluno/dia, com a contagem)
CREATE TABLE IF NOT EXISTS acessos (
  usuario TEXT NOT NULL, aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  data TEXT NOT NULL, vezes INTEGER NOT NULL DEFAULT 1, ultima TEXT, PRIMARY KEY (usuario, aluno_id, data)
);
-- Lixeira: o que foi excluído fica aqui por lixeira_dias antes de sumir de vez.
-- "dados" é uma fotografia em JSON das linhas apagadas (e das linhas filhas), para devolver com o mesmo id.
CREATE TABLE IF NOT EXISTS lixeira (
  id INTEGER PRIMARY KEY, tipo TEXT NOT NULL, rotulo TEXT, aluno_id INTEGER, dados TEXT NOT NULL,
  usuario TEXT, excluido_em TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0
);
-- Sessões abertas (só o hash do token): sobrevivem a um reinício do servidor
CREATE TABLE IF NOT EXISTS sessoes (hash TEXT PRIMARY KEY, uid INTEGER NOT NULL, expira INTEGER NOT NULL, bloqueada INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS ix_alunos_nome ON alunos(nome);
CREATE INDEX IF NOT EXISTS ix_atend_data ON atendimentos(data);
CREATE INDEX IF NOT EXISTS ix_avisos_data ON saida_avisos(data);
CREATE INDEX IF NOT EXISTS ix_acessos_data ON acessos(data);
CREATE INDEX IF NOT EXISTS ix_log_quando ON log(quando);
`);

// Colunas novas (Etapa 2) em bancos já existentes
const colunasAluno = new Set(db.prepare('PRAGMA table_info(alunos)').all().map((c) => c.name));
for (const c of ['ra', 'rg', 'endereco', 'bairro', 'cidade', 'uf', 'cep', 'cpf_resp', 'rg_resp', 'tel_resp']) {
  if (!colunasAluno.has(c)) db.exec(`ALTER TABLE alunos ADD COLUMN ${c} TEXT`);
}
// Etapa 4: marca de aluno cujos dados pessoais já foram descartados (LGPD)
if (!colunasAluno.has('anonimizado')) db.exec('ALTER TABLE alunos ADD COLUMN anonimizado TEXT');

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
  // Etapa 3
  desconto_funcionario: '100',      // filho(a) de funcionário: isento (100%)
  boletos_dia_venc: '10',           // vencimento das mensalidades
  boletos_mes_massa: '11',          // mês em que a massa de boletos do ano seguinte é gerada
  fotos_sistemas: 'ACADESC;SED;Lanche Card',
  saida_aviso_telefone: '0',        // 0 = não aceitar aviso só por telefone (regra do termo de saída)
  // Etapa 4 — cópias de segurança
  backup_pasta: '',                 // vazio = <dados>\backups. Aponte para o pen drive ou o HD da escola.
  backup_horas: '6',                // de quantas em quantas horas o sistema copia sozinho
  backup_manter: '30',              // quantas cópias guardar (as mais velhas são apagadas)
  backup_avisar_dias: '2',          // avisa na tela se o último backup for mais velho que isso
  backup_senha: '',                 // se preenchida, o arquivo do backup sai cifrado (AES-256)
  bloqueio_minutos: '20',           // bloqueia a tela após este tempo parado (0 = não bloquear)
  lgpd_anos_descarte: '5',          // depois de quantos anos um ex-aluno pode ser anonimizado
  lixeira_dias: '30',               // quantos dias o que foi excluído fica na lixeira antes de sumir de vez
};

// Nunca sai do servidor para a tela (nem para o admin): só se diz se está definida ou não.
const CHAVES_SECRETAS = ['backup_senha'];

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

  // Etapa 3 — cronograma da secretaria (dias: 1 = segunda … 5 = sexta). Editável em Meu dia › Cronograma.
  if (!db.prepare('SELECT 1 FROM rotina_tarefas LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO rotina_tarefas (titulo, detalhe, responsavel, dias, periodo, ordem) VALUES (?,?,?,?,?,?)');
    [
      ['Conferir os avisos de saída do dia', 'Quem busca hoje? Veja em Portão · Saída antes de liberar qualquer aluno.', 'todos', '1,2,3,4,5', 'dia'],
      ['Registrar os atendimentos do dia', 'Balcão, telefone e WhatsApp: lance em Atendimentos logo depois de atender.', 'todos', '1,2,3,4,5', 'dia'],
      ['Históricos escolares e lançamentos no ACADESC', '', 'samara', '1,2,3', 'dia'],
      ['Baixas de pagamento no ACADESC', 'Conferir o extrato e dar baixa nas parcelas pagas.', 'duda', '1,2,3', 'manha'],
      ['Planilhas do financeiro', 'Inadimplência, descontos e conferências.', 'duda', '1,2,3', 'manha'],
      ['Lanche Card (manhã)', 'Recargas, cadastros e conferência da cantina.', 'duda', '1,2,3,4', 'manha'],
      ['Fotos dos alunos (manhã)', 'Tirar e inserir nos 3 sistemas: ACADESC, SED e Lanche Card.', 'duda', '1,2,3', 'manha'],
      ['Portão: entrada e saída dos alunos', 'Conferir quem pode buscar antes de liberar.', 'kevin', '1,2,3,4', 'tarde'],
      ['Lanche Card (tarde)', '', 'kevin', '1,2,3,4', 'tarde'],
      ['Digitalização e prontuário', 'Digitalizar, renomear no PDF Renamer e guardar na pasta do aluno.', 'kevin', '1,2,3,4', 'tarde'],
      ['Fotos dos alunos (tarde)', 'Tirar e inserir nos 3 sistemas: ACADESC, SED e Lanche Card.', 'kevin', '1,2,3', 'tarde'],
      ['Foco na SED', 'Cadastros, transferências, classes e atualizações.', 'samara', '4', 'dia'],
      ['Foco na SED (apoio)', '', 'duda', '4', 'manha'],
      ['Balcão sozinho', 'Na quinta a Duda não vem: atendimento e telefone ficam com você.', 'kevin', '4', 'tarde'],
      ['Fechamento da semana', 'Conferir pendências, e-mails e o que ficou para segunda.', 'samara', '5', 'dia'],
      ['Fechamento do financeiro da semana', 'Na sexta o Kevin não vem: balcão e telefone ficam com você.', 'duda', '5', 'manha'],
    ].forEach((t, i) => ins.run(...t, i + 1));
  }

  // Etapa 3 — calendário anual/sazonal da secretaria (dia em branco = "durante o mês")
  if (!db.prepare('SELECT 1 FROM calendario LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO calendario (titulo, detalhe, mes, dia, responsavel, categoria, ordem) VALUES (?,?,?,?,?,?,?)');
    [
      ['Massa de boletos do ano: conferir e distribuir', 'Conferir os descontos antes de gerar e entregar os boletos.', 1, null, 'duda', 'Financeiro'],
      ['SED: início do ano letivo, turmas e matrículas', '', 1, null, 'samara', 'SED'],
      ['Passe escolar SPTRANS / EMTU', 'Renovações e pedidos novos das famílias.', 1, null, 'kevin', 'Transporte'],
      ['Entrega dos boletos físicos por turma', 'Use o protocolo de entrega para registrar quem recebeu.', 2, null, 'duda', 'Financeiro'],
      ['SED: fechamento das matrículas e das turmas', '', 2, null, 'samara', 'SED'],
      ['Conferir a documentação dos alunos novos', 'Prazo de 30 dias a partir da matrícula.', 2, null, 'todos', 'Matrícula'],
      ['Mutirão de fotos', 'Tirar as fotos e inserir no ACADESC, na SED e no Lanche Card.', 3, null, 'kevin', 'Fotos'],
      ['Preparar a prestação de contas do CEBAS', 'Reunir documentos e planilhas das bolsas concedidas.', 3, null, 'samara', 'Bolsas'],
      ['Prestação de contas do CEBAS — prazo final', 'Entregar até 30/04.', 4, 30, 'samara', 'Bolsas'],
      ['Concluir o mutirão de fotos', '', 4, null, 'kevin', 'Fotos'],
      ['Edital de bolsas: preparar e divulgar', '', 5, null, 'samara', 'Bolsas'],
      ['Retirada dos requerimentos de bolsa', '', 6, null, 'samara', 'Bolsas'],
      ['Festa junina: vouchers, ingressos e listas', '', 6, null, 'todos', 'Eventos'],
      ['Entrega dos requerimentos e conferência dos documentos das bolsas', '', 7, null, 'samara', 'Bolsas'],
      ['Visitas da assistente social', '', 7, null, 'samara', 'Bolsas'],
      ['Resultado das bolsas e contratos', '', 8, null, 'samara', 'Bolsas'],
      ['Abertura das matrículas e rematrículas', '', 9, null, 'todos', 'Matrícula'],
      ['Campanha de rematrícula: contratos e contatos', '', 9, null, 'todos', 'Matrícula'],
      ['Rematrículas: cobrança das famílias e pendências', '', 10, null, 'todos', 'Matrícula'],
      ['Apresentações de fim de ano: ingressos e listas', '', 10, null, 'todos', 'Eventos'],
      ['Massa de boletos do ano seguinte: conferência de descontos', 'Filhos de funcionários, bolsas CEBAS e atividades extras.', 11, null, 'duda', 'Financeiro'],
      ['Fechamento na SED: rendimento e frequência', '', 11, null, 'samara', 'SED'],
      ['Certificados e declarações de conclusão', '', 12, null, 'samara', 'Documentos'],
      ['Fechamento do ano letivo na SED', '', 12, null, 'samara', 'SED'],
      ['Entrega dos boletos do ano seguinte', '', 12, null, 'duda', 'Financeiro'],
    ].forEach((c, i) => ins.run(...c, i + 1));
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

// Versão para mandar ao navegador: troca os segredos por "está definido?"
function cfgPublica() {
  const o = cfg();
  for (const k of CHAVES_SECRETAS) { o[k + '_definida'] = !!String(o[k] || '').trim(); delete o[k]; }
  return o;
}

function registrar(usuario, acao, detalhe) {
  db.prepare('INSERT INTO log (quando, usuario, acao, detalhe) VALUES (?, ?, ?, ?)')
    .run(new Date().toISOString(), usuario, acao, typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe));
}

// LGPD: guarda que alguém abriu a ficha de um aluno. Uma linha por pessoa/aluno/dia.
function registrarAcesso(usuario, alunoId) {
  if (!usuario || !alunoId) return;
  const hoje = new Date().toLocaleDateString('sv-SE');
  db.prepare(`INSERT INTO acessos (usuario, aluno_id, data, vezes, ultima) VALUES (?,?,?,1,?)
    ON CONFLICT(usuario, aluno_id, data) DO UPDATE SET vezes = vezes + 1, ultima = excluded.ultima`)
    .run(usuario, alunoId, hoje, new Date().toISOString());
}

function transacao(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

module.exports = { db, inicializar, cfg, cfgPublica, registrar, registrarAcesso, transacao, hashSenha, conferirSenha, PASTA_DADOS, restauracao, CHAVES_SECRETAS };
