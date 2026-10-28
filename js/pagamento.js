/* DeoBeauty · Checkout rápido · v3 · módulo pagamento · o que acontece depois de "Pagar"
   Único módulo que define DeoCK.aoPagar (contrato do núcleo). Carrega por último no módulo:
   usa DeoCK.px (pix.js), DeoCK.ok (confirmacao.js) e DeoCK.mv (movimento.js).

   Quando a pessoa toca em "Pagar", o núcleo valida as 3 etapas, deixa o botão ocupado
   ("Gerando o seu Pix…", "Confirmando com o banco…", "Abrindo o Apple Pay…") e chama aoPagar(info):
   - Pix: ~0,8 s e abre a tela do Pix (r2-d1 B); "Simular Pix recebido" (ou, no site, o aviso do provedor) aprova;
   - cartão: ~1,2 s; cartão terminado em 0002 = recusa simulada → aviso no começo da etapa 3 (r2-d5 A);
     outros cartões → aprovado;
   - carteira: ~1 s → aprovado (no site, a janela da Apple/Google responde).
   Aprovado: confirmação (r2-d2 C) com o movimento r2-d7 B e o evento deo:aprovado {info, slot}.
   O botão continua ocupado enquanto a tela do Pix ou a confirmação estão abertas; volta ao normal
   (DeoCK.ocupado(false)) sempre que a pessoa volta para a etapa 3.

   Ganchos de teste: DeoCK.px.exemplo(), DeoCK.ok.exemplo({pag, recebe, email, cupom}),
   DeoCK.er.recusar(), DeoCK.er.agora(), DeoCK.er.vencido(), DeoCK.er.limpar(). Detalhes em docs/modulos/pagamento.md. */
(function () {
  "use strict";
  var CK = window.DeoCK;
  if (!CK || !CK.px || !CK.ok || !CK.mv) return;

  /* ---------- textos da recusa (aprovados na r2-d5 A) ---------- */
  var NB = "\u00a0"; // espaço que não quebra
  var T = {
    recusaT: "O banco não aprovou o pagamento",
    recusaD: function (fim) { return "Nada foi cobrado no cartão final" + NB + fim + " e seus dados continuam aqui."; },
    pagarPix: function (v) { return "Pagar " + v + " com Pix"; },
    outro: "Usar outro cartão",
    dica: "Liberou a compra no app do banco? É só pagar de novo."
  };
  // quanto o botão fica ocupado antes da resposta (protótipo; no site, o tempo do provedor)
  var ESPERA = { pix: 800, cartao: 1200, carteira: 1000 };
  var FINAL_RECUSA = "0002"; // gatilho só do protótipo: este final é sempre recusado
  var EXEMPLO_RECUSA = "4000 0000 0000 0002";

  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var el = function (id) { return document.getElementById(id); };
  var raiz = document.documentElement;
  var celular = matchMedia("(max-width: 1023px)");
  var calmo = matchMedia("(prefers-reduced-motion: no-preference)");
  var ALERTA = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1 5v7h2V7Zm0 9v2h2v-2Z"/></svg>';

  var espera = null;

  function focar(n) { if (!n) return; try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
  function rolar(y) { window.scrollTo({ top: Math.max(0, y), behavior: calmo.matches ? "smooth" : "instant" }); }
  function botao(forma) { return el(forma === "carteira" ? "btn-carteira" : "btn-pagar"); }
  function naEtapa3() {
    return raiz.getAttribute("data-tela") === "checkout" &&
      (raiz.getAttribute("data-modo") === "pagina" || CK.estado.atual === 3);
  }

  /* ---------- depois de "Pagar" ---------- */
  CK.aoPagar = function (info) {
    clearTimeout(espera);
    espera = setTimeout(function () {
      espera = null;
      // a pessoa saiu da etapa 3 durante a espera ("Alterar" contato ou entrega): nada acontece e o botão volta
      if (!naEtapa3()) { CK.ocupado(false); return; }
      if (info.forma === "pix") abrirPix(info);
      else if (info.forma === "cartao" && info.cartao && info.cartao.final === FINAL_RECUSA) recusar(info);
      else aprovar(info, botao(info.forma), saidasDoCheckout());
    }, ESPERA[info.forma] || ESPERA.cartao);
    return true;
  };

  /* ---------- Pix ---------- */
  function abrirPix(info) {
    limparRecusa(); // trocou para Pix e pagou: o aviso da recusa sai
    CK.px.abrir(info, {
      recebido: function () { aprovar(info, CK.px.ponto(), [CK.px.raiz()]); },
      trocar: voltarParaEtapa3,
      cartao: pagarComCartao
    });
    CK.tela("pix");
    window.scrollTo({ top: 0, behavior: "instant" });
    focar(CK.px.titulo());
  }
  // "Não paguei, quero trocar"
  function voltarParaEtapa3() {
    CK.px.encerrar();
    CK.tela("checkout");
    CK.irPara(3);
    CK.ocupado(false);
  }
  // "Pagar com cartão" no Pix vencido: volta com o cartão escolhido e o foco no número
  function pagarComCartao() {
    CK.px.encerrar();
    CK.tela("checkout");
    CK.preencher({ pag: "cartao" });
    CK.irPara(3, { foco: false });
    CK.ocupado(false);
    var n = el("cc-num");
    focar(n);
    n.scrollIntoView({ block: "center", behavior: calmo.matches ? "smooth" : "instant" });
  }
  // a sacola (ou outro módulo) levou a pessoa para fora e ela voltou ao checkout com um Pix em aberto:
  // a tela do Pix reabre com o mesmo código
  document.addEventListener("deo:checkout", function () {
    if (!CK.px.ativo()) return;
    CK.tela("pix");
    window.scrollTo({ top: 0, behavior: "instant" });
    focar(CK.px.titulo());
  });

  /* ---------- aprovado: confirmação + movimento ---------- */
  // o que sai de cena no cartão e na carteira: o checkout inteiro e, no celular, o rodapé fixo (cópia própria)
  function saidasDoCheckout() {
    return [el("corpo")].concat($$(".etapa-acoes").filter(function (a) {
      return a.getClientRects().length > 0 && getComputedStyle(a).position === "fixed";
    }));
  }
  function aprovar(info, origem, saidas) {
    clearTimeout(espera); espera = null;
    var antes = CK.mv.medir({ origem: origem, saidas: saidas }); // ainda com a tela velha
    limparRecusa();
    if (CK.px.ativo()) CK.px.encerrar({ aprovado: true });
    var ok = CK.ok.montar(info);
    CK.tela("confirmacao");
    window.scrollTo({ top: 0, behavior: "instant" });
    focar(ok.titulo); // o leitor de tela anuncia "Pedido confirmado, Marina"
    document.dispatchEvent(new CustomEvent("deo:aprovado", { detail: { info: info, slot: ok.slot } }));
    CK.mv.tocar(antes, ok);
  }
  // saiu da confirmação (ex.: a sacola voltou para a loja): o botão de pagar não fica preso em "ocupado"
  document.addEventListener("deo:tela", function (e) {
    if ((e.detail || {}).antes === "confirmacao") CK.ocupado(false);
  });

  /* ---------- recusa (r2-d5 A): aviso no começo da etapa 3 ---------- */
  function recusar(info) {
    var fim = info.cartao ? info.cartao.final : "";
    // os dados do cartão ficam (o aviso diz "seus dados continuam aqui"); só "Usar outro cartão" limpa
    CK.ocupado(false);
    CK.resumo(false); // se o painel do resumo estava aberto no celular, ele fecha para o aviso receber o foco
    limparRecusa();
    var a = document.createElement("div");
    a.className = "er-aviso"; a.id = "er-recusa";
    a.innerHTML =
      '<span class="er-ic" aria-hidden="true">' + ALERTA + "</span>" +
      '<div class="er-aviso-tx">' +
        '<h3 id="er-recusa-t" tabindex="-1" aria-describedby="er-recusa-d"></h3>' +
        '<p id="er-recusa-d"></p>' +
        '<div class="er-aviso-acoes">' +
          '<button type="button" class="btn btn-sec er-pix" data-er="pix"><svg aria-hidden="true" focusable="false"><use href="#i-pix"/></svg><span></span></button>' +
          '<button type="button" class="btn btn-sec" data-er="cartao"></button>' +
        "</div>" +
        '<p class="er-dica"></p>' +
      "</div>";
    a.querySelector("h3").textContent = T.recusaT;
    a.querySelector("#er-recusa-d").textContent = T.recusaD(fim);
    a.querySelector(".er-pix span").textContent = T.pagarPix(info.totalTexto);
    a.querySelector('[data-er="cartao"]').textContent = T.outro;
    a.querySelector(".er-dica").textContent = T.dica;
    a.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-er]"); if (!b) return;
      if (b.getAttribute("data-er") === "pix") { CK.preencher({ pag: "pix" }); CK.pagar(); }
      else outroCartao();
    });
    var slot = el("slot-pagamento-topo");
    slot.insertBefore(a, slot.firstChild);
    if (calmo.matches) a.classList.add("er-entra");
    rolarAteAviso(a);
    focar(el("er-recusa-t")); // o leitor de tela lê o título e a descrição
  }
  // no computador o título da etapa continua à vista acima do aviso; no celular o aviso vai para o alto
  function rolarAteAviso(a) {
    var cab = document.querySelector("#etapa-3 .etapa-cab");
    var perto = cab && cab.getClientRects().length && a.getBoundingClientRect().top - cab.getBoundingClientRect().top < window.innerHeight * 0.4;
    var alvo = !celular.matches && perto ? cab : a;
    rolar(alvo.getBoundingClientRect().top + window.scrollY - (alvo === cab ? 24 : 16));
  }
  function outroCartao() {
    CK.preencher({ pag: "cartao" });
    CK.limparCartao(); // número, validade e CVV; nome no cartão, parcelas, CPF, contato e entrega ficam
    var n = el("cc-num");
    focar(n);
    n.scrollIntoView({ block: "center", behavior: calmo.matches ? "smooth" : "instant" });
  }
  function limparRecusa() { var a = el("er-recusa"); if (a) a.remove(); }

  /* ---------- ganchos de teste e captura ---------- */
  function cartaoRecusado() {
    var n = el("cc-num");
    n.value = EXEMPLO_RECUSA; n.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function outraPessoa(nome) {
    if (el("outro-recebe").getAttribute("aria-expanded") !== "true") el("outro-recebe").click();
    var r = el("recebe"); r.value = nome; r.dispatchEvent(new Event("input", { bubbles: true }));
  }
  // vai direto para a tela do Pix (sem a espera de 0,8 s); op como em DeoCK.exemplo
  CK.px.exemplo = function (op) {
    op = op || {}; op.pag = "pix";
    CK.exemplo(3, op); CK.preencher({ pag: "pix" }); CK.ocupado(true); abrirPix(CK.pedido());
  };
  // vai direto para a confirmação: {pag: 'pix'|'cartao'|'carteira', recebe: 'Ana Lima', email: false, cupom: 'DEOQUIZ10'}
  CK.ok.exemplo = function (op) {
    op = op || {};
    CK.exemplo(3, op);
    if (op.recebe) outraPessoa(op.recebe);
    CK.ocupado(true);
    aprovar(CK.pedido(), botao(op.pag), saidasDoCheckout());
  };
  CK.er = {
    // como a pessoa faria: cartão final 0002, toca em pagar e espera o banco (~1,2 s)
    recusar: function () { CK.exemplo(3, { pag: "cartao" }); cartaoRecusado(); CK.pagar(); },
    // a recusa na hora, para capturas
    agora: function () { CK.exemplo(3, { pag: "cartao" }); cartaoRecusado(); CK.ocupado(true); recusar(CK.pedido()); },
    vencido: function () { CK.px.exemplo(); CK.px.vencer(); },
    limpar: limparRecusa,
    textos: T,
    esperas: ESPERA
  };
})();
