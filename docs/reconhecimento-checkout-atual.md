# Checkout atual — reconhecimento (27/10/2026)

Levantamento para a revisão do fluxo "Finalizar compra" (sem cadastro) da DeoBeauty, feito antes do protótipo. Descreve o checkout que está no ar, não o protótipo deste repositório.
Fontes: site deobeauty.me (tema Shopify **Horizon 3.5.1**, script `deo-checkout-fases.js`) e 12 capturas de tela do checkout atual (não incluídas).

---

## 1. Fluxo atual (como está nas capturas de tela)

**Modal "Finalizar compra"** — "Sem cadastro e sem senha. Leva menos de 1 minuto." · stepper `1 Você · 2 CEP · 3 Pagamento · 4 Entrega`

| Passo | O que pede | Observações |
|---|---|---|
| 1 Você | WhatsApp **ou** e-mail (chips de alternância + 1 campo) | Ajuda: "Para enviar a confirmação e o rastreio do pedido." · link de fuga "Prefiro preencher tudo na página de pagamento" |
| 2 CEP | CEP | Busca no ViaCEP → mostra cidade/UF, rua e bairro + 1 cotação de frete (a mais barata). Link "Não sei meu CEP". Botão desabilitado até CEP válido |
| 3 Pagamento | Pix ("Aprovação na hora") ou Cartão ("em até 6x sem juros") | Boleto existe no código, desligado por flag |
| 4 Entrega | Número (ou "Sem número"), Complemento (opcional), Nome de quem recebe, 2º contato, Frete, Cupom (opcional) | Card "Entregar em" com endereço do CEP + "alterar CEP"; resumo "Pix · trocar"; CTA "Ir para o pagamento" |

**Checkout Shopify** — breadcrumb `Informações > Pagamento`
- Resumo: Contato · Enviar para · Frete
- **CPF/CNPJ** ("Informações adicionais", sem marcação de opcional)
- Pagamento de novo: Cartão / Pix · cartão pede número, validade, CVV, nome (pré-preenchido), parcelas
- "O endereço da fatura do cartão é o mesmo da entrega?" (Sim / Não)
- "Pagar agora" → modal Pix com QR + "Copie o código Pix" e contador (~7 min)

### Comportamentos que estão no código e não aparecem nas capturas
- **Código de 6 dígitos** (WhatsApp/SMS/e-mail) para cliente recorrente preencher os dados; "Continuar sem código"; "Não é você?"
- **Memória local** (`localStorage`, 180 dias): cliente que volta pula direto para o passo 3 ou 4
- 2º contato condicional: entrou com WhatsApp → pede "E-mail para receber o recibo do pedido"; entrou com e-mail → pede "WhatsApp para acompanhar a entrega"
- Cidade/UF manuais quando o ViaCEP devolve endereço incompleto
- Fretes "dominados" (mais caros **e** mais lentos) são escondidos
- Abre o pagamento via pedido rascunho; se falhar, cai em `/checkout?…` com dados pré-preenchidos
- Nome precisa de 2+ palavras (vira first_name / last_name)

---

## 2. Dados indispensáveis para concluir a compra

| # | Dado | Onde é pedido hoje | Obrigatório? |
|---|---|---|---|
| 1 | Contato (WhatsApp ou e-mail) | Modal · passo 1 | Sim |
| 2 | CEP (→ rua, bairro, cidade, UF) | Modal · passo 2 | Sim |
| 3 | Número (ou "sem número") | Modal · passo 4 | Sim |
| 4 | Complemento | Modal · passo 4 | Não |
| 5 | Nome e sobrenome de quem recebe | Modal · passo 4 | Sim |
| 6 | 2º contato (e-mail p/ recibo ou WhatsApp p/ entrega) | Modal · passo 4 | Condicional |
| 7 | Frete | Modal · passos 2 e 4 | Sim (vem pré-selecionado) |
| 8 | Cupom | Modal · passo 4 | Não |
| 9 | Forma de pagamento | Modal · passo 3 **e** Shopify | Sim |
| 10 | CPF/CNPJ | Só no Shopify | Sim (aparenta) |
| 11 | Cartão: número, validade, CVV, nome, parcelas | Shopify | Só cartão |
| 12 | Endereço de cobrança | Shopify | Só cartão (mas aparece no Pix) |

**Compra no Pix hoje:** ~6 campos no modal + CPF + reescolher Pix no Shopify + "Pagar agora".

---

## 3. Pontos de atrito observados

1. **Pagamento escolhido duas vezes e a escolha se perde.** Nas capturas: resumo "Pix" no modal → Shopify abre com Cartão selecionado → erro "Escolha um plano de parcelamento". (Hoje a escolha só vai como atributo `_deo_pagamento`.)
2. **CPF aparece de surpresa** no Shopify, depois de prometer "menos de 1 minuto".
3. **Pergunta de endereço da fatura aparece com Pix selecionado** (o próprio texto diz "Só muda se pagar com cartão").
4. **Frete possivelmente divergente:** modal com Anjun R$ 9,90 selecionado; Shopify mostra J&T Express R$ 10,00 ("Envia depois"). Confirmar se houve troca manual.
5. **Frete mostrado duas vezes** (cotação no passo 2, escolha no passo 4).
6. **Ordem dos passos:** Pagamento antes de Entrega, e o passo 4 é o mais longo (rola dentro do modal) — os 4 passos não têm peso parecido.
7. **Dois indicadores de progresso:** stepper de 4 passos no modal + breadcrumb "Informações > Pagamento" no Shopify (a etapa "Informações" o usuário nunca viu).
8. **Placeholder com cara de dado preenchido:** "(11) 91234-5678" e "Apto, bloco, casa" em cinza escuro.
9. **Três cores de CTA na mesma jornada** (ver §4).

---

## 4. Design system (deobeauty.me)

**Fontes:** Playfair Display 400/600 (títulos) · DM Sans 400/500/700 (interface e texto). Corpo 16px / 1.6.

**Cores (`--deo-*`)**

| Token | Valor | Uso |
|---|---|---|
| `--deo-tinta` | `#1A1416` | Texto, botão do modal, chip ativo, barra de aviso |
| `--deo-rose` | `#A8325A` | Primária do tema, botão "Comprar" (outline), passo ativo, foco |
| `--deo-rose-hover` | `#8C2549` | Hover da primária |
| `--deo-blush` | `#F3DDE3` | Texto da barra de aviso, acentos |
| `--deo-creme` / `--deo-suave` | `#F8F3EF` | Superfície suave (card "Entregar em", resumo) |
| `--deo-borda` | `#EADFDB` | Bordas e inputs |
| `--deo-texto-2` | `#6E6266` | Texto secundário |
| `--deo-dourado` | `#B08A4A` | Acento |
| `--deo-fundo` | `#FFFFFF` | Fundo |

**Escala de espaço:** 4 · 8 · 12 · 16 · 24 · 40 · **Raios:** 16px (cards/modal), 999px (botões, inputs, chips) · **Alvo de toque:** 48px · **Sombra popover:** `0 4px 20px rgb(0 0 0 / .15)` · **Hover:** lift 4px, .25s ease-out

**Componentes do modal (`.dck`)**
- Input 48px, pílula, borda `--deo-borda`, foco com contorno `--deo-tinta`, erro com borda `--deo-rose`
- Botão primário 52px, `--deo-tinta`, branco; desabilitado com opacidade .55; secundário branco com borda tinta
- Chip 36px, pílula; ativo em tinta
- Opção (radio card) min 56px, título 15px/600, apoio 13px `--deo-texto-2`; selecionada com borda dupla tinta
- Resumo: fundo `--deo-suave`, 14px
- Foco visível dos botões/links: contorno `--deo-rose`

**Inconsistências de marca na jornada**
- CTA: site `#A8325A` (rose) → modal `#1A1416` (tinta) → Shopify `#7F4158` (vinho fora do token)
- Superfícies do Shopify: lateral `#F8F0F2`, opção selecionada `#FAF5F7` — próximas, mas fora dos tokens creme/blush
- Tipografia do checkout Shopify aparenta ser a padrão, não DM Sans
- Avaliações (Judge.me) usam verde-azulado `#108474`, fora da paleta

**Tom de voz:** acolhedor, direto, frases curtas, tranquilizador ("Sem cadastro e sem senha", "Pagamento seguro na próxima tela"). Prova social constante (RA 1000, nota 8,7).
