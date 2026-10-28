# Módulo sacola (prefixo `gv-`) · v3

Aprovado: **r2-d4 · C com ajuste**. O ajuste pedido na rodada: "O frete só deve ser calculado nas próximas etapas, vamos incluir a sugestão de um ou dois produtos que possam complementar a compra. A solução da opção B é boa, mas a apresentação e o layout precisa ser revisado e melhorado."

Arquivos: `js/sacola.js`, `css/sacola.css`. Carregar logo depois do `app.js` / `app.css` (ordem em `index.html`).

## O que faz
- **A página abre na loja com a sacola aberta**: no `deo:pronto` o módulo chama `DeoCK.tela("loja")` e abre a sacola sem movimento, com o foco no título. A cena é o `.loja-fundo` do núcleo (o CSS dele para `data-tela="loja"` está neste módulo; no núcleo ele só existia no modo janela).
- **Celular (< 600 px)**: sobe do rodapé (300 ms) e deixa à vista a faixa, o logo e o ícone da sacola da loja. **Tablet e computador (≥ 600 px)**: painel de 420 px preso ao ícone (8 px abaixo dele, com um bico apontando para o ícone, que fica "apertado" em blush por cima do véu); aparece de 8 px acima em 200 ms.
- **Itens em linhas curtas** (estrutura da C): foto no ladrilho branco (o mesmo do resumo do checkout), nome, tipo · tamanho, família olfativa com pontinho dourado (d6: só na sacola), preço da linha (+ "R$ 49,90 cada" com 2 ou mais) e o controle − / quantidade / +. Com 1 unidade o "−" vira lixeira. Tirar deixa a linha "… saiu da sacola. **Desfazer**" no mesmo lugar, enquanto a sacola estiver aberta.
- **Sem CEP e sem frete**: a meta é a regra da loja, sem prometer: "Faltam **R$ 49,20** para o frete grátis" + trilho + "Na capital de SP, em compras acima de R$ 199. O CEP confirma no checkout." Passou da meta: "**Frete grátis** liberado na capital de SP" + "Seu pedido passou de R$ 199. O CEP confirma no checkout." (textos da B). O trilho cresce em 420 ms. A conta usa a mesma regra do núcleo (subtotal − cupom ≥ R$ 199).
- **Sugestão da mesma linha** (da B): "Para combinar com seu Sweet Petals · Da mesma linha, só se você quiser." Até 2 produtos da **mesma linha de algo que já está na sacola** e que **não** estão nela (nem acabaram de sair, com Desfazer à mão). Hoje: Sweet Petals loção hidratante 200 ml R$ 49,90 e eau de parfum 100 ml R$ 119,90 (Floral frutado). O Oud Passion não tem linha no site: sozinho, não há sugestão. Selo blush "Completa os R$ 199" quando adicionar aquele produto alcança a meta. Botão "Adicionar" (44 px + 2 px de toque em volta = 48).
- **Rodapé fixo**: Subtotal + "ou 6x de … sem juros", **Finalizar compra** (rosa), a nota "Frete e cupom você vê na próxima etapa." e "Continuar comprando". Selos discretos (RA 1000, troca em 7 dias): no rodapé do painel; no celular, no fim da lista (o rodapé não cresce).
- **Tudo muda o checkout na hora**: +, −, remover, desfazer e adicionar mexem na lista viva `DeoCK.itens()` e chamam `DeoCK.atualizarItens()`.
- **Finalizar compra** → fecha a sacola sem movimento e chama `DeoCK.abrirCheckout()` (etapa aberta, foco no título).
- **Links `[data-loja]`** (logo e "Voltar à loja" do checkout, do Pix e o "Voltar à loja" da confirmação) → loja com a sacola aberta. Só o clique simples é interceptado (só quando o módulo está carregado); Ctrl/⌘/Shift + clique continuam abrindo a loja de verdade.
- **Depois do pedido confirmado** (`deo:aprovado`, ou saída da tela `confirmacao`): a sacola volta **vazia** ("Sua sacola está vazia · Os perfumes estão esperando por você." + "Continuar comprando"). A lista do núcleo não é mexida (o pagamento ainda pode ler o `pedido()`). Para recomeçar o protótipo: "Simular nova compra (só no protótipo)" na confirmação (v3.1: com `deo:nova-compra` a sacola de exemplo volta e a loja abre com a sacola aberta) ou recarregar a página.
- Se o checkout, o Pix ou a confirmação tomam a tela (`deo:tela`), a sacola sai sem movimento.

## Acessibilidade e movimento
- `role="dialog"` + `aria-modal="true"`, nome "Sua sacola · 2 itens"; foco no título ao abrir; Tab/Shift+Tab presos na sacola; **Esc**, X, véu e "Continuar comprando" fecham e o foco volta ao ícone. O ícone fica `inert` com a sacola aberta (no computador o clique nele cai no véu e fecha).
- Ícone: "Abrir sacola, 2 itens" + `aria-expanded`; contador visível.
- Região `role="status"` anuncia: "Sweet Petals body splash: 2 unidades. Subtotal R$ 199,70. Frete grátis liberado na capital de SP; o CEP confirma no checkout." (também saiu / voltou / entrou / "Agora faltam R$ 49,20…" / sacola vazia / limite de unidades).
- Foco: + e − continuam no mesmo botão (a linha é atualizada no lugar; o "−" que vira lixeira é o mesmo elemento); remover → "Desfazer"; desfazer → lixeira do item; adicionar → "+" do item novo.
- Alvos: ícone, fechar, Desfazer e "Continuar comprando" com 48 px; − / + com 40 × 38 visíveis e 44 × 48 de toque (`::after`); Adicionar 48 de toque.
- Movimento só em `prefers-reduced-motion: no-preference`, só transform/opacity: sobe 300 ms (celular) / aparece 8 px em 200 ms (painel) / trilho 420 ms / item novo chega de 8 px em 280 ms com um brilho blush que se apaga em 450 ms. Com "reduzir movimento", tudo troca na hora.

## Desenho: versões comparadas e a escolhida
As três versões abaixo foram desenhadas no mesmo código e comparadas lado a lado (os rascunhos não estão neste repositório).
- **V1 · sacola creme, sugestão num cartão branco**: itens e meta direto no creme, só a sugestão no branco. Calma, mas a meta perdia o destaque que a B tinha e ficava solta da sugestão.
- **V2 · balcão branco, bolso creme**: painel branco (como a C), meta + sugestão num bloco creme, conta em creme. Agrupa bem, mas são três áreas creme disputando (fotos, bloco, rodapé) e "creme é a sacola" se perde.
- **V3 · sacola creme + balcão branco (escolhida)**: a sacola é creme; **meta e sugestão juntas num cartão branco** — é a regra da loja e o que a loja oferece, no balcão, não o que já está na sacola. A leitura vira uma frase só: "Faltam R$ 49,20 para o frete grátis" → "Loção hidratante · R$ 49,90 · Completa os R$ 199". A meta ganha o destaque da B sem virar faixa promocional, e a sugestão fica visivelmente opcional ("só se você quiser", botão secundário contornado). Os itens no creme com o ladrilho branco são o mesmo desenho do resumo "Seu pedido" do checkout: a pessoa reconhece a sacola quando chega lá.
- Ajustes da B que motivaram o "revisar": preço órfão em linha própria, selo grande, botão Adicionar pesado, lixeira separada do controle, sugestão cortada pelo rodapé. Na v3: preço junto do tamanho, selo pequeno, Adicionar compacto com toque de 48, lixeira dentro do controle (C), rodapé fixo fora da área que rola (o rodapé "grudento" dentro da rolagem deixava uma linha cortada embaixo do botão quando sobrava pouco para rolar).
- 320 px: foto 52 px e, na sugestão, o botão desce para baixo do nome (nome e selo não espremem). "Eau de parfum ·" quebra depois do ponto; "100 ml" nunca quebra.

## Decisões onde as opções se cruzavam
- Estrutura da **C** (gaveta enxuta, rodapé/ícone, linhas curtas, lixeira no lugar do −, Desfazer) **sem** o CEP e a cotação; meta e sugestão da **B**.
- Família olfativa aparece nos itens da sacola (todas as opções de d4 mostravam; d6 tira só do resumo do checkout e da confirmação). Na sugestão não aparece (mesma linha = mesma família).
- Playfair só no título "Sua sacola" (na B/C o valor também era Playfair; aqui o valor é DM Sans, como pede o [DESIGN.md](../DESIGN.md)).
- O botão diz só "Finalizar compra" (sem o valor, como na r2): o valor está logo acima e ainda vai mudar com frete/cupom.
- Cupom: se a pessoa aplicou cupom no checkout e voltou, a sacola mostra "Cupom DEOQUIZ10 · − R$ …" acima do subtotal, o subtotal já com o desconto, e a nota vira "O frete você vê na próxima etapa."
- Limite de 10 unidades por item **[a confirmar]** (no site vem do estoque); no limite o + fica apagado e o leitor de tela avisa.
- Desfazer vale enquanto a sacola está aberta; fechar, finalizar ou sair da loja limpa as linhas de Desfazer.

## Ganchos de teste (`DeoCK.gv`)
`x` = id do item (`"oud-passion"`, `"sweet-petals-bs"`, `"sweet-petals-hidratante"`, `"sweet-petals-perfume"`) ou a posição na sacola (0, 1…).
- `abrir()`, `fechar()` — abre (vai para a loja se precisar) / fecha (foco no ícone).
- `mais(x)`, `menos(x)` — uma unidade a mais / a menos (com 1, `menos` remove).
- `remover(x)`, `desfazer(x?)` — tira com Desfazer / devolve (sem `x`, o último que saiu).
- `adicionar(id?)` — adiciona uma sugestão (sem `id`, a primeira); `sugestoes()` → ids sugeridos agora.
- `esvaziar()` — sacola vazia "de verdade" (sem linhas de Desfazer).
- `finalizar()` — como tocar em "Finalizar compra" (vai para o checkout).
- `voltarLoja()` — como clicar num link `[data-loja]`.
- `estado` — `{aberta, ordem, saidos, comprou, metaOk}`.

Estados prontos para capturas (rodar no console do navegador): `DeoCK.gv.mais('sweet-petals-bs')`, `DeoCK.gv.adicionar()`, `DeoCK.gv.remover(0)`, `DeoCK.gv.fechar()`.
**Atenção, outros módulos**: a página abre na loja. Para capturar o checkout, comece com `DeoCK.abrirCheckout()` (ou `DeoCK.gv.finalizar()`), por exemplo `DeoCK.abrirCheckout(); DeoCK.exemplo(3)`.

## Como testar
Como rodar: [testes/README.md](../../testes/README.md).
- `testes/qa_sacola.py`: fluxo do módulo — abertura, foco preso, Esc, +/−/lixeira/Desfazer, sugestão, leitor de tela, checkout, logo → loja, Ctrl+clique, pós-pedido, painel preso ao ícone, véu, toque, reduzir movimento, tempos.
- `testes/qa_integ.py`: fumaça com todos os módulos: loja → etapa 1 → Pix → loja → Pix reabre → confirmação → loja vazia.
- As capturas do módulo cobrem 320, 375, 768 e 1280 px, com avisos de console e rolagem lateral.

## Pedidos ao núcleo
1. Expor as regras e o formatador: `DeoCK.regras = {freteGratis: 199, parcelas: 6}` e `DeoCK.brl(v)`. Hoje o módulo repete 199, 6 e o `brl` (marcado no código).
2. A cena da loja (`.loja-fundo` em `html[data-tela="loja"]`) está no `css/sacola.css`; se o núcleo preferir, ela pode ir para o `css/app.css` (hoje o núcleo só a estiliza no modo janela).
3. `DeoCK.pronto = true` depois do `deo:pronto` (o módulo volta pediu o mesmo). Hoje o módulo detecta carga tardia pelo `data-tela` no `<html>`.
4. Um aviso `deo:itens` no `atualizarItens()`, para quem depende do total (ex.: Pix em aberto) saber que a sacola mudou.
5. Campo `linha` no item (no site: metacampo/coleção do Shopify). Hoje a linha vem do `CATALOGO` do módulo, por id.

**Situação na v3.1:** o núcleo já tem `DeoCK.regras`, `DeoCK.brl`, `DeoCK.pronto` e o aviso `deo:itens` (1, 3 e 4), mas a sacola ainda repete 199 e 6 no próprio código. Continuam em aberto o 2 (a cena da loja segue no `css/sacola.css`) e o 5.

## Riscos
- **Pix em aberto + sacola mudou**: quem vai do Pix para a loja, muda a sacola e finaliza vê o Pix reabrir (pagamento) com o código e o total antigos. Sugestão ao pagamento: comparar `pedido().total` e gerar um novo código se mudou (ou ouvir o `deo:itens`, que o núcleo já envia).
- Depois do pedido confirmado a sacola fica vazia de propósito. No protótipo, "Simular nova compra" recomeça o fluxo.
- Rodapé fixo do celular tem ~190 px (subtotal, botão, nota, "Continuar comprando"); em telas baixas (ex.: iPhone SE com as barras do navegador, ~550 px úteis) a lista fica com ~200 px e rola. Os selos ficam no fim da lista no celular.
- No site: é a gaveta do tema; + / − / remover / adicionar = `/cart/change.js` e `/cart/add.js`; sugestões precisam do dado de "linha" do produto; limite de unidades vem do estoque [a confirmar].
- `inert` (Safari 15.5+, Firefox 112+) é o que faz o clique no ícone aberto cair no véu; em navegador antigo o ícone só não reage (a sacola fecha pelo X, véu ou Esc).
- "Frete grátis liberado na capital de SP" é a regra da loja, com "O CEP confirma no checkout." logo abaixo; o checkout é quem confirma pelo CEP.
