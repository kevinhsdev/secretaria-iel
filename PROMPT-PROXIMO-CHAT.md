# Prompt para o próximo chat

Copie **tudo o que está entre as linhas** e cole como primeira mensagem no Claude Code.

---

Olá! Sou o Kevin, aprendiz da secretaria do Instituto Educacional Luterano (Ferraz de Vasconcelos/SP). Em chats anteriores você construiu comigo as **Etapas 1, 2 e 3** do app **Secretaria IEL**: gestão da secretaria em Node.js portátil, SQLite e HTML/JS puro. Agora quero seguir para a **Etapa 4**, sem refazer perguntas que já foram respondidas.

**Repositório (privado):** https://github.com/kevinhsdev/secretaria-iel

Faça nesta ordem:

1. **Prepare o ambiente**
   - Se o repositório ainda não estiver neste computador, clone-o (se o Git não existir, instale o Git portátil MinGit numa pasta do meu usuário, sem precisar de administrador). Se o clone pedir login, me diga o comando exato para eu rodar com `!`.
   - Se já estiver clonado, rode `git pull` antes de mexer em qualquer coisa.
2. **Leia com atenção** o `HANDOFF.md` inteiro: quem eu sou, a equipe, os sistemas da escola, as decisões já tomadas, a arquitetura, os formatos de importação do ACADESC, como testar e as armadilhas do ambiente. Siga as "Regras de ouro" (seção 8).
3. **Salve na sua memória** deste computador um resumo de quem eu sou e do projeto, apontando para o HANDOFF.
4. **Rode o app uma vez** para garantir que funciona aqui:
   - `Iniciar Secretaria.bat` baixa o Node sozinho, ou rode `ferramentas\instalar-node.ps1`.
   - Suba um servidor de teste com banco temporário (`IEL_DADOS` e `IEL_PORTA=3999`), carregue a demonstração e confira as rotas principais.
5. **Combine comigo a Etapa 4** antes de programar: a seção 7 do HANDOFF tem a sugestão (histórico escolar, carta de concessão da bolsa, relatórios de fechamento, backup automático do banco, uso em rede nos 3 PCs). Me diga o que dá para fazer com o que já temos e o que depende de eu conseguir alguma informação.
6. **Teste de verdade** antes de me entregar:
   - `node --check` em todos os arquivos.
   - Scripts de teste de API contra o servidor de teste (inclusive com o perfil "aprendiz" e o teste de migração do banco antigo).
   - Prints das telas novas com o Edge headless, como descrito no HANDOFF.
   - Corrija o que encontrar.
7. **Entregue:**
   - Atualize o `HANDOFF.md` e este prompt.
   - Faça commit e push no repositório.
   - Me explique em linguagem simples o que mudou e como eu testo.

**Regras importantes**
- Responda sempre em **português**. Eu não sou programador, então explique de forma simples.
- **LGPD:** nunca envie ao GitHub dados reais de alunos (`dados/`, planilhas, fotos). Teste só com a demonstração. Modelos `.xlsx` novos passam antes por `ferramentas/sanitizar-modelos.js`.
- Não mude as decisões da seção 2 do HANDOFF sem me perguntar.
- Para as perguntas em aberto da seção 7, use um padrão sensato e configurável e me conte qual escolheu. Só me pergunte se for realmente impossível continuar sem a resposta.
- No começo, me lembre de duas coisas: **(1)** conferir se no PC da escola o documento "Atestado de inaptidão para Ed. Física" ainda está marcado como obrigatório (não deveria) e **(2)** mostrar para a Samara a tabela de padrões da Etapa 3 (seção 7 do HANDOFF), principalmente a isenção de 100% do filho de funcionário e a regra de que os descontos não somam.

Pode começar!

---
