# Módulo volta · cliente que volta (r2-d3 C)

Decisão aprovada: **d3 · C**, "Os dois: lembrado no aparelho e código para ver ou mudar". Prefixo `cv-`.
Textos: objeto `T` no começo de `js/volta.js` (os aprovados na r2-d3, só os que a C usa).

## Arquivos
- `js/volta.js`: carrega depois de `js/app.js` e `js/sacola.js`, antes de `js/pix.js`. Não define `DeoCK.aoPagar`.
- `css/volta.css`: carrega depois de `css/app.css` e `css/sacola.css`. Sem `!important`.

## O que faz
1. **1ª compra.** Em `#slot-pagamento-fim`, a caixa "Lembrar meus dados neste aparelho" aparece **desmarcada**, com a explicação aprovada. No `deo:aprovado {info, slot}`:
   - caixa marcada: grava a memória (ou renova os 180 dias) e escreve no `slot` "Seus dados ficam lembrados neste aparelho por 180 dias. Para esquecer, toque em “Não é você?” na próxima compra.";
   - caixa desmarcada por quem já era lembrado: esquece o aparelho e escreve "Pronto, esquecemos seus dados neste aparelho.";
   - se o aparelho não deixar gravar (aba anônima, memória cheia ou bloqueada), não escreve nada: a tela não promete o que não aconteceu.
2. **Mesmo aparelho, próxima compra.** No `deo:pronto` com `data-tela="checkout"` ou no `deo:checkout` (sacola), se a pessoa ainda não começou a preencher: `DeoCK.preencher(...)`, `DeoCK.marcarFeitas([1,2])`, `DeoCK.irPara(3)` e o cartão creme "Oi de novo, Marina!" em `#slot-pagamento-topo`.
   - Linhas **sempre com partes escondidas**: WhatsApp `(11) •••••-4321` (e `Marina C. · ma•••@email.com`), Entrega `Rua José F•••, nº ••• · São Paulo/SP` (e o frete), CPF na nota `•••.982.247-••`. O leitor de tela ouve frases ("número terminado em 4 3 2 1", "Rua José F, resto escondido, número escondido…", "começo e fim escondidos, meio 982 247"), nunca bolinhas.
   - Enquanto o código não é confirmado, saem da tela as linhas de resumo `#feita-1` e `#feita-2` e o campo do CPF (classes `cv-mask-1`, `cv-mask-2`, `cv-mask-cpf` no `<html>`). No modo "página única", as etapas 1 e 2 inteiras.
   - Escolher cartão nesse estado não deixa o núcleo completar "Nome impresso no cartão" com o nome inteiro.
   - 1 toque em "Pagar R$ 159,70 com Pix" paga (as 3 etapas passam na conferência do núcleo; se um dado guardado não passar, o módulo esquece em vez de abrir uma etapa com tudo à mostra).
   - "Alterar" (WhatsApp ou Entrega) abre a janela do código. "Trocar" (CPF) apaga o CPF e põe o foco no campo: digitar um novo não mostra o antigo.
   - "Não é você?" abre a pergunta (foco nela); "Esquecer e começar do zero" apaga a memória, zera o checkout e volta à etapa 1 com "Pronto, esquecemos os dados deste aparelho."; "Cancelar" devolve o foco ao link.
3. **Janela "Confirme que é você".** Sobe do rodapé abaixo de 1024 px; no centro a partir de 1024 px. Um campo só (`inputmode="numeric"`, `autocomplete="one-time-code"`, aceita colar) desenhado como 6 casas de 56 px de altura; a casa da vez tem o halo de foco dos campos; as casas não animam. Confere sozinho no 6º número; Enter com menos de 6 diz "Faltam números. O código tem 6." (texto aprovado da B, mesmo campo) e não envia a etapa por baixo. Código errado: casas em vermelho, `aria-invalid`, "Esse código não confere. Confira os 6 números ou peça outro." (`role="alert"`), e o próximo número digitado substitui os 6. "Reenviar em 0:30", depois "Reenviar código" (o foco volta ao campo e o leitor de tela ouve "Código reenviado."). "Só no protótipo: o código é 123456." Esc, X e véu fecham e devolvem o foco ao "Alterar"; Tab dá a volta dentro da janela; o resto da página fica `inert`.
   - Código certo: "Pronto! Agora você vê e altera seus dados." no começo da etapa escolhida (1 ou 2), que abre com tudo completo; o cartão sai e as linhas de resumo e o CPF voltam a mostrar o dado inteiro.
   - Sem código: "Digitar outro contato, sem código" / "Usar outro endereço, sem código" apagam só aquela parte, abrem a etapa com a nota "Por segurança, a gente não mostra o … lembrado completo. Digite de novo." e tiram a linha do cartão. Se tudo for redigitado, fica só a saudação com "Não é você?".
4. **Outro aparelho.** Ao digitar (ou o celular preencher) na etapa 1 um WhatsApp que a loja conhece, a oferta aparece em `#slot-contato`: "Que bom te ver de novo!" / "Receber código no WhatsApp" / "Agora não" (anunciada ao leitor de tela). Com o código pedido, o campo do código fica no mesmo cartão, o e-mail sai da tela (vem do cadastro) e há "Continuar sem código". Código certo: preenche endereço e CPF (vale o nome e o e-mail que a pessoa já digitou), marca as etapas e vai ao pagamento com "Pronto, Marina! Endereço e CPF preenchidos. Confira e pague." e "Não é você? Limpar dados". Seguir para a entrega sem usar a oferta vale como "Agora não" para aquele número.
   - Preenchimentos feitos por código (`DeoCK.exemplo`, `DeoCK.preencher`) **não** chamam a oferta (só eventos de quem digita, `isTrusted`). Para capturas, use `DeoCK.cv.outroAparelho()`.
5. **Nova compra no protótipo (v3.1).** "Simular nova compra (só no protótipo)" (`deo:nova-compra`) zera o checkout e começa outra visita. A memória do aparelho fica: se a pessoa marcou "Lembrar meus dados", a próxima ida ao checkout abre no "Oi de novo".

## O que fica no aparelho (protótipo) e o que fica no servidor (site real)
- **Aparelho** (`localStorage["deo-cv-aparelho"]`, sempre em try/catch): só `{v: 1, ate, chave}`. Nada de nome, telefone, endereço ou CPF. Passou de `ate` (180 dias), esquece sozinho.
- **"Servidor" simulado** (`localStorage["deo-cv-sim-loja"]`, só no protótipo): `{chaves: {chave → WhatsApp}, clientes: {WhatsApp → dados do último pedido}}`. É gravado **só** quando a caixa está marcada no `deo:aprovado`. A cliente de exemplo (Marina Costa, (11) 98765-4321) é sempre conhecida pela "loja", como um cadastro antigo.
- **No site real:** a chave é opaca, gerada e gravada pelo servidor (cookie `HttpOnly`, `Secure`, `SameSite=Lax`, 180 dias) e invalidada no servidor em "Não é você?"; o servidor devolve ao navegador só as partes escondidas e o primeiro nome; o endereço completo, o CPF e o e-mail só saem do servidor depois do código certo; o pedido do 1 toque é montado no servidor a partir da chave. Envio do código, validade do código, limite de tentativas e de reenvios, tudo no servidor [a confirmar no código atual].
- Neste protótipo os campos do checkout recebem os dados completos (escondidos da tela e do leitor de tela) porque o núcleo calcula frete e total a partir deles. No site real o navegador não recebe esses dados antes do código.

## Ganchos de teste (`DeoCK.cv`)
| Gancho | O que faz |
|---|---|
| `lembrarExemplo()` | Grava a cliente de exemplo como se a 1ª compra tivesse sido aprovada com a caixa marcada (vale ao recarregar ou no próximo `deo:checkout`). |
| `voltar()` | Zera, grava o exemplo e abre já no pagamento com o cartão "Oi de novo". |
| `esquecer()` | Apaga a memória do aparelho e o cadastro simulado. |
| `abrirCodigo(k)` | Abre a janela do código: `1` contato, `2` entrega (só com o cartão na tela). |
| `codigo("123456")` | Digita um código no campo que estiver na tela (janela ou etapa 1). |
| `outroAparelho(fase)` | Aparelho sem memória: nome e WhatsApp conhecidos na etapa 1, com a oferta; `fase = "codigo"` já pede o código. |
| `naoSou()` | Abre a pergunta "Não é você?". |
| `primeiraCompra(marcar)` | Preenche o exemplo até o pagamento e mostra a caixa (`true` = marcada). |
| `mascarado()` | `true` enquanto a tela mostra só partes escondidas (para a confirmação usar também). |
| `estado()` | `{lembrado, verificado, mascarado, partes: {contato, entrega, cpf}, oferta, janela, memoria}`. |

Estados prontos para capturas (rodar no console do navegador): `DeoCK.cv.voltar()`, `DeoCK.cv.voltar(); DeoCK.cv.abrirCodigo(2)`, `DeoCK.cv.outroAparelho('codigo')`, `DeoCK.cv.primeiraCompra(true)`.

## Como testar
O teste automático do módulo é `testes/qa_volta.py` (como rodar: [testes/README.md](../../testes/README.md)). Roda em 320, 375, 768 e 1280 px, mais casos extras (381 checagens).

O teste faz o papel do módulo de pagamento (`DeoCK.aoPagar` de teste dispara `deo:aprovado` com um slot de teste) e cobre: 1ª compra com a caixa marcada, volta no mesmo aparelho (nada completo na tela nem na árvore de acessibilidade), 1 toque com Pix, janela (Esc, Tab, código errado, faltando, certo), alterar e pagar, "Não é você?", outro aparelho com e sem código, "Agora não", saídas sem código, Trocar CPF, entrada pela sacola (`deo:checkout`), reenviar com espera (relógio controlado), reduzir movimento, memória bloqueada e vencida, ganchos.

## Decisões onde as opções se cruzavam
- O cartão fica em `#slot-pagamento-topo` (contrato da v3), logo abaixo do título da etapa 3, e não acima dele como no rascunho da opção C. O foco do `deo:checkout` vai ao título "Falta pouco para ser seu" e o cartão vem logo depois na leitura.
- "Ver tudo" acontece pelo "Alterar" de cada linha (como na opção C aprovada): com o código, a etapa abre com tudo completo e a pessoa só confere e segue.
- Outro aparelho: depois do código a caixa "Lembrar" **continua desmarcada** (o rascunho da opção C marcava). É a 1ª compra naquele aparelho e a permissão tem que ser um gesto da pessoa (LGPD).
- Quem volta vê a caixa marcada (já tinha escolhido); desmarcar e pagar esquece o aparelho.
- O aparelho não guarda a forma de pagamento: o Pix já vem escolhido e o cartão nunca é guardado.
- "Nome impresso no cartão" não é completado com o nome inteiro enquanto há partes escondidas.
- Sem animação nas casas do código e nos avisos; só a janela (280 ms) e o véu (200 ms), dentro de `prefers-reduced-motion: no-preference`.

## Pedidos ao núcleo
1. **`DeoCK.limpar()`** (campos, erros, etapas feitas, `max`, frete, quem recebe, cartão). Hoje `zerarCheckout()` do módulo escreve em `DeoCK.estado` (`feito`, `max`, `frete`, `recebeOutro`) e limpa erros no DOM.
2. **`preencher()` aceitar `rua, bairro, cidade, uf`** (CEP sem rua). Hoje o módulo preenche esses campos direto.
3. **Lugares no topo das etapas 1 e 2** (`#slot-contato-topo`, `#slot-entrega-topo`) para avisos. Hoje o aviso "Pronto! Agora você vê e altera seus dados." e as notas vão no começo do `.etapa-corpo`.
4. **Ids nos blocos dos campos de CPF e e-mail** (`#campo-cpf`, `#campo-email`). Hoje o módulo põe as classes `cv-campo-cpf` e `cv-campo-email` nesses `.campo`.
5. **Evento `deo:etapa {etapa, antes}`** em `irPara`. Hoje o módulo tira avisos velhos ouvindo `submit` e cliques em `[data-ir]`.
6. **`DeoCK.pronto = true`** depois do `deo:pronto`, para módulo carregado tarde (hoje o módulo usa `document.readyState`).
7. **`pedido().entrega.id`** (id do frete). Hoje o módulo lê `DeoCK.estado.frete` ao gravar.
8. Correção rápida da rodada 2 que estava aberta: `valorFrete()` cobrava frete sem CEP. O módulo zera `estado.frete` ao apagar o endereço para o resumo voltar a "Calculado após o CEP".

**Situação na v3.1:** o núcleo já tem `DeoCK.limpar()`, `preencher()` com rua, bairro, cidade e UF (endereço manual), os ids `#campo-cpf` e `#campo-email`, o evento `deo:etapa`, `DeoCK.pronto`, `pedido().entrega.id`, e `valorFrete()` não cobra mais frete sem endereço (1, 2, 4, 5, 6, 7 e 8). O módulo ainda usa os próprios contornos em parte desses pontos. Continua em aberto o 3 (lugares no topo das etapas 1 e 2).

## Riscos
- **Testes do núcleo:** um teste que digite (11) 98765-4321 na etapa 1 faz a oferta aparecer; o Tab seguinte vai para "Receber código no WhatsApp", o Enter abre o código, o e-mail sai da tela e o teste trava ao preencher `#email`. Use outro número no teste (ex.: 11912345678) ou toque em "Agora não".
- **Confirmação e Pix (módulo de pagamento):** depois de pagar com partes escondidas, `info` traz os dados completos. A confirmação pode mostrar endereço, WhatsApp e nome inteiros a quem pegou o aparelho. Pedido: usar partes escondidas quando `DeoCK.cv.mascarado()` for `true` (em aberto na v3.1).
- **`#slot-pagamento-topo` é dividido** com o aviso de cartão recusado (d5 A). O aviso de recusa deve entrar antes do cartão "Oi de novo" (feito: `js/pagamento.js` põe o aviso no começo do slot).
- **iPhone (Safari):** memória gravada por script some em 7 dias sem visita; para valer 180 dias, a chave tem que ser cookie do servidor [a confirmar no código atual].
- **"Que bom te ver de novo!" revela que o número já comprou** na loja; pede limite de tentativas e de reenvios no servidor [a confirmar].
- **Aparelho dividido:** quem pega o celular vê o primeiro nome, a cidade e pode comprar para o endereço guardado (aprovado assim na C).
- O módulo depende dos ids do núcleo (`#cpf`, `#email`, `#whats`, `#feita-1`, `#feita-2`, `#cc-nome`, `#sem-numero`, `#rua`…). Se esses ids mudarem no núcleo, o módulo precisa acompanhar.
