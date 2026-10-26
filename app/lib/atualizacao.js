// Etapa 4 — Verificar e aplicar atualizações do sistema usando o Git que já baixou o projeto.
// Nada aqui lança erro: tudo volta como texto explicado, porque quem vai ler é a secretaria.
'use strict';
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// A raiz é a pasta do projeto (onde fica o .git). IEL_RAIZ existe para os testes.
const RAIZ = process.env.IEL_RAIZ || path.join(__dirname, '..', '..');

// Git instalado com o servidor já aberto não entra no PATH deste processo: procura nas pastas de instalação padrão também.
function gitExe() {
  const locais = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')]
    .filter(Boolean).map((p) => path.join(p, 'Git', 'cmd', 'git.exe'));
  return locais.find((f) => fs.existsSync(f)) || 'git';
}

// GIT_TERMINAL_PROMPT=0: se o GitHub pedir login, o git falha na hora em vez de travar esperando alguém digitar.
// "cru" mantém os espaços do começo da linha: o "git status --porcelain" usa as duas primeiras
// colunas para a situação do arquivo, e limpar isso comeria a primeira letra do nome.
function git(args, tempo = 25000, cru = false) {
  return new Promise((ok) => {
    execFile(gitExe(), args, { cwd: RAIZ, timeout: tempo, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
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

// ── 5.11.0: atualizar sem Git, por um .zip (o "Download ZIP" do GitHub ou a pasta app zipada num pen drive) ──
// Troca só a pasta do programa (app). A pasta dados, o node e as fotos/prontuários nunca são tocados.
// Antes, guarda a versão atual em "app-antigo", ao lado; se algo der errado no meio, volta tudo de lá.
const { readZip } = require('./zip');
const PASTA_APP = path.join(__dirname, '..');
const versaoDe = (txt) => (String(txt).match(/VERSAO:\s*'([\d.]+)'/) || [])[1] || null;
const comparar = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

function lerPacote(buf) {
  let zip;
  try { zip = readZip(buf); } catch { return { erro: 'Este arquivo não é um .zip válido.' }; }
  const barra = (n) => n.split('\\').join('/');
  const nomes = [...zip.keys()].map(barra);
  const porNome = new Map([...zip].map(([n, b]) => [barra(n), b]));
  // A pasta do programa é a que tem server.js e lib/versao.js (no zip do GitHub fica em "secretaria-iel-main/app/")
  const prefixo = nomes.filter((n) => n.endsWith('server.js')).map((n) => n.slice(0, -'server.js'.length))
    .filter((p) => porNome.has(p + 'lib/versao.js')).sort((a, b) => a.length - b.length)[0];
  if (prefixo === undefined) return { erro: 'Não achei o sistema dentro deste .zip (falta a pasta app com server.js). Use o "Download ZIP" do GitHub ou zipe a pasta app.' };
  const arquivos = new Map();
  for (const n of nomes) {
    if (!n.startsWith(prefixo) || n.endsWith('/')) continue;
    const rel = n.slice(prefixo.length);
    if (rel.split('/').some((p) => p === '..' || p === '') || path.isAbsolute(rel)) return { erro: 'O .zip tem um caminho estranho (' + rel + '). Por segurança, nada foi feito.' };
    arquivos.set(rel, porNome.get(n));
  }
  const versao = versaoDe(arquivos.get('lib/versao.js'));
  if (!versao) return { erro: 'Não consegui ler a versão dentro do .zip.' };
  return { arquivos, versao };
}

function listarArquivos(pasta, base = pasta) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(pasta, e.name);
    return e.isDirectory() ? listarArquivos(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}

function aplicarZip(buf, versaoAtual, { pastaApp = PASTA_APP } = {}) {
  const pacote = lerPacote(buf);
  if (pacote.erro) return { ok: false, aviso: pacote.erro };
  if (comparar(pacote.versao, versaoAtual) < 0) {
    return { ok: false, aviso: `O .zip é de uma versão mais velha (${pacote.versao}) que a instalada (${versaoAtual}). Nada foi feito.` };
  }
  const antigo = path.join(pastaApp, '..', 'app-antigo');
  fs.rmSync(antigo, { recursive: true, force: true });
  fs.cpSync(pastaApp, antigo, { recursive: true });
  try {
    for (const [rel, dados] of pacote.arquivos) {
      const destino = path.join(pastaApp, rel);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, dados);
    }
    // Arquivo que a versão nova não tem mais sai (senão uma tela velha poderia continuar carregando)
    for (const rel of listarArquivos(pastaApp)) if (!pacote.arquivos.has(rel)) fs.rmSync(path.join(pastaApp, rel), { force: true });
  } catch (e) {
    try { fs.cpSync(antigo, pastaApp, { recursive: true }); } catch { /* o app-antigo continua lá para trocar à mão */ }
    return { ok: false, aviso: 'Deu erro ao trocar os arquivos (' + e.message + '). A versão anterior foi devolvida; se o sistema não abrir, renomeie a pasta app-antigo para app.' };
  }
  return { ok: true, de: versaoAtual, para: pacote.versao, arquivos: pacote.arquivos.size };
}

module.exports = { estado, verificar, aplicar, aplicarZip, lerPacote, RAIZ };
