# Prompt para o próximo chat

Copie **tudo o que está entre as linhas** e cole como primeira mensagem no Claude Code.

---

Olá! Sou o Kevin, aprendiz da secretaria do Instituto Educacional Luterano (Ferraz de Vasconcelos/SP). Em chats anteriores você construiu comigo as **Etapas 1 a 4** do app **Secretaria IEL**: gestão da secretaria em Node.js portátil, SQLite e HTML/JS puro, hoje na **versão 4.8.0**.

**Repositório (privado):** https://github.com/kevinhsdev/secretaria-iel

Faça nesta ordem:

1. **Prepare o ambiente**
   - Se o repositório ainda não estiver neste computador, clone-o. Se o Git não existir, instale o Git portátil (MinGit) numa pasta do meu usuário, sem precisar de administrador. Se o clone pedir login, me diga o comando exato para eu rodar com `!`.
   - Se já estiver clonado, rode `git pull` antes de mexer em qualquer coisa.
2. **Leia com atenção o `HANDOFF.md` inteiro.** Ele tem quem eu sou, a equipe, os sistemas da escola, as decisões fechadas (§2, não reabrir sem perguntar), a arquitetura, os formatos do ACADESC, como testar, as armadilhas do ambiente e o **roteiro do que falta (§7)**. Siga as "Regras de ouro" (§8).
3. **Salve na sua memória** deste computador um resumo de quem eu sou e do projeto, apontando para o HANDOFF.
4. **Rode o app uma vez** para garantir que funciona aqui:
   - `Iniciar Secretaria.bat` baixa o Node sozinho, ou rode `ferramentas\instalar-node.ps1`.
   - Suba um servidor de teste com banco temporário (`IEL_DADOS` e `IEL_PORTA=3999`), carregue a demonstração e confira as telas principais.
5. **Recrie os scripts de teste** descritos no §6 do HANDOFF (numa pasta temporária, fora do Git). São a rede de proteção do projeto: cliente de API, Etapas 1-3, perfil aprendiz, segurança/LGPD, backup, migração, versão, atualização, lixeira, busca, servidor caindo, edição simultânea, ajuda, listas em partes, todas as telas, e os prints no Edge headless.
6. **Combine comigo o que fazer**, seguindo o §7.2 do HANDOFF. A ordem que ficou recomendada é:
   1. **Piloto com dado real de um módulo só** (Atendimentos ou Portão) — é o que falta de verdade, e depende mais de mim do que de você. Me ajude a preparar isso: o que configurar, o que combinar com a Samara e como medir se deu certo.
   2. **Histórico escolar** — depende de eu conseguir as notas (SED ou ACADESC).
   3. **Testar nos 3 PCs da secretaria** (rede, firewall e atalho) — só dá na escola.
   Lixeira, busca global, queda do servidor, edição simultânea, ajuda nas telas e desempenho com 535 alunos já foram feitos (4.3.0 a 4.8.0).
   Me diga o que dá para fazer já com o que temos e o que depende de eu conseguir alguma informação na escola.
7. **Teste de verdade** antes de me entregar: `node --check` em tudo, os scripts de API, o teste que abre todas as telas, prints no Edge headless, e corrija o que encontrar.
8. **Entregue:**
   - Atualize o `HANDOFF.md` (incluindo o §7) e este prompt.
   - Se mexer no servidor ou nas telas, **suba a versão** em `app/lib/versao.js` **e** em `app/public/app.js` (as duas precisam ser iguais; há teste para isso).
   - Faça commit e push.
   - Me explique em linguagem simples o que mudou e como eu testo.

**Regras importantes**
- Responda sempre em **português**. Eu não sou programador, então explique de forma simples.
- **LGPD:** nunca envie ao GitHub dados reais de alunos (`dados/`, `backups/`, planilhas, fotos). Teste só com a demonstração. Modelos `.xlsx` novos passam antes por `ferramentas/sanitizar-modelos.js`.
- Não mude as decisões do §2 do HANDOFF sem me perguntar.
- Para as perguntas em aberto (§7.6), use um padrão sensato e configurável e me conte qual escolheu. Só me pergunte se for impossível continuar sem a resposta.
- **Não** reescreva em React/Vue, não suba para a nuvem e não faça WhatsApp automático em massa — está explicado no §7.3 por quê.
- No começo, me lembre de três coisas: **(1)** conferir se no PC da escola o "Atestado de inaptidão para Ed. Física" ainda está marcado como obrigatório (não deveria); **(2)** apontar a pasta de backup para um pen drive ou OneDrive, definir a senha do backup e **testar uma restauração**; **(3)** mostrar para a Samara a tabela de padrões do §7.4 e §7.5 do HANDOFF, principalmente a isenção de 100% do filho de funcionário e a regra de que os descontos não somam.

Pode começar!

---
