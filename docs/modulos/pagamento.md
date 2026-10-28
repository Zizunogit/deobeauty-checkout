# Módulo pagamento · v3 (r2-d1 B, r2-d2 C, r2-d5 A, r2-d7 B)

O que acontece depois de "Pagar": tela do Pix, recusa do cartão, Pix vencido, confirmação do pedido e o movimento da aprovação. Único módulo que define `DeoCK.aoPagar`.

## Arquivos e ordem de carga

Depois do `app.css` / `app.js` e dos módulos sacola e volta:

```html
<link rel="stylesheet" href="css/pix.css">
<link rel="stylesheet" href="css/confirmacao.css">
<link rel="stylesheet" href="css/movimento.css">
<link rel="stylesheet" href="css/falha.css">

<script src="js/pix.js"></script>
<script src="js/confirmacao.js"></script>
<script src="js/movimento.js"></script>
<script src="js/pagamento.js"></script>
```

| Arquivo | Prefixo | O que faz |
|---|---|---|
| `js/pix.js` + `css/pix.css` | `px-` | Tela do Pix (d1 B) e o estado vencido (textos da d5 A). Expõe `DeoCK.px`. |
| `js/confirmacao.js` + `css/confirmacao.css` | `ok-` | Pedido confirmado (d2 C), sem família olfativa (d6 A). Expõe `DeoCK.ok`. |
| `js/movimento.js` + `css/movimento.css` | `mv-` | Passagem da aprovação (d7 B). Expõe `DeoCK.mv`. |
| `js/pagamento.js` + `css/falha.css` | `er-` | Define `DeoCK.aoPagar`: espera, recusa do cartão (d5 A), aprovação. Expõe `DeoCK.er`. `falha.css` também estiliza o aviso do Pix vencido. |

`pagamento.js` precisa dos outros três carregados antes. Se faltar algum, ele não liga e o núcleo segue sem as telas depois do pagamento.

## Fluxo

1. O núcleo valida as 3 etapas, deixa o botão ocupado e chama `aoPagar(info)`. A função devolve `true` sempre.
2. Depois da espera (Pix 0,8 s · cartão 1,2 s · carteira 1 s; em `DeoCK.er.esperas`):
   - **Pix**: abre a tela do Pix (`DeoCK.tela('pix')`) e põe o foco no título.
   - **Cartão terminado em 0002**: é a recusa simulada. Mantém os dados do cartão (o aviso diz "seus dados continuam aqui") e chama `ocupado(false)` e `resumo(false)`; só "Usar outro cartão" chama `limparCartao()`. O aviso entra em `#slot-pagamento-topo`, a página rola até ele e o foco vai para o título. O aviso fica enquanto a pessoa troca o cartão. Uma nova recusa troca o aviso por outro (fica sempre um só). Ele sai quando um pagamento é aprovado ou quando a tela do Pix abre.
   - **Outros cartões e a carteira**: aprovado.
   - Se durante a espera a pessoa saiu da etapa 3 (tocou em "Alterar"), nada acontece e o botão é liberado.
3. **Aprovado** (`aprovar` em `js/pagamento.js`):
   - mede a tela que sai (`DeoCK.mv.medir`), tira o aviso de recusa e fecha o Pix;
   - monta a confirmação (`DeoCK.ok.montar`) e chama `DeoCK.tela('confirmacao')`;
   - volta ao topo e põe o foco em "Pedido confirmado, Marina", que o leitor de tela anuncia junto com o número e a frase (`aria-describedby`);
   - dispara `deo:aprovado {info, slot}` e toca o movimento (`DeoCK.mv.tocar`).
4. O botão de pagar continua ocupado enquanto a tela do Pix ou a confirmação estão abertas. Ele é liberado com `ocupado(false)` quando a pessoa volta à etapa 3 ("Não paguei, quero trocar", "Pagar com cartão", recusa) e quando algum módulo tira a tela da confirmação (`deo:tela` com `antes: 'confirmacao'`).

### Tela do Pix (d1 B)
- **Celular**, nesta ordem (é também a ordem do Tab): valor e validade ("Vale até 11:22 · faltam 29:59"), código copia e cola, botão rosa "Copiar código Pix", dica, "Esperando seu Pix" com o pontinho rosa (um pulso a cada 2,4 s), "Passo a passo no app do banco" (abre e fecha) e "Ver QR Code · Para pagar com outro celular" (recolhido). No fim vêm a linha do pedido, "Trocar forma de pagamento" e "Simular Pix recebido (só no protótipo)".
- **Computador**: o QR grande fica à esquerda com o passo a passo de "Ler QR Code" ao lado. O código vem embaixo com um botão de contorno, e o status fica numa faixa creme com o botão "Simular".
- **Copiado**: o botão fica verde com ✓ e o texto "Código copiado". Depois de 5 s, vira "Copiar de novo". O aviso verde com o próximo passo continua na tela. Se o navegador não deixar copiar, aparece o aviso vermelho e o código fica selecionado para copiar à mão.
- **Validade** de 30 min [a confirmar com o provedor]. Nos 5 minutos finais ela fica rosa, e o leitor de tela avisa aos 5 min e a 1 min. Se a aba estava escondida, a conta é refeita quando ela volta.
- **Vencido**: aparece o aviso da d5 A ("O código Pix venceu", com o texto, "Gerar novo código Pix", "Pagar com cartão" e "Já pagou este código?…"). Código, QR, "Trocar" e "Simular" somem, e o foco vai para o título do aviso. "Gerar novo código Pix" cria um novo código fictício, reinicia a validade e põe o foco no botão de copiar. "Pagar com cartão" volta para a etapa 3 com o cartão escolhido e o foco no número.
- **Trocar forma de pagamento**: pergunta "Ainda não pagou o Pix?". "Não paguei, quero trocar" chama `tela('checkout')`, `irPara(3)` e `ocupado(false)`. "Já paguei, vou esperar" fecha a pergunta. Esc também fecha.
- **Voltar do navegador**: ao abrir, o Pix põe uma entrada no histórico (`{deo:'pix'}`). O "voltar" faz a pergunta acima em vez de sair, e com o código vencido leva à etapa 3. Ao trocar de forma, a entrada sai com `history.back()`, e o `popstate` dessa saída é ignorado. Na aprovação, ela vira `{deo:'confirmacao'}`. Enquanto o Pix usa o histórico, `history.scrollRestoration` fica `manual`.
- Se outro módulo levar a pessoa para fora e ela voltar pelo `abrirCheckout()` com o Pix em aberto, a tela do Pix reabre com o mesmo código (ouvindo `deo:checkout`).
- Código e QR são **sempre fictícios**: "EXEMPLO" no código, e o QR é um desenho com o selo EXEMPLO.

### Confirmação (d2 C)
- Selo "✓ Pedido #1043" (número de exemplo, formato [a confirmar]), "Pedido confirmado, Marina" e a frase.
- Aviso do WhatsApp em destaque. A linha do e-mail só aparece se houver e-mail.
- Linha do tempo com 4 passos:
  1. Pagamento aprovado, com a forma real: "Pix de R$ …", "3x de R$ … no cartão", "R$ … à vista no cartão" ou "R$ … com Apple Pay".
  2. Separação (próximo passo).
  3. Envio, com a transportadora.
  4. Entrega, com "Previsão:" e o endereço. "Quem recebe: …" aparece se for outra pessoa.
- Coluna creme "Seu pedido": fotos, nome e tipo (**sem família**), subtotal, desconto com cupom, frete com transportadora, total e "Pago no …". No cartão vem também "Na fatura, a compra aparece como DEOBEAUTY." [a confirmar]. Embaixo ficam os selos de confiança.
- "Voltar à loja" (`data-loja`) e "Dúvidas sobre o pedido? Fale com a gente" (por ora vai para a loja; o canal de atendimento está [a confirmar]).
- Só no protótipo (v3.1): "Simular nova compra (só no protótipo)", no mesmo desenho do "Simular Pix recebido". Chama `DeoCK.novaCompra()` e o fluxo recomeça na loja com a sacola de exemplo. No site esse botão não existe.
- `#ok-slot` (`.slot`, some vazio) é o lugar para avisos de outros módulos. Ele vem em `deo:aprovado`.
- A aba muda para "Pedido confirmado · DeoBeauty" e volta ao título anterior quando a tela sai da confirmação.

### Movimento (d7 B)
Só transform e opacity, com Web Animations. O DOM já trocou antes da passagem: foco, leitor de tela e toque não esperam nada.

| Tempo | O que acontece |
|---|---|
| 0–90 ms | A cópia inerte da tela que sai (sem ids, fora do leitor de tela, sem toque) se apaga subindo 6 px. |
| 0–440 ms | O selo verde nasce do tamanho, do lugar e da cor do pontinho rosa (Pix) ou do botão de pagar (cartão rosa, carteira preta). Ele voa até o lugar dele e assenta com um passo de 6 % além. O rosa (ou o preto) vira verde nos primeiros 90 ms. |
| 140–320 ms | O ✓ se revela da esquerda para a direita. |
| 90–405 ms | Os grupos entram subindo 12 px, com passo de 30 ms: número e título, frase e WhatsApp, linha do tempo e slot, recibo e botões. |
| 380–680 ms | Um anel sai do selo uma vez. |

- Tudo está legível em 0,44 s e parado em 0,68 s (o teste mede isso).
- Se a origem está fora da tela, o selo nasce pequeno no próprio lugar.
- Com "reduzir movimento", a troca é imediata, sem pulso nem passagem.
- Se a aprovação chega com a aba escondida, a troca acontece na hora e a passagem toca uma vez quando a aba volta (`visibilitychange`).

## Ganchos de teste e captura

| Gancho | O que faz |
|---|---|
| `DeoCK.px.exemplo()` | Preenche o exemplo e vai direto para a tela do Pix, sem a espera. |
| `DeoCK.px.copiado()` / `DeoCK.px.falhou()` / `DeoCK.px.copiar()` | Estado copiado, cópia que falhou, copiar de verdade. |
| `DeoCK.px.passos(bool)` / `DeoCK.px.qr(bool)` | Abre ou fecha o passo a passo e o QR (celular). |
| `DeoCK.px.faltam(min)` | Coloca a validade a `min` minutos do fim (ex.: `4.9` para o rosa). |
| `DeoCK.px.vencer()` / `DeoCK.px.novo()` | Código vencido; novo código. |
| `DeoCK.px.trocar(bool)` | Abre ou fecha a pergunta "Ainda não pagou o Pix?". |
| `DeoCK.px.aprovar()` | Igual a "Simular Pix recebido": confirmação com movimento. |
| `DeoCK.px.estado()` | `'aguardando'`, `'vencido'` ou `null`. |
| `DeoCK.ok.exemplo({pag, recebe, email, cupom})` | Vai direto para a confirmação. `pag`: `'pix'`, `'cartao'` (3x) ou `'carteira'`. `recebe: 'Ana Lima'` para outra pessoa receber. |
| `DeoCK.er.recusar()` | Cartão final 0002 e paga, como a pessoa faria (aviso em ~1,2 s). |
| `DeoCK.er.agora()` | A recusa na hora, para capturas. |
| `DeoCK.er.vencido()` | Tela do Pix já vencida. |
| `DeoCK.er.limpar()` | Tira o aviso de recusa. |
| `DeoCK.mv.pendente()` | `true` enquanto a passagem espera a aba voltar. `DeoCK.mv.tempos` traz os números da tabela acima. |

Uso interno entre os arquivos: `DeoCK.px.abrir/encerrar/raiz/titulo/ponto/ativo`, `DeoCK.ok.montar`, `DeoCK.mv.medir/tocar/limpar`.

## Como testar

O teste automático do módulo é `testes/qa_pagamento.py` (como rodar: [testes/README.md](../../testes/README.md)). Ele roda os fluxos em 375 e 1280 px e confere as larguras 320, 375, 768, 1024 e 1280. Cobre:
- Pix: copiar (com leitura da área de transferência), QR, passo a passo, validade rosa, vencer, gerar novo, trocar com Esc, "Já paguei", "voltar" do navegador e "Não paguei" (rolagem e histórico), "Pagar com cartão", simular recebido;
- teclado: ordem do Tab, Enter e Esc;
- cartão 3x; recusa 0002, depois Pix, depois aprovado; recusa e depois outro cartão; recusa com o resumo aberto;
- carteira;
- reduzir movimento; aba escondida;
- "Alterar" durante a espera; volta ao checkout com Pix aberto; modo página; outra pessoa recebe com cupom e sem e-mail;
- em todos: rolagem lateral e console.

Com a opção de capturas, ele grava as telas finais (`pix-*`, `recusa-*`, `ok-*`, `larg-*`) e os quadros do movimento (`mv-*`).

## Decisões onde as opções se cruzavam
- **Pix vencido**: o bloco "Este código venceu" da d1 B deu lugar ao aviso da d5 A (um padrão só para "o pagamento não passou"). Os dois botões ficam dentro do aviso. "Trocar forma de pagamento" e "Simular" somem no vencido, porque o aviso já oferece "Pagar com cartão".
- **Pix recebido**: a versão mínima da d1 B foi trocada pela confirmação d2 C. A passagem d7 B liga as duas telas: o pontinho de "Esperando seu Pix" vira o selo "✓ Pedido #1043".
- **Selo**: o selo da d7 B é o círculo verde de 24 px do selo da d2 C. O pontinho (12 px) cresce até ele. No cartão e na carteira, o selo sai do botão como um círculo da altura do botão, na cor que o botão tem na tela.
- **Textos**: "Esperando seu Pix" (d1 B, como no briefing da rodada 2) no lugar de "Esperando o seu Pix" (d7 B). "Simular Pix recebido (só no protótipo)" (briefing) no lugar de "Só no protótipo: Simular Pix aprovado". O pulso devagar é o da d7 B (2,4 s).
- **Família olfativa**: fora da confirmação, pela d6 A.
- **Onde fica a confirmação**: dentro do `#fluxo` (no `main`), e não depois do topo como na d2 C. Assim ela também funciona no modo janela. O que é do checkout sai por `html[data-tela=...]` com seletores de id, para a cópia inerte do movimento não ser escondida junto.
- **Layout fora do modo passos**: a grade de duas colunas (Pix e confirmação) vale fora do modo janela. No modo janela as telas ficam empilhadas e funcionam, mas não foram desenhadas para ele.
- **"Pagar com cartão" e "Usar outro cartão"**: levam o foco direto ao número do cartão (a intenção é digitar). "Não paguei, quero trocar" leva ao título da etapa 3, como pede o contrato.

## Pedidos ao núcleo (`js/app.js`)
1. **Depois de `deo:aprovado`, começar um pedido novo.** Hoje, se a sacola voltar à loja e reabrir o checkout, o mesmo pedido aparece pronto para pagar de novo (o botão é liberado ao sair da confirmação). Sugestão: `DeoCK.novoPedido()` no núcleo, ou a sacola esvazia ao ouvir `deo:aprovado`.
2. **Remover o aviso final da v2** (`#fim`, `abrirFim`, `T.fim*`). Com este módulo carregado, `aoPagar` sempre devolve `true` e esse aviso não aparece mais.
3. **`data-loja` da confirmação.** O botão "Voltar à loja" nasce na aprovação. A sacola precisa ouvir `[data-loja]` por delegação no `document`, ou ligar o botão em `deo:aprovado`.
4. **Histórico.** O Pix usa `pushState({deo:'pix'})` e `history.back()`. Se a sacola também usar o histórico, quem ouve `popstate` deve ignorar enquanto `data-tela` for `pix` ou quando `history.state.deo === 'pix'`. Vale combinar uma regra única.
5. **(opcional) Botão ocupado.** Hoje ele só troca o texto e fica com opacidade .8. A d5 A tinha um giro discreto no lugar do cadeado (`#btn-pagar[aria-busy="true"]`). O movimento já compensa essa opacidade ao pegar a cor do botão.
6. **(opcional) `role="dialog"` no `.corpo`.** Só faz sentido no modo janela. No modo passos, a tela do Pix e a confirmação ficam dentro de um "diálogo" chamado "Finalizar compra".
7. **(opcional) Reduzir movimento.** `*{transition-duration:.01ms!important}` cria transições de 0,01 ms em toda mudança de estilo, que aparecem em `document.getAnimations()`. `transition:none` evitaria isso. Não afeta o uso, só os testes.

**Situação na v3.1:** 1, 2, 3 e 6 estão resolvidos (a sacola volta vazia em `deo:aprovado` e `DeoCK.novaCompra()` recomeça o protótipo; o aviso final da v2 saiu; a sacola ouve `[data-loja]` por delegação no `document`; `role="dialog"` só no modo janela). O 4 só vale se outro módulo passar a usar o histórico (hoje só o Pix usa). 5 e 7 continuam em aberto.

## Riscos e pontos [a confirmar]
- **Dica da recusa e cartão limpo.** A dica "Liberou a compra no app do banco? É só pagar de novo." foi mantida como aprovada, mas com `limparCartao()` a pessoa precisa digitar o cartão de novo. Sugestão de texto: "Liberou a compra no app do banco? Digite o cartão de novo e pague."
- **A confirmar com a loja e os provedores:** validade do Pix (30 min), número do pedido (#1043), nome na fatura (DEOBEAUTY), as 4 mensagens do WhatsApp, o canal de "Fale com a gente" e o cancelamento da cobrança Pix ao trocar de forma (para não haver pagamento em dobro).
- **Cópia do código.** A Clipboard API precisa de HTTPS (ou localhost). Fora disso vale o `execCommand('copy')`, e se ele também falhar, o código fica selecionado com o aviso para copiar à mão.
- **Cópia do checkout na saída.** Na saída do checkout (cartão e carteira), a cópia inerte passa por cima do topo durante 90 ms. É de propósito, para a tela velha se apagar inteira.
- **Aba escondida.** A passagem com a aba escondida depende de `visibilitychange`. Se o evento não vier, a confirmação já está pronta e só a passagem não toca.
