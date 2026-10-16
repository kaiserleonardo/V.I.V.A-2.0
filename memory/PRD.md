# PRD — V.I.V.A Aprendizagem Visual Interativa

## Problema original
Melhorar muito a aparência do site existente, estudando o HTML de referência, sem bloquear funcionalidades. O produto é escolar, acessível e utilizado principalmente por pessoas com transtornos; deve fugir da aparência genérica de IA e funcionar bem em desktop e mobile.

## Arquitetura e decisões
- Frontend React com navegação interna por views e CSS responsivo próprio.
- Preferências, perfil local, matérias, anotações e histórico persistem em localStorage.
- Direção visual orgânica/editorial: slate escuro, verde folha, lima e coral, tipografia Manrope/DM Mono, composição assimétrica e linguagem acolhedora.
- A experiência prioriza previsibilidade, contraste, leitura confortável, redução de animações e síntese de voz do navegador.
- Geração de explicações e soluções está representada por conteúdo local MOCKADO para manter o fluxo visual sem expor chaves de API.

## Implementado
- Dashboard V.I.V.A com hero escolar neuroinclusivo, matérias, navegação lateral e menu mobile.
- Perfis Aluno/Professor com controle de acesso às Soluções e troca posterior de perfil.
- Matérias padrão, criação de nova matéria e seleção para estudo.
- Fluxo de explicação guiada, solução passo a passo e leitura em voz alta.
- Questionário com resposta, feedback e resultado.
- Anotações com criação, edição, autosave local e remoção.
- Histórico com revisão e limpeza.
- Configurações: tema, texto, redução de animações e leitura em voz alta persistente.
- Test IDs em controles e informações críticas para fluxos de validação.
- Hero atualizado para uma imagem de estudo escolar mais cotidiana, mantendo o foco no aprendizado e a composição responsiva.
- Hero refinado com nova imagem de sala de aula no mesmo contexto escolar, `data-testid` no bloco visual e validação de carregamento da imagem.
- (16/07/2026) Contas reais com e-mail + senha (bcrypt + JWT, proteção contra força bruta, seed de admin) e banco de dados MongoDB ligado ao app: matérias, anotações e histórico sincronizam automaticamente com a conta e migram do navegador no primeiro login. Preferências visuais continuam locais. Verificado ponta a ponta: registro → anotação salva no banco → logout → login → dados restaurados.
- (16/07/2026) IA real restaurada em todas as áreas, como no site original: explicações, soluções passo a passo, questionários (5/10/15 perguntas por matéria/tema, com feedback e explicação por questão) e ilustrações didáticas com botão de regerar — tudo via Pollinations (mesmos prompts do HTML original), com a chave API agora segura no backend (não mais exposta no navegador). Seletor de modelo de imagem nas Configurações (GPT Image, FLUX.1, FLUX Realismo, SeeDream 5.0 Pro, SDXL Turbo) com mapeamento para os modelos atuais do catálogo Pollinations. Verificado ponta a ponta com chamadas reais.
- (16/07/2026) Removido o selo circular "ESTUDO COM CALMA" do hero a pedido do usuário.
- (16/07/2026) Correção P0 de overflow de texto: modal de perfil reestruturado (texto agrupado em coluna própria na grade), `min-width: 0` + `overflow-wrap` aplicados em chip de perfil, cartões de matérias, histórico, anotações, configurações, quiz e títulos. Verificado em 375/768/1366px e em teste de estresse com fonte Extra grande + textos longos: zero overflow.
- (16/07/2026) Polimento de movimento: animações de entrada suaves (fade/slide escalonado) que são automaticamente desativadas pela opção "Reduzir animações", rolagem suave e contorno de foco visível para navegação por teclado.

## Backlog priorizado
- P1: Adicionar edição e exclusão de matérias diretamente nos cartões.
- P1: Persistir questionários concluídos no histórico de estudos.
- P2: Criar modo de foco com temporizador visual e pausas personalizáveis.