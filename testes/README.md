# Testes do Checkout Rápido DeoBeauty

Testes de navegador (Playwright + Chromium) do protótipo. Cada script sobe um servidor local, só de leitura, com a raiz do repositório, abre o `index.html` (ou `index.html#checkout`) e confere o comportamento em várias larguras de tela. Tudo usa dados de exemplo; nenhum dado real.

## O que cada script cobre

- `qa_v3.py`: fluxo completo do checkout com teclado em 375, 1280 e 768 px (com movimento reduzido): erros, cupom, CEP manual, Pix, cartão com fatura, carteira, correções da Rodada 2 e rolagem lateral de 320 a 1280 px.
- `qa_pagamento.py`: módulo de pagamento: tela do Pix (copiar, QR, validade, vencido, trocar forma), teclado, cartão em 3x, recusa do banco, carteira, movimento da aprovação, aba escondida e larguras.
- `qa_volta.py`: cliente que volta: "Lembrar meus dados", "Oi de novo" com dados escondidos, janela do código, "Não é você?", oferta em outro aparelho e saídas sem código.
- `qa_sacola.py`: sacola: foco preso, Esc, + e −, remover e desfazer, sugestões, Finalizar, volta à loja pelo logo, sacola vazia depois do pedido e tempos do movimento.
- `qa_integ.py`: teste rápido com todos os módulos juntos: loja → checkout → Pix → loja → Pix reabre → aprovado → confirmação → "Voltar à loja" com a sacola vazia.
- `qa_nova.py`: v3.1: botão "Simular nova compra (só no protótipo)" na confirmação, que recomeça com a sacola de exemplo (Pix, cartão com "Lembrar", carteira).
- `capturas.py`: não é teste; tira capturas de tela nas larguras pedidas (aceita patch CSS/JS e um comando antes da captura).
- `rodar_todos.py`: roda os seis testes em sequência, cada um numa porta, e imprime o resumo.
- `comum.py`: peças compartilhadas (servidor, navegador, fontes e pasta de saída).

## Instalar

Precisa de Python 3.9 ou mais novo.

```
pip install -r testes/requirements.txt
python -m playwright install chromium
```

## Rodar

Na raiz do repositório:

```
python testes/qa_v3.py                          # um teste
python testes/qa_pagamento.py --so pix,cartao --cap
python testes/rodar_todos.py                    # todos, com resumo no fim
python testes/rodar_todos.py --so qa_v3,qa_nova
python testes/capturas.py --w 375,1280 --name sacola --full
```

- Cada teste termina com `RESULTADO <script>: N ok, M falhas` e sai com código 1 se algo falhar. O `rodar_todos.py` imprime uma linha `script: N ok, M falhas` por teste e sai com código 1 se qualquer um falhar.
- As capturas vão para `saida-testes/<nome-do-script>/` na raiz (essa pasta não vai para o git). Para mudar, use `--out pasta`.
- Todos aceitam `--port` (portas padrão diferentes em cada script; o `rodar_todos.py` usa 8901 em diante, ou `--porta`).
- O `qa_pagamento.py` só grava capturas com `--cap`; `--so` escolhe os blocos (pix, teclado, cartao, recusa, carteira, calmo, escondida, extras, mv, larguras).

## Fontes sem internet

Sem configurar nada, a página carrega DM Sans e Playfair Display do Google Fonts. Se o Google Fonts não carregar (sem internet ou com bloqueio de rede), o navegador registra erro no console e as verificações "console sem erros" falham. Para usar fontes locais:

1. Numa pasta fora do repositório, baixe as fontes:

   ```
   npm i @fontsource-variable/dm-sans@5 @fontsource/playfair-display@5
   ```

2. Copie estas 4 fontes para `testes/fontes/`:

   - `node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-opsz-normal.woff2`
   - `node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-ext-opsz-normal.woff2`
   - `node_modules/@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2`
   - `node_modules/@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff2`

3. Copie `testes/fontes/gfonts.css.exemplo` para `testes/fontes/gfonts.css`.

Com isso, os testes trocam o Google Fonts pelo `gfonts.css` local e servem as `.woff2` em `/_fontes/`. Esses arquivos ficam fora do git (`testes/.gitignore`).

Outra opção: deixe o `gfonts.css` e as 4 `.woff2` em qualquer pasta e aponte a variável `DEO_FONTES` para ela (ela vale antes de `testes/fontes/`):

```
DEO_FONTES=/caminho/das/fontes python testes/rodar_todos.py
```

Se o `gfonts.css` existir mas faltar alguma `.woff2`, os testes avisam e usam a internet.

## Resultado desta rodada

28/10/2026, protótipo v3.1, fontes locais (`DEO_FONTES`), Chromium do Playwright 1.63:

| Script | Verificações |
| --- | --- |
| `qa_v3.py` | 264 ok, 0 falhas |
| `qa_pagamento.py` | 314 ok, 0 falhas |
| `qa_volta.py` | 381 ok, 0 falhas |
| `qa_sacola.py` | 62 ok, 0 falhas |
| `qa_integ.py` | 24 ok, 0 falhas |
| `qa_nova.py` | 325 ok, 0 falhas |
| **Total** | **1.370 ok, 0 falhas** |
