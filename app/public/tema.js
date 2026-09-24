// Aplica o tema salvo antes de a tela aparecer (evita a "piscada" branca).
// Fica em arquivo separado, e não dentro do HTML, para o sistema poder proibir scripts soltos na página.
(function () {
  'use strict';
  try {
    var t = localStorage.getItem('iel-tema');
    if (t !== 'claro' && t !== 'escuro') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
    document.documentElement.dataset.tema = t;
    if (localStorage.getItem('iel-compacto') === '1') document.documentElement.dataset.densidade = 'compacta';
  } catch (e) { document.documentElement.dataset.tema = 'claro'; }
})();
