# Documentação

Documentos do protótipo do checkout rápido da DeoBeauty.

| Documento | O que tem |
|---|---|
| [DESIGN.md](DESIGN.md) | Contrato visual: direção, tokens de cor, tipografia, layout, peças do checkout, telas da v3 e movimento. |
| [decisoes.md](decisoes.md) | Histórico das decisões das rodadas 1 e 2 e dos ajustes da v3.1. |
| [modulos/sacola.md](modulos/sacola.md) | Módulo sacola (`gv-`): a sacola que abre na loja, meta de frete grátis, sugestão da mesma linha e ganchos `DeoCK.gv`. |
| [modulos/volta.md](modulos/volta.md) | Módulo cliente que volta (`cv-`): "Lembrar meus dados", cartão "Oi de novo", código de 6 números e ganchos `DeoCK.cv`. |
| [modulos/pagamento.md](modulos/pagamento.md) | Módulo pagamento (`px-`, `ok-`, `mv-`, `er-`): tela do Pix, recusa do cartão, pedido confirmado, movimento da aprovação e ganchos. |
| [reconhecimento-checkout-atual.md](reconhecimento-checkout-atual.md) | Levantamento do checkout que está no ar (fluxo, dados pedidos, pontos de atrito e design system do site), feito antes do protótipo. |
| [../testes/README.md](../testes/README.md) | Testes automáticos: o que cada um cobre e como rodar. |

Por onde começar: `DESIGN.md` para o visual, `decisoes.md` para entender por que cada tela é assim, e a página de cada módulo para o comportamento e os ganchos de teste.
