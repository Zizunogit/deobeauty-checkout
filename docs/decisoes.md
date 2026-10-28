# Decisões do protótipo

Como o checkout chegou à v3.1. O protótipo foi feito por um time de seis papéis seniores: Design, UX, UI, UX Writer, Dev e Motion. As escolhas foram tomadas em **rodadas de decisão**. Em cada rodada o time apresentava de duas a três opções por tema, sempre com telas, prós e contras, e indicava a sua recomendação. Quem decidia era a pessoa responsável pelo produto, que podia aprovar, ajustar ou rejeitar cada opção. Só entrou no código o que foi aprovado ou pedido diretamente.

Os códigos citados no código-fonte e nas páginas dos módulos seguem o padrão `r2-d3 C`, que quer dizer Rodada 2, decisão 3, opção C.

## Linha do tempo

| Versão | Data | O que mudou |
|---|---|---|
| v1 | 27/10/2026 | Primeira versão, feita a partir do levantamento do checkout atual ([reconhecimento-checkout-atual.md](reconhecimento-checkout-atual.md)). |
| v2 | 28/10/2026 | Rodada 1 aplicada: 7 decisões, 9 itens de base e 15 correções. |
| v3 | 28/10/2026 | Rodada 2 aplicada: 7 decisões, 10 itens de base e 19 correções. Foi a última rodada. |
| v3.1 | 28/10/2026 | Ajuste pedido diretamente: "Simular nova compra (só no protótipo)" na confirmação. |

## Rodada 1 · v1 → v2

| # | Pergunta | Escolha | Como ficou |
|---|---|---|---|
| d1 | Como o checkout se organiza na tela? (UX + Design) | **A**, passo a passo numa página própria | Três etapas (Contato, Entrega, Pagamento) e um indicador de etapas. Os modos "página única" e "janela por cima da loja" existem no código (`html[data-modo]`), mas não foram escolhidos. |
| d2 | Em que ordem pedimos os dados? (UX) | **A**, com ajuste | Ajuste: como o WhatsApp é obrigatório, a etapa 1 mostra os 3 campos juntos. São Nome, WhatsApp (obrigatório) e E-mail (opcional). Saiu o campo único "WhatsApp ou e-mail". |
| d3 | Como o checkout fala com quem compra? (UX Writer) | **C**, calorosa e próxima | Títulos "Como a gente fala com você?", "Onde seu pedido vai chegar?" e "Falta pouco para ser seu". Os erros dizem o que fazer e trazem um exemplo. |
| d4 | Como devem ser botões, campos e opções? (UI) | **C**, campo compacto e escolha em blush | Campos de 56 px com o rótulo dentro e cantos de 12 px. A opção escolhida fica em blush com borda rosa escura. "CVV" no lugar de "Código de segurança". |
| d5 | Como o resumo do pedido acompanha a compra? (Design) | **C**, com ajuste | No celular, fotos, total e botão ficam fixos no rodapé e o resumo abre por cima. Ajuste: fundo creme no computador e no resumo aberto do celular. |
| d6 | Oferecemos Apple Pay e Google Pay? (Dev) | **C**, carteira como 3ª forma de pagar, na etapa 3 | Apple Pay no celular e Google Pay no computador, com botão preto. Ainda falta a loja confirmar se o provedor de pagamento aceita **[a confirmar]**. |
| d7 | Como a tela se move ao tocar em "Continuar"? (Motion) | **B**, a etapa vira a linha de resumo | Os campos sobem para a linha "Contato ✓" e a etapa seguinte entra colada, em 0,38 s. |

**Base (9 itens, todos mantidos)**:
- Pix e cartão na própria página.
- Botão com o valor e a forma de pagar, por exemplo "Pagar R$ 159,70 com Pix".
- CPF junto do pagamento, com o motivo ("vai na nota fiscal").
- Endereço da fatura só no cartão.
- Frete com data de chegada e os selos "Mais barato" e "Mais rápido".
- Exemplos escritos abaixo do campo.
- "Quem vai receber" já preenchido.
- Cupom no resumo.
- Meta de frete grátis só para CEP da capital de SP.

**Correções (15, todas aprovadas)**:
- Enter avança na etapa aberta, e a página confere as 3 etapas antes de pagar.
- Endereço manual com cidade e estado obrigatórios.
- Foco visível nos campos com erro.
- Página sem rolagem lateral em 320 px.
- Bordas dos campos mais escuras.
- Áreas de toque de 44 px ou mais.
- Previsão de entrega escrita como "Previsão: sex., 30/10".
- Ajustes de teclado e de leitor de tela.
- Respeito ao "reduzir movimento".

## Rodada 2 · v2 → v3 (telas novas, última rodada)

| # | Pergunta | Escolha | Como ficou |
|---|---|---|---|
| d1 | Como a pessoa paga o Pix depois de tocar em "Pagar"? (UX) | **B**, tela própria "Agora é só pagar o Pix" | QR de exemplo, código copia e cola, 4 passos e "Esperando seu Pix". O Pix vencido aparece dentro dessa mesma tela. A validade de 30 min está **[a confirmar]**. Módulo `px-` ([pagamento.md](modulos/pagamento.md)). |
| d2 | O que a pessoa vê quando o pagamento é aprovado? (UX Writer + Design) | **C**, "O que acontece agora" | "Pedido confirmado, Marina", seguido de uma linha do tempo em 4 passos, do WhatsApp em destaque e de "Seu pedido" em creme. O número #1043 é só um exemplo **[a confirmar]**. Módulo `ok-`. |
| d3 | Quem já comprou: como termina a compra em poucos toques? (Dev + UX) | **C**, lembrado no aparelho e código para ver ou mudar | Caixa "Lembrar meus dados neste aparelho". Na próxima compra aparece "Oi de novo, Marina!" com os dados em parte escondidos, e ver ou alterar pede um código de 6 números (exemplo: 123456). Em outro aparelho, o código preenche tudo. Módulo `cv-` ([volta.md](modulos/volta.md)). |
| d4 | Como a sacola da loja leva até o checkout? (Design) | **C**, com ajuste | Ajuste: o frete só é calculado no checkout. A sacola mostra quanto falta para o frete grátis e sugere produtos da mesma linha que já está na sacola: Sweet Petals loção hidratante 200 ml, R$ 49,90, e eau de parfum 100 ml, R$ 119,90. Módulo `gv-` ([sacola.md](modulos/sacola.md)). |
| d5 | Quando o cartão não passa ou o Pix vence? (UI + UX Writer) | **A**, aviso no começo da etapa de pagamento | O aviso traz "Pagar com Pix" e "Usar outro cartão" e diz que nada foi cobrado. Os dados do cartão continuam no formulário. Módulo `er-`. |
| d6 | Mostramos a família olfativa no resumo? (UI + Design) | **A**, como estava | A família olfativa aparece só na sacola da loja, não no resumo nem na confirmação. |
| d7 | Como a tela muda quando o pagamento é aprovado? (Motion) | **B**, o sinal de espera vira o selo de aprovado | O ponto rosa de "Esperando seu Pix" vira o selo verde. No cartão e na carteira, o selo nasce do botão de pagar. Tudo para em 0,7 s. Módulo `mv-`. |

**Base (10 itens, todos mantidos)**:
- Aviso verde abaixo do WhatsApp.
- Coluna creme de 400 px com divisórias.
- Total em DM Sans negrito.
- Apple Pay no celular e Google Pay no computador.
- Campos completos do endereço da fatura.
- Ajustes para 320 px.
- Quebras de linha do contato.
- Erros do cartão que somem ao corrigir.
- Tempos do resumo no celular.
- Conferência das 3 etapas ao pagar.

**Correções (19, todas aprovadas)**:
- Botão de pagar ocupado, que ignora um segundo toque.
- Toque duplo não pula etapa.
- Previsão que pula feriados nacionais.
- Textos do Pix, da troca e do WhatsApp.
- Parcela na opção do cartão.
- Ajustes para 320 px e para o tablet.
- Página não anunciada como "diálogo".
- "Alterar" sem dois movimentos.
- Botão que diz para onde vai.
- CEP trocado desmarca "Sem número" e zera o frete.
- Rótulo dentro do campo em "Quem vai receber" e no cupom.
- Dígitos de mesma largura no total.
- Barra do frete grátis e cupom com movimento.

**Ficaram de fora** (anotados para depois, sem implementar):
- Mensagens do pedido no WhatsApp.
- Acompanhar pedido sem senha.
- "Meus dados": ver e apagar.
- Comprar de novo.
- Notas do perfume ao tocar no item.
- Motivo da recusa do cartão.
- Movimento ao voltar por "Alterar".
- Pix salvo para quem volta.
- Indicador de etapas que se preenche.
- Movimento quando o valor muda.

## v3.1 · ajuste pedido diretamente

- **"Simular nova compra (só no protótipo)"** na tela de pedido confirmado. Antes, depois de confirmar, a sacola ficava vazia e só recarregando a página dava para repetir o fluxo. O botão tem o mesmo desenho do "Simular Pix recebido": pílula tracejada e a indicação "(só no protótipo)".
  - Ao tocar, volta a sacola de exemplo (Oud Passion e Sweet Petals body splash). O checkout é apagado (campos, etapas, frete, cupom, cartão) e a página volta para a loja com a sacola aberta, como na abertura.
  - Se a pessoa marcou "Lembrar meus dados", a memória do aparelho fica. Assim a nova compra abre no "Oi de novo" e dá para testar a compra de quem volta.
  - "Voltar à loja" continua como antes: a sacola fica vazia depois do pedido, como no site.
  - Código: `DeoCK.novaCompra()` no núcleo e o evento `deo:nova-compra`, que cada módulo usa para zerar o seu estado. Teste: `testes/qa_nova.py`. No site real, esse botão não existe.

## Ainda a confirmar com a loja

- Apple Pay e Google Pay no provedor de pagamento.
- Validade do Pix (30 min no protótipo).
- Formato do número do pedido (#1043 é exemplo).
- Mensagens e código de 6 números enviados pelo WhatsApp.
- Prazo de 180 dias para lembrar o cliente. O Safari pode apagar a memória do aparelho em 7 dias.
- Canal de atendimento do "Dúvidas sobre o pedido?".
- Nome que aparece na fatura do cartão.
- Política de trocas ("7 dias depois de receber").
- Limite de unidades por item.
