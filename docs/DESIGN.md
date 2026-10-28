# Checkout rápido DeoBeauty · Design

Contrato visual do protótipo. Fonte: site deobeauty.me (tema Shopify Horizon 3.5.1, tokens `--deo-*`) e as decisões das rodadas 1 e 2 (ver [decisoes.md](decisoes.md)). Versão atual: **v3**, com os ajustes da v3.1.

## Direção
A loja continua na tela: branco é o balcão, creme é a sacola (resumo e superfícies suaves), rosa é a ação, tinta é o texto e a seleção, verde é o "deu certo". Playfair Display só em títulos; DM Sans em tudo que se lê e se toca (inclusive o total). Sem degradê; sombra só no que flutua (sacola aberta, resumo do celular). Tema único claro, como a loja.

## Tokens (`css/app.css`)
| Token | Valor | Uso |
|---|---|---|
| `--tinta` | `#1A1416` | texto, seleção, etapa concluída |
| `--rose` | `#A8325A` | botão principal, etapa atual, foco |
| `--rose-h` | `#8C2549` | hover do botão; texto sobre blush |
| `--blush` | `#F3DDE3` | opção escolhida, selos, cupom aplicado |
| `--creme` | `#F8F3EF` | resumo, sacola, "Seu pedido" da confirmação, cartão do endereço |
| `--borda` | `#EADFDB` | divisórias |
| `--borda-forte` | `#968A8E` | borda dos campos |
| `--texto-2` | `#6E6266` | texto secundário, ajudas |
| `--dourado` | `#B08A4A` | acento raro |
| `--ok` | `#2E7D4F` | confirmação, desconto, selo RA, selo de aprovado |
| `--erro` | `#B42318` | erros e aviso de recusa |

Espaços 4/8/12/16/24/40 · raios 16 (cartões), 12 (campos), 999 (botões, selos) · alvo 48 px · easing `cubic-bezier(.2,.7,.2,1)`.

## Tipografia
- Títulos de etapa e de tela: Playfair 400, 28 px (celular) / 34 px (computador), `text-wrap: balance`.
- "Etapa N de 3": DM Sans 12 px, 700, caixa alta, `letter-spacing .12em`.
- Campos e corpo: DM Sans 16 px; ajudas 13 px.
- Total: DM Sans negrito; os dígitos têm a mesma largura (`.dg`), então o valor não anda quando muda (r2-q18).

## Layout
- Celular primeiro (320, 375, 768, 1024, 1280). Tablet 600–1023 px: coluna das etapas com 640 px, centrada. Computador: etapas à esquerda + coluna creme "Seu pedido" de 400 px; logo e "Compra segura" alinhados às colunas.
- Celular: fotos + total + botão fixos no rodapé; o resumo abre por cima com fundo creme.

## Peças do checkout (v2, mantidas)
- **Indicador de etapas**: 3 trilhos de 4 px; concluída = tinta, atual = rosa, futura = borda.
- **Linha de etapa concluída**: cartão branco com borda, ✓ em círculo tinta, dados e "Alterar"; o botão da etapa diz para onde vai de verdade.
- **Campo**: 56 px, rótulo dentro que sobe ao digitar (também em "Quem vai receber" e no cupom), ajuda abaixo, erro com ícone.
- **Opção (frete/pagamento)**: cartão raio 16, mínimo 64 px; escolhida = blush com borda rosa escura.
- **Botão principal**: rosa, 52 px, pílula, valor exato ("Pagar R$ 159,70 com Pix"); ocupado = "Gerando o seu Pix…" / "Confirmando com o banco…".

## Telas da v3 (rodada 2)
- **Sacola** (`gv-`, r2-d4 C com ajuste): painel lateral creme no computador e folha no celular. Itens com foto, família olfativa (só aqui), quantidade com lixeira/+. Cartão branco único com a meta "Faltam R$ X para o frete grátis" (trilho) e "Para combinar com seu Sweet Petals": loção hidratante 200 ml e eau de parfum 100 ml com "Adicionar" e selo "Completa os R$ 199". Sem CEP nem frete. Rodapé: subtotal, parcelas, "Finalizar compra", "Frete e cupom você vê na próxima etapa", "Continuar comprando".
- **Tela do Pix** (`px-`, r2-d1 B): título "Agora é só pagar o Pix", cartão branco com QR de exemplo, valor, relógio "Vale até…", 4 passos, código copia e cola + "Copiar código Pix", faixa creme "Esperando seu Pix" com pontinho rosa. Pix vencido (r2-d5 A): aviso e "Gerar novo código Pix" na própria tela.
- **Recusa do cartão** (`er-`, r2-d5 A): aviso vermelho claro no começo da etapa 3, título "O banco não aprovou o pagamento", "Pagar R$ … com Pix" e "Usar outro cartão"; a opção do cartão não fica vermelha; os dados do cartão ficam.
- **Pedido confirmado** (`ok-`, r2-d2 C): selo verde + "Pedido #1043" [a confirmar], "Pedido confirmado, Marina", faixa creme do WhatsApp, linha do tempo "O que acontece agora" (aprovado ✓, separação = próximo passo, envio, entrega com previsão e endereço), "Voltar à loja" e "Dúvidas sobre o pedido? Fale com a gente"; coluna creme "Seu pedido" sem família olfativa. Só no protótipo (v3.1): "Simular nova compra (só no protótipo)", no mesmo desenho do "Simular Pix recebido".
- **Cliente que volta** (`cv-`, r2-d3 C): cartão "Oi de novo, Marina!" com inicial em círculo rosa, "Não é você?", WhatsApp / Entrega / CPF com dados em parte escondidos e "Alterar"/"Trocar"; ver tudo ou alterar pede o código de 6 números pelo WhatsApp.

## Movimento
- Entre etapas (v2, r1-d7 B): a etapa concluída vira a linha de resumo e a próxima entra colada (0,38 s). "Alterar" ajusta a posição de uma vez antes de mostrar a etapa.
- Resumo do celular sobe 0,28 s e desce 0,22 s. Trilho de frete grátis 0,4 s. Cupom aplicado: o que está abaixo desliza 0,3 s.
- Aprovação (r2-d7 B): o pontinho do Pix (ou o botão de pagar no cartão/carteira) cresce e vira o selo verde; título, número e recibo entram logo atrás (legível em 0,44 s, parado em 0,68 s).
- Tudo dentro de `prefers-reduced-motion:no-preference`; com "reduzir movimento", troca na hora.
