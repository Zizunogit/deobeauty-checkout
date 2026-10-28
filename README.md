# Checkout rápido DeoBeauty · protótipo (v3.1)

Protótipo navegável do checkout **sem cadastro** da DeoBeauty. A pessoa sai da sacola da loja e informa só o que é indispensável. São três etapas:

1. **Contato**: nome, WhatsApp e e-mail opcional.
2. **Entrega**: CEP, número e frete.
3. **Pagamento**: Pix, cartão ou carteira digital, com o CPF para a nota.

Depois de pagar, a pessoa vê a tela do pedido confirmado.

Tudo roda no navegador, com dados simulados. Não há servidor, nada é cobrado e nenhum dado sai do aparelho. O visual segue o site deobeauty.me: Playfair Display nos títulos, DM Sans no resto, rosa para as ações e creme para o resumo.

> Protótipo de estudo de UX/UI. Marca, fotos de produto e textos são da DeoBeauty e não estão liberados para outros usos.

## Como abrir

- **Direto no navegador**: abra o `index.html` com dois cliques. Não precisa instalar nada.
- **Servidor local** (recomendado para testar "Lembrar meus dados"): na pasta do repositório, rode `python3 -m http.server 8000` e abra http://localhost:8000.
- **GitHub Pages**: em *Settings → Pages*, escolha *Deploy from a branch*, a branch `main` e a pasta `/ (root)`. O arquivo `.nojekyll` já está na raiz.
- **Atalho**: `index.html#checkout` abre direto no checkout, sem passar pela sacola.

## Roteiro rápido para testar

| Para ver… | Faça assim |
|---|---|
| Fluxo completo | A página abre na loja com a sacola aberta. Toque em **Finalizar compra** e preencha as 3 etapas. |
| Dados de exemplo | Marina Costa · (11) 98765-4321 · marina.costa@email.com · CEP 05121-120, nº 220 · CPF 529.982.247-25 |
| Cupom | `DEOQUIZ10` (10% de desconto) |
| Endereço preenchido à mão | Use um CEP que o protótipo não conhece, como `99999-999`. |
| Pix | Pague com Pix e, na tela do Pix, toque em **Simular Pix recebido (só no protótipo)**. O QR e o código são desenhos de EXEMPLO. |
| Cartão aprovado | `4111 1111 1111 1111`, validade `08/29`, CVV `123` |
| Cartão recusado | Qualquer cartão com final `0002`, como `4000 0000 0000 0002` |
| Cliente que volta | Marque **Lembrar meus dados neste aparelho** antes de pagar. Depois use **Simular nova compra** e finalize de novo: aparece o "Oi de novo, Marina!". O código de exemplo é `123456`. |
| Comprar de novo | Na tela de pedido confirmado, toque em **Simular nova compra (só no protótipo)**. A sacola de exemplo volta e o fluxo recomeça. |

Os botões tracejados com "(só no protótipo)" existem só para simular o que, no site, viria do banco ou da loja.

## Estrutura

```
index.html            página (marcação das 3 etapas e do resumo; módulos montam o resto)
css/                  7 folhas: app (núcleo) + uma por módulo
js/                   7 scripts: app (núcleo) + uma por módulo
img/                  logo e fotos dos produtos (copiadas da loja)
docs/                 design, decisões e notas de cada módulo
testes/               testes automáticos (Playwright) e capturas de tela
```

Nenhuma pasta passa de 100 arquivos. A maior (`testes/`) tem 11.

| Arquivos | Prefixo | O quê |
|---|---|---|
| `css/app.css`, `js/app.js` | — | **Núcleo**: dados simulados, textos, as 3 etapas, validações, resumo, cupom, movimento entre etapas e o contrato `window.DeoCK`. |
| `js/sacola.js`, `css/sacola.css` | `gv-` | Loja de exemplo e sacola: meta de frete grátis, sugestões da mesma linha e "Finalizar compra". |
| `js/volta.js`, `css/volta.css` | `cv-` | Cliente que volta: "Lembrar meus dados", "Oi de novo" e código de 6 números. |
| `js/pix.js`, `css/pix.css` | `px-` | Tela própria do Pix e Pix vencido. |
| `js/confirmacao.js`, `css/confirmacao.css` | `ok-` | Pedido confirmado ("O que acontece agora") e "Simular nova compra". |
| `js/movimento.js`, `css/movimento.css` | `mv-` | Passagem para a confirmação: o sinal de espera vira o selo de aprovado. |
| `js/pagamento.js`, `css/falha.css` | `er-` | O que acontece depois de "Pagar": Pix, cartão, carteira e recusa do cartão. |

Ordem de carga, que importa: CSS `app, sacola, volta, pix, confirmacao, movimento, falha`; JS `app, sacola, volta, pix, confirmacao, movimento, pagamento`. JavaScript puro, sem framework e sem etapa de build. Os textos de cada módulo ficam num objeto `T` no começo do arquivo.

## Como os módulos conversam

O núcleo expõe `window.DeoCK`, e os módulos só falam com ele por esse objeto e por eventos no `document`.

- **Estado e dados**:
  - `estado`: estado do checkout.
  - `pedido()`: retrato do pedido.
  - `itens()`: lista viva da sacola.
  - `atualizarItens()`: redesenha depois de mudar os itens.
  - `regras`: frete grátis e parcelas.
  - `brl(v)`: formata o valor em reais.
- **Navegação**:
  - `tela(nome)`: `loja`, `checkout`, `pix` ou `confirmacao`; é o mesmo valor de `<html data-tela>`.
  - `abrirCheckout()`.
  - `irPara(k, {foco})`.
  - `resumo(abrir)`.
- **Pagamento**:
  - `aoPagar(info)`: definido pelo `pagamento.js`.
  - `pagar()`.
  - `ocupado(on)`.
  - `validar(k)`.
- **Preencher e limpar**:
  - `preencher(dados)`.
  - `marcarFeitas([1,2])`.
  - `limpar()`.
  - `limparCartao()`.
  - `novaCompra()`: v3.1, só no protótipo.
- **Para testes e capturas**:
  - `exemplo(etapa, {pag, cupom, cep})`.
  - `pagarExemplo({pag})`.
  - Ganchos por módulo: `DeoCK.gv`, `.cv`, `.px`, `.ok`, `.mv`, `.er`. Estão descritos nas páginas de `docs/modulos/`.
- **Eventos**: `deo:pronto`, `deo:tela`, `deo:checkout`, `deo:etapa`, `deo:itens`, `deo:aprovado {info, slot}`, `deo:nova-compra`.
- **Lugares reservados para os módulos**: `#slot-contato`, `#slot-pagamento-topo` e `#slot-pagamento-fim`. Os links da loja levam o atributo `data-loja`.

Exemplo no console do navegador: `DeoCK.abrirCheckout(); DeoCK.exemplo(3, {pag: 'cartao'})` leva direto ao pagamento com cartão preenchido.

## O que é simulado

- CEP, frete, cupom, Pix, cartão, carteira digital, código do WhatsApp e cadastro da loja são todos simulados.
- "Lembrar meus dados" grava no próprio navegador (`localStorage`). No site real, o aparelho guardaria só uma chave, e os dados ficariam no servidor da loja (ver `docs/modulos/volta.md`).
- Os pontos que dependem da loja estão marcados no código como **[a confirmar]**. A lista completa está no fim de [docs/decisoes.md](docs/decisoes.md). Entre eles:
  - Apple Pay e Google Pay;
  - validade do Pix;
  - número do pedido;
  - mensagens pelo WhatsApp;
  - nome na fatura;
  - política de trocas.

## Levar para a Shopify

Cada página de módulo em `docs/modulos/` diz o que vira o quê no site. Por exemplo, a sacola usa `/cart/change.js` e `/cart/add.js`, o pagamento usa o provedor e o cliente que volta usa uma chave opaca gravada pelo servidor. Os botões "(só no protótipo)" e o `DeoCK.novaCompra()` não vão para o site.

## Testes

Seis testes automáticos (Playwright) cobrem o fluxo completo em 320, 375, 768 e 1280 px. Eles testam teclado, leitor de tela, "reduzir movimento" e cada módulo. Na v3.1 foram **1.370 verificações, 0 falhas**.

```
pip install -r testes/requirements.txt
python -m playwright install chromium
python testes/rodar_todos.py
```

Detalhes em [testes/README.md](testes/README.md).

## Documentação

- [docs/DESIGN.md](docs/DESIGN.md): cores, tipografia, peças e movimento.
- [docs/decisoes.md](docs/decisoes.md): por que cada tela é assim (rodadas 1 e 2 e v3.1).
- [docs/modulos/](docs/modulos/): sacola, cliente que volta e pagamento (Pix, confirmação, recusa, movimento).
- [docs/reconhecimento-checkout-atual.md](docs/reconhecimento-checkout-atual.md): levantamento do checkout que está no ar.
