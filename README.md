# Missão SIPAT 2026

Versão estática preparada para publicação no GitHub Pages.

- Jogo: `index.html`
- Painel administrativo: `resultados.html`
- O cadastro e o ranking usam a API configurada em `runtime-config.js`.
- Matrículas não são exibidas no ranking público.
- A versão mobile usa a área visível real do navegador e adapta o tabuleiro para Android em modo horizontal.
- Ao confirmar o cadastro ou tocar em **COMEÇAR FASE**, o jogo tenta entrar em tela cheia no Android e em navegadores compatíveis. O botão **SAIR** fica disponível durante a fase.
- A atualização dos sprites e da física é estabilizada em 60 quadros por segundo em Android e Apple, inclusive em telas de 90 Hz e 120 Hz.
- Se o Safari do iPhone não oferecer tela cheia para páginas comuns, o jogo continua no layout móvel otimizado usando a área visível do navegador.

Após publicar, configure a origem autorizada da API para o domínio do GitHub Pages.

## Atualização no GitHub Pages

Envie todo o conteúdo deste pacote para a raiz do repositório, substituindo os arquivos existentes. Não envie apenas a pasta `assets`.

Depois do envio, aguarde a conclusão da publicação do GitHub Pages e, no celular, abra o endereço em uma nova guia ou atualize a página ignorando o cache.
