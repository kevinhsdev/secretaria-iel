// Busca global: um campo só que acha aluno, atendimento, aviso de saída, quem pode buscar, interessado,
// documento emitido e bolsa (esta só para a administração). Resultado agrupado por tipo.
// A comparação é feita no JavaScript (sem acento e sem maiúscula), que o LIKE do SQLite não sabe fazer.
'use strict';

module.exports = function busca(ctx) {
  const { rota, db, cfg, json, S, turmaRotulo } = ctx;
  const LIMITE = 6;

  rota('GET', '/api/busca', async (req, res, { u, url }) => {
    const bruto = String(url.searchParams.get('q') || '').trim();
    const q = S.norm(bruto);
    if (q.length < 2) return json(res, 200, { q: bruto, grupos: [] });
    const digitos = bruto.replace(/\D/g, '');
    const acha = (...campos) => campos.some((v) => v != null && (S.norm(v).includes(q) || (digitos.length >= 3 && String(v).replace(/\D/g, '').includes(digitos))));
    const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
    const grupos = [];
    // todos: tela que lista tudo o que foi achado (quando passa do limite)
    const TODOS = { aluno: '#/alunos', atendimento: '#/atendimentos', interessado: '#/interessados', bolsa: '#/bolsas' };
    const grupo = (tipo, nome, itens) => { if (itens.length) grupos.push({ tipo, nome, total: itens.length, itens: itens.slice(0, LIMITE), todos: TODOS[tipo] ? TODOS[tipo] + '?q=' + encodeURIComponent(bruto) : null }); };

    // Alunos (inclui os inativos no fim, marcados)
    const alunos = db.prepare(`SELECT id, mat, nome, serie_chave, turma, descricao, serie, ativo, nome_mae, nome_pai, nome_resp, cpf, cpf_resp
      FROM alunos WHERE anonimizado IS NULL ORDER BY ativo DESC, nome`).all();
    grupo('aluno', 'Alunos', alunos.filter((a) => acha(a.nome, a.mat, a.nome_mae, a.nome_pai, a.nome_resp, a.cpf, a.cpf_resp)).map((a) => ({
      titulo: a.nome, detalhe: `${turmaRotulo(a)} · Mat. ${a.mat || '—'}${a.nome_mae ? ' · Mãe: ' + a.nome_mae : ''}${a.ativo ? '' : ' · inativo'}`,
      link: '#/aluno/' + a.id })));

    const nomeAluno = new Map(alunos.map((a) => [a.id, a]));
    const doAluno = (id) => { const a = nomeAluno.get(id); return a ? `${a.nome} (${turmaRotulo(a)})` : ''; };

    // Quem pode buscar e avisos de saída (levam à ficha do aluno, onde fica o bloco de saída)
    const aut = db.prepare('SELECT id, aluno_id, nome, parentesco, documento, telefone FROM saida_autorizados WHERE ativo = 1').all();
    grupo('autorizado', 'Quem pode buscar', aut.filter((x) => acha(x.nome, x.documento, x.telefone)).map((x) => ({
      titulo: x.nome, detalhe: `${x.parentesco || 'autorizado'} · busca ${doAluno(x.aluno_id)}`, link: '#/aluno/' + x.aluno_id })));
    const avisos = db.prepare('SELECT id, aluno_id, data, quem, parentesco, quem_avisou, obs FROM saida_avisos ORDER BY data DESC LIMIT 2000').all();
    grupo('aviso', 'Avisos de saída', avisos.filter((x) => acha(x.quem, x.quem_avisou, x.obs) || acha(nomeAluno.get(x.aluno_id)?.nome)).map((x) => ({
      titulo: `${dataBR(x.data)} · ${x.quem}`, detalhe: `${x.parentesco ? x.parentesco + ' · ' : ''}${doAluno(x.aluno_id)}`, link: '#/aluno/' + x.aluno_id })));

    // Atendimentos: abre a tela já filtrada pelo que foi digitado
    const ats = db.prepare('SELECT id, data, aluno_id, pessoa, telefone, assunto, categoria, detalhe, resolvido FROM atendimentos ORDER BY data DESC, id DESC LIMIT 3000').all();
    grupo('atendimento', 'Atendimentos', ats.filter((x) => acha(x.pessoa, x.telefone, x.assunto, x.categoria, x.detalhe) || (x.aluno_id && acha(nomeAluno.get(x.aluno_id)?.nome))).map((x) => ({
      titulo: `${dataBR(x.data)} · ${x.assunto}`, detalhe: `${x.resolvido ? 'resolvido' : 'em aberto'}${x.aluno_id ? ' · ' + doAluno(x.aluno_id) : x.pessoa ? ' · ' + x.pessoa : ''}`,
      link: '#/atendimentos?q=' + encodeURIComponent(bruto) })));

    // Interessados (SIG)
    const ints = db.prepare('SELECT id, aluno, responsavel, contato, serie_interesse, status FROM interessados ORDER BY id DESC').all();
    grupo('interessado', 'Interessados (SIG)', ints.filter((x) => acha(x.aluno, x.responsavel, x.contato)).map((x) => ({
      titulo: x.aluno, detalhe: `${x.serie_interesse || 'série não informada'} · ${x.responsavel || x.contato || ''}`, link: '#/interessados?q=' + encodeURIComponent(bruto) })));

    // Documentos emitidos
    const ems = db.prepare('SELECT id, quando, tipo, aluno_id, descricao, usuario FROM emissoes ORDER BY id DESC LIMIT 3000').all();
    grupo('documento', 'Documentos emitidos', ems.filter((x) => acha(x.descricao, x.tipo) || (x.aluno_id && acha(nomeAluno.get(x.aluno_id)?.nome))).map((x) => ({
      titulo: x.descricao || x.tipo, detalhe: `${dataBR(x.quando)} · por ${x.usuario || '—'}${x.aluno_id ? ' · ' + doAluno(x.aluno_id) : ''}`,
      link: x.aluno_id ? '#/aluno/' + x.aluno_id : '#/documentos' })));

    // Bolsas: dado socioeconômico, só a administração
    if (u.perfil === 'admin') {
      const bol = db.prepare('SELECT id, ano, nome_aluno, responsavel, status FROM bolsas ORDER BY ano DESC, nome_aluno').all();
      grupo('bolsa', 'Bolsas (CEBAS)', bol.filter((x) => acha(x.nome_aluno, x.responsavel)).map((x) => ({
        titulo: x.nome_aluno, detalhe: `${x.ano} · ${x.status}${x.responsavel ? ' · ' + x.responsavel : ''}`, link: '#/bolsas?q=' + encodeURIComponent(bruto) })));
    }
    json(res, 200, { q: bruto, grupos });
  });
};
