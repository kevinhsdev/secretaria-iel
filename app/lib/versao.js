// Versão do sistema. Precisa ser IGUAL à constante VERSAO no começo de public/app.js:
// é assim que o app percebe que a janela preta está rodando uma versão antiga do servidor
// enquanto o navegador já carregou as telas novas (o que dava "Rota não encontrada").
// Ao mexer numa delas, mexa na outra — existe um teste que compara as duas.
'use strict';
module.exports = { VERSAO: '4.2.0' };
