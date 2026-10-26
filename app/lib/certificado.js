// HTTPS na rede da escola (5.12.0): tira o "Não seguro" do navegador.
// O navegador só confia num endereço como https://PC-SECRETARIA:3443 se o certificado for assinado por alguém que ele conhece.
// Na rede local não há quem assine, então a escola tem a própria "raiz" (SEK-raiz.cer), que cada computador instala uma vez.
// Tudo feito aqui, só com o crypto do Node (sem OpenSSL e sem mexer no Windows). Os arquivos ficam em <dados>\certificado.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── DER mínimo (o formato binário dos certificados) ──
const tam = (n) => (n < 128 ? Buffer.from([n]) : (() => { const b = []; while (n) { b.unshift(n & 255); n >>= 8; } return Buffer.from([0x80 | b.length, ...b]); })());
const tlv = (tag, ...partes) => { const c = Buffer.concat(partes); return Buffer.concat([Buffer.from([tag]), tam(c.length), c]); };
const seq = (...p) => tlv(0x30, ...p);
const inteiro = (b) => tlv(0x02, b[0] & 0x80 ? Buffer.concat([Buffer.from([0]), b]) : b);
const oid = (s) => { const n = s.split('.').map(Number); const b = [40 * n[0] + n[1]];
  for (const v of n.slice(2)) { const t = [v & 127]; let x = v >> 7; while (x) { t.unshift((x & 127) | 128); x >>= 7; } b.push(...t); } return tlv(0x06, Buffer.from(b)); };
const texto = (s) => tlv(0x0c, Buffer.from(s, 'utf8'));
const bits = (b, sobra = 0) => tlv(0x03, Buffer.from([sobra]), b);
const octetos = (b) => tlv(0x04, b);
const explicito = (n, b) => tlv(0xa0 + n, b);
const quando = (d) => tlv(0x17, Buffer.from(d.toISOString().replace(/[-:T]/g, '').slice(2, 14) + 'Z')); // UTCTime (vale até 2049)
const nome = (cn) => seq(tlv(0x31, seq(oid('2.5.4.3'), texto(cn))));
const SHA256_RSA = seq(oid('1.2.840.113549.1.1.11'), Buffer.from([5, 0]));
const ext = (id, valor, critica) => seq(oid(id), ...(critica ? [Buffer.from([1, 1, 255])] : []), octetos(valor));
const idChave = (chavePub) => crypto.createHash('sha1').update(chavePub.export({ type: 'spki', format: 'der' })).digest();
const pem = (der, tipo) => `-----BEGIN ${tipo}-----\n${der.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${tipo}-----\n`;

function emitir({ cn, emissorCn, chavePub, chaveAssina, pubEmissor, dias, ca, nomes = [], ips = [] }) {
  const agora = new Date(Date.now() - 5 * 60000); // 5 min para trás: relógio de outro PC um pouco atrasado não estranha
  const exts = ca
    ? [ext('2.5.29.19', seq(Buffer.from([1, 1, 255]), inteiro(Buffer.from([0]))), true), ext('2.5.29.15', bits(Buffer.from([0x86]), 1), true)]
    : [ext('2.5.29.19', seq(), true), ext('2.5.29.15', bits(Buffer.from([0xa0]), 5), true), ext('2.5.29.37', seq(oid('1.3.6.1.5.5.7.3.1'))),
      ext('2.5.29.17', seq(...nomes.map((n) => tlv(0x82, Buffer.from(n))), ...ips.map((ip) => tlv(0x87, Buffer.from(ip.split('.').map(Number))))))];
  exts.push(ext('2.5.29.14', octetos(idChave(chavePub))), ext('2.5.29.35', seq(tlv(0x80, idChave(pubEmissor)))));
  const serie = crypto.randomBytes(16); serie[0] &= 0x7f;
  const tbs = seq(explicito(0, inteiro(Buffer.from([2]))), inteiro(serie), SHA256_RSA, nome(emissorCn),
    seq(quando(agora), quando(new Date(agora.getTime() + dias * 86400000))), nome(cn),
    chavePub.export({ type: 'spki', format: 'der' }), explicito(3, seq(...exts)));
  return seq(tbs, SHA256_RSA, bits(crypto.sign('sha256', tbs, chaveAssina)));
}

const RAIZ_CN = 'SEK Secretaria IEL (certificado da escola)';
const pastaDe = (PASTA_DADOS) => path.join(PASTA_DADOS, 'certificado');
const arq = (PASTA_DADOS) => { const p = pastaDe(PASTA_DADOS);
  return { raizCer: path.join(p, 'SEK-raiz.cer'), raizKey: path.join(p, 'raiz.key'), key: path.join(p, 'servidor.key'), crt: path.join(p, 'servidor.crt') }; };

// Certificado do servidor com o nome do PC e os IPs. A raiz é criada só uma vez (trocar a raiz obriga a reinstalar em todo PC).
function criar(PASTA_DADOS, { nomes, ips }) {
  const a = arq(PASTA_DADOS);
  fs.mkdirSync(pastaDe(PASTA_DADOS), { recursive: true });
  let raizPriv, raizDer;
  if (fs.existsSync(a.raizKey) && fs.existsSync(a.raizCer)) {
    raizPriv = crypto.createPrivateKey(fs.readFileSync(a.raizKey));
    raizDer = new crypto.X509Certificate(fs.readFileSync(a.raizCer)).raw;
  } else {
    const k = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    raizPriv = k.privateKey;
    raizDer = emitir({ cn: RAIZ_CN, emissorCn: RAIZ_CN, chavePub: k.publicKey, chaveAssina: k.privateKey, pubEmissor: k.publicKey, dias: 3650, ca: true });
    fs.writeFileSync(a.raizKey, raizPriv.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    fs.writeFileSync(a.raizCer, pem(raizDer, 'CERTIFICATE'));
  }
  const raizPub = crypto.createPublicKey(raizPriv);
  const k = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const der = emitir({ cn: nomes[0], emissorCn: RAIZ_CN, chavePub: k.publicKey, chaveAssina: raizPriv, pubEmissor: raizPub, dias: 825, nomes, ips });
  fs.writeFileSync(a.key, k.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.writeFileSync(a.crt, pem(der, 'CERTIFICATE') + pem(raizDer, 'CERTIFICATE'));
  return estado(PASTA_DADOS);
}

function estado(PASTA_DADOS) {
  const a = arq(PASTA_DADOS);
  if (!fs.existsSync(a.crt) || !fs.existsSync(a.key)) return { existe: false };
  const c = new crypto.X509Certificate(fs.readFileSync(a.crt));
  const alt = String(c.subjectAltName || '');
  return { existe: true, valido_ate: new Date(c.validTo).toISOString(), nomes: [...alt.matchAll(/DNS:([^,\s]+)/g)].map((m) => m[1]),
    ips: [...alt.matchAll(/IP Address:([^,\s]+)/g)].map((m) => m[1]), vencendo: Date.parse(c.validTo) - Date.now() < 30 * 86400000 };
}

const opcoesHttps = (PASTA_DADOS) => { const a = arq(PASTA_DADOS); return { key: fs.readFileSync(a.key), cert: fs.readFileSync(a.crt) }; };

module.exports = { criar, estado, opcoesHttps, arquivos: arq, RAIZ_CN };
