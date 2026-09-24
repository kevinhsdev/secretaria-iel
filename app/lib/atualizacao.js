// Etapa 4 — Verificar e aplicar atualizações do sistema usando o Git que já baixou o projeto.
// Nada aqui lança erro: tudo volta como texto explicado, porque quem vai ler é a secretaria.
'use strict';
const { execFile } = require('child_process');
const path = require('path');

// A raiz é a pasta do projeto (onde fica o .git). IEL_RAIZ existe para os testes.
const RAIZ = process.env.IEL_RAIZ || path.join(__dirname, '..', '..');

// GIT_TERMINAL_PROMPT=0: se o GitHub pedir login, o git falha na hora em vez de travar esperando alguém digitar.
// "cru" mantém os espaços do começo da linha: o "git status --porcelain" usa as duas primeiras
// colunas para a situação do arquivo, e limpar isso comeria a primeira letra do nome.
function git(args, tempo = 25000, cru = false) {
  return new Promise((ok) => {
    execFile('git', args, { cwd: RAIZ, timeout: tempo, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (erro, saida, saidaErro) => ok({
        ok: !erro, codigo: erro ? erro.code : 0,
        texto: cru ? String(saida || '').replace(/\s+$/, '') : String(saida || '').trim(),
        erro: String(saidaErro || '').trim() || (erro ? erro.message : ''),
      }));
  });
}

const commit = (linha) => {
  const [hash, data, ...resto] = linha.split('\u001f');
  return { hash, data, assunto: resto.join('\u001f') };
};
const FORMATO = '--format=%h%x1f%ad%x1f%s';

// Situação atual, sem tocar na internet
async function estado() {
  const versao = await git(['--version'], 8000);
  if (!versao.ok) {
    return { git: false, aviso: 'O Git não está instalado neste computador, então o sistema não consegue se atualizar sozinho. ' +
      'Dá para atualizar copiando a pasta nova por cima, ou instalando o Git.' };
  }
  const dentro = await git(['rev-parse', '--is-inside-work-tree'], 8000);
  if (!dentro.ok || dentro.texto !== 'true') {
    return { git: true, repositorio: false, aviso: 'Esta pasta não foi baixada pelo Git (foi copiada à mão), então não dá para atualizar por aqui.' };
  }
  const [atual, ramo, sujo, remoto] = await Promise.all([
    git(['log', '-1', FORMATO, '--date=short'], 8000),
    git(['rev-parse', '--abbrev-ref', 'HEAD'], 8000),
    git(['status', '--porcelain'], 10000, true),
    git(['remote', 'get-url', 'origin'], 8000),
  ]);
  const mudancas = sujo.texto ? sujo.texto.split('\n').map((l) => l.slice(3).trim()).filter(Boolean) : [];
  return {
    git: true, repositorio: true,
    atual: atual.ok && atual.texto ? commit(atual.texto) : null,
    ramo: ramo.texto || '?', origem: remoto.texto || '',
    mudancas_locais: mudancas,
    limpo: mudancas.length === 0,
  };
}

// Conversa com o GitHub para ver se há versão nova
async function verificar() {
  const base = await estado();
  if (!base.git || !base.repositorio) return { ...base, verificado: false };
  const busca = await git(['fetch', '--quiet', 'origin'], 60000);
  if (!busca.ok) {
    const texto = (busca.erro || '').toLowerCase();
    const aviso = /could not resolve|unable to access|network|timed out|timeout/.test(texto)
      ? 'Não consegui falar com o GitHub. Verifique a internet e tente de novo.'
      : /authentication|could not read|terminal prompts disabled|403|denied/.test(texto)
        ? 'O GitHub pediu login e não consegui entrar sozinho. Abra o Prompt de Comando na pasta do sistema e rode "git pull" uma vez para gravar o acesso.'
        : 'Não consegui buscar atualizações: ' + (busca.erro || 'erro desconhecido');
    return { ...base, verificado: false, aviso };
  }
  const alvo = `origin/${base.ramo}`;
  const novos = await git(['log', `HEAD..${alvo}`, FORMATO, '--date=short'], 15000);
  if (!novos.ok) return { ...base, verificado: false, aviso: 'Não achei o ramo ' + alvo + ' no GitHub.' };
  const lista = novos.texto ? novos.texto.split('\n').filter(Boolean).map(commit) : [];
  return { ...base, verificado: true, quando: new Date().toISOString(), disponivel: lista.length > 0, novidades: lista };
}

// Traz a versão nova. Só anda para a frente (--ff-only): nunca inventa mistura de versões.
async function aplicar() {
  const base = await estado();
  if (!base.git || !base.repositorio) return { ok: false, aviso: base.aviso };
  if (!base.limpo) {
    return { ok: false, aviso: 'Há arquivos alterados aqui dentro (' + base.mudancas_locais.slice(0, 5).join(', ') +
      '). Para não perder esse trabalho, a atualização foi cancelada.' };
  }
  const antes = base.atual ? base.atual.hash : '';
  const puxar = await git(['pull', '--ff-only', 'origin', base.ramo], 120000);
  if (!puxar.ok) return { ok: false, aviso: 'A atualização não foi aplicada: ' + (puxar.erro || puxar.texto), detalhe: puxar.texto };
  const depois = await estado();
  const trocou = depois.atual && depois.atual.hash !== antes;
  return {
    ok: true, atualizou: trocou, de: antes, para: depois.atual ? depois.atual.hash : '',
    atual: depois.atual, saida: puxar.texto,
  };
}

module.exports = { estado, verificar, aplicar, RAIZ };
