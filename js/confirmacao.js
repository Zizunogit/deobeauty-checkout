/* DeoBeauty · Checkout rápido · v3 · módulo pagamento · pedido confirmado (r2-d2 C, "O que acontece agora")
   Prefixo ok-. Quem chama é o pagamento.js, depois da aprovação (Pix, cartão ou carteira):
     var ok = DeoCK.ok.montar(info)  →  { raiz, slot, selo, titulo, grupos }
   A tela entra dentro do #fluxo e só aparece com <html data-tela="confirmacao"> (confirmacao.css).
   Mesma grade do checkout: à esquerda título, aviso do WhatsApp e linha do tempo de 4 passos;
   à direita (embaixo, no celular) a coluna creme "Seu pedido". Família olfativa fica fora (r2-d6 A).
   Os 4 passos são os mesmos que as mensagens do WhatsApp vão usar [a confirmar com a integração].
   No site: número do pedido e hora da aprovação vêm do pedido aprovado (aqui: "#1043" de exemplo e a hora do aparelho).
   v3.1 (pedido no chat): "Simular nova compra (só no protótipo)", no mesmo desenho do "Simular Pix recebido",
   chama DeoCK.novaCompra() e o fluxo recomeça na loja com a sacola de exemplo. No site esse botão não existe. */
(function () {
  "use strict";
  var CK = window.DeoCK;
  if (!CK) return;

  /* ---------- textos (aprovados na r2-d2 C) ---------- */
  var NB = "\u00a0"; // espaço que não quebra
  var T = {
    aba: "Pedido confirmado · DeoBeauty",
    numero: function (n) { return "Pedido " + n; },
    titulo: function (nome) { return nome ? "Pedido confirmado, " + nome : "Pedido confirmado"; },
    lead: "Agora é com a gente. Veja o que acontece até ele chegar na sua porta.",
    zapT: "Fique de olho no WhatsApp",
    zap: function (w) { return "Cada passo do pedido chega no " + w + "."; },
    zapEmail: function (e) { return "O recibo vai para " + e + "."; },
    linhaT: "O que acontece agora",
    situacao: { feito: "concluído", agora: "próximo passo", depois: "depois" },
    agoraTag: "Próximo passo",
    p1: "Pagamento aprovado",
    p1d: function (h, pag) { return "Hoje, " + h + " · " + pag; },
    pagLinha: function (p) {
      if (p.forma === "pix") return "Pix de " + p.totalTexto;
      if (p.forma === "carteira") return p.totalTexto + " com " + p.carteira;
      return (p.parcelas > 1 ? p.parcelas + "x de " + parcela(p) : p.totalTexto + " à vista") + " no cartão";
    },
    p2: "Separação",
    p2d: "A gente separa e embala seu pedido com cuidado.",
    p3: "Envio",
    p3d: function (fr) { return "Quando sair, o código de rastreio" + (fr ? " da " + fr : "") + " chega no seu WhatsApp."; },
    p4: "Entrega",
    previsao: function (data, dias) { return "Previsão: " + data + " (" + dias + NB + "dias" + NB + "úteis)"; },
    recebe: function (n) { return "Quem recebe: " + n; },
    pedT: "Seu pedido",
    qtd: function (n) { return n + " unidades"; },
    subtotal: "Subtotal", desconto: "Desconto", frete: "Frete", total: "Total", gratis: "Grátis",
    pago: function (p) {
      if (p.forma === "pix") return "Pago no Pix";
      if (p.forma === "carteira") return "Pago com " + p.carteira;
      var c = p.cartao || {};
      return "Pago no cartão " + (c.bandeira ? c.bandeira + " " : "") + "final" + NB + (c.final || "") +
        (p.parcelas > 1 ? ", " + p.parcelas + "x de " + parcela(p) + " sem" + NB + "juros" : ", à" + NB + "vista");
    },
    fatura: "Na fatura, a compra aparece como DEOBEAUTY.", // nome na fatura [a confirmar com o provedor]
    troca: "Troca fácil em até 7 dias depois de receber.",
    ra: "Reputação <b>RA 1000</b> no Reclame Aqui",
    voltar: "Voltar à loja",
    ajuda: "Dúvidas sobre o pedido? Fale com a gente", // canal de atendimento [a confirmar]; por ora leva à loja
    // só no protótipo (v3.1): mesmo texto e desenho do "Simular Pix recebido (só no protótipo)" da tela do Pix
    demo: "Simular nova compra",
    demoRot: "(só no protótipo)"
  };
  var NUMERO_EXEMPLO = "#1043"; // formato do número [a confirmar]
  var LOJA = "https://deobeauty.me/";
  var IC_CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6.6L6 21v-4a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"/></svg>';

  /* ---------- utilidades ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function brl(v) { return "R$" + NB + Number(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function parcela(p) { return brl(Math.round(p.total / p.parcelas * 100) / 100); }
  function primeiro(n) { return String(n || "").trim().split(/\s+/)[0] || ""; }
  function med(t) { return String(t || "").replace(/(\d) (ml|g|kg|l)\b/g, "$1" + NB + "$2"); }
  function hora() { return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  function nq(s) { return '<span class="nq">' + esc(s) + "</span>"; }

  /* ---------- pedaços ---------- */
  function passo(sit, titulo, corpo) {
    return '<li class="ok-passo ok-' + sit + '"><span class="ok-marca" aria-hidden="true">' +
      (sit === "feito" ? '<svg><use href="#i-ok"/></svg>' : "") + "</span>" +
      '<div class="ok-passo-tx"><h3>' + titulo +
      (sit === "agora" ? ' <span class="selo ok-agora-tag">' + T.agoraTag + "</span>" : ' <span class="vh">(' + T.situacao[sit] + ")</span>") +
      "</h3>" + corpo + "</div></li>";
  }
  function linhaDoTempo(p) {
    var e = p.endereco || {}, fr = p.entrega ? p.entrega.nome : "";
    var outro = p.recebe && p.recebe !== p.nome;
    var lugar = (e.rua || "") + ", " + (e.numero || "") + (e.complemento ? " · " + e.complemento : "") + " · " + ((e.cidade || "") + "/" + (e.uf || "")).replace(/ /g, NB);
    return '<ol class="ok-linha">' +
      passo("feito", T.p1, "<p>" + esc(T.p1d(hora(), T.pagLinha(p))) + "</p>") +
      passo("agora", T.p2, "<p>" + T.p2d + "</p>") +
      passo("depois", T.p3, "<p>" + esc(T.p3d(fr)) + "</p>") +
      passo("depois", T.p4,
        (p.entrega ? '<p class="ok-prev">' + esc(T.previsao(p.entrega.previsao, p.entrega.dias)) + "</p>" : "") +
        "<p>" + esc(lugar) + "</p>" +
        (outro ? "<p>" + esc(T.recebe(p.recebe)) + "</p>" : "")) +
      "</ol>";
  }
  function seuPedido(p) {
    var fr = p.entrega ? p.entrega.nome : "";
    // sem família olfativa (r2-d6 A): o "Seu pedido" da confirmação é igual ao resumo do checkout
    var itens = p.itens.map(function (i) {
      return '<li class="item"><span class="item-img"><img src="' + esc(i.img) + '" alt="" width="56" height="56">' +
        (i.q > 1 ? '<span class="item-q num"><span aria-hidden="true">' + i.q + '</span><span class="vh">' + T.qtd(i.q) + "</span></span>" : "") + "</span>" +
        '<span class="item-n">' + esc(i.nome) + "<small>" + esc(med(i.tipo)) + "</small></span>" +
        '<span class="item-v num">' + brl(i.preco * i.q) + "</span></li>";
    }).join("");
    return '<h2 id="ok-ped-t">' + T.pedT + "</h2>" +
      '<ul class="itens">' + itens + "</ul>" +
      '<dl class="contas num">' +
        "<div><dt>" + T.subtotal + "</dt><dd>" + brl(p.subtotal) + "</dd></div>" +
        (p.desconto ? '<div class="desc"><dt>' + T.desconto + (p.cupom ? " (" + esc(p.cupom) + ")" : "") + "</dt><dd>− " + brl(p.desconto) + "</dd></div>" : "") +
        "<div><dt>" + T.frete + (fr ? " (" + esc(fr) + ")" : "") + "</dt><dd>" + (p.frete === 0 ? T.gratis : brl(p.frete || 0)) + "</dd></div>" +
      "</dl>" +
      '<div class="total num"><span>' + T.total + "</span><b>" + brl(p.total) + "</b></div>" +
      '<p class="ok-pago">' + esc(T.pago(p)) + "</p>" +
      (p.forma === "cartao" ? '<p class="ok-nota">' + T.fatura + "</p>" : "") +
      '<ul class="confianca">' +
        '<li><svg aria-hidden="true"><use href="#i-troca"/></svg><span>' + T.troca + "</span></li>" +
        '<li><svg aria-hidden="true"><use href="#i-selo"/></svg><span>' + T.ra + "</span></li>" +
      "</ul>";
  }

  /* ---------- montar ----------
     Devolve as peças que o movimento (r2-d7 B) usa: o selo verde e os grupos que entram em sequência. */
  function montar(p) {
    var velha = document.getElementById("ok"); if (velha) velha.remove();
    var sec = document.createElement("section");
    sec.className = "ok"; sec.id = "ok"; sec.setAttribute("aria-labelledby", "ok-t");
    sec.innerHTML =
      '<div class="ok-col">' +
        '<header class="ok-cab">' +
          '<p class="ok-kicker"><span class="ok-selo" aria-hidden="true"><svg><use href="#i-ok"/></svg></span>' +
            '<span class="ok-num num" id="ok-num">' + esc(T.numero(NUMERO_EXEMPLO)) + "</span></p>" +
          '<h1 id="ok-t" tabindex="-1" aria-describedby="ok-num ok-lead">' + esc(T.titulo(primeiro(p.nome))) + "</h1>" +
          '<p class="ok-lead" id="ok-lead">' + T.lead + "</p>" +
        "</header>" +
        '<div class="ok-zap" role="note"><span class="ok-zap-ic">' + IC_CHAT + "</span><div>" +
          "<p><b>" + T.zapT + "</b></p>" +
          "<p>" + T.zap(nq(p.whats)) + "</p>" +
          (p.email ? '<p class="ok-zap-mail">' + esc(T.zapEmail(p.email)) + "</p>" : "") +
        "</div></div>" +
        '<section class="ok-tempo" aria-labelledby="ok-tempo-t"><h2 id="ok-tempo-t">' + T.linhaT + "</h2>" + linhaDoTempo(p) + "</section>" +
        // lugar para avisos de outros módulos (ex.: cliente que volta); some vazio
        '<div class="slot ok-slot" id="ok-slot"></div>' +
      "</div>" +
      '<aside class="ok-ped" aria-labelledby="ok-ped-t">' + seuPedido(p) + "</aside>" +
      '<div class="ok-acoes">' +
        // data-loja: a sacola cuida deste botão quando existir
        '<a class="btn btn-pri" href="' + LOJA + '" target="_blank" rel="noopener" data-loja>' + T.voltar + "</a>" +
        '<a class="link" href="' + LOJA + '" target="_blank" rel="noopener">' + T.ajuda + "</a>" +
      "</div>" +
      // só no protótipo: recomeça o fluxo (o pedido confirmado deixa a sacola vazia)
      '<div class="ok-demo"><button type="button" class="ok-demo-bt" data-ok="nova"><b>' + T.demo + "</b> <span>" + T.demoRot + "</span></button></div>";
    document.getElementById("fluxo").appendChild(sec);
    sec.querySelector('[data-ok="nova"]').addEventListener("click", function () { CK.novaCompra(); });
    var q = function (s) { return sec.querySelector(s); };
    return {
      raiz: sec,
      slot: q(".ok-slot"),
      selo: q(".ok-selo"),
      titulo: q("#ok-t"),
      // ordem da entrada: número e título → frase e WhatsApp → linha do tempo → recibo e botões
      grupos: [[q(".ok-num"), q("#ok-t")], [q(".ok-lead"), q(".ok-zap")], [q(".ok-tempo"), q(".ok-slot")], [q(".ok-ped"), q(".ok-acoes"), q(".ok-demo")]]
    };
  }

  /* ---------- título da aba: muda na confirmação e volta ao sair dela ---------- */
  var abaAntes = null;
  document.addEventListener("deo:tela", function (e) {
    var d = e.detail || {};
    if (d.tela === "confirmacao") { if (abaAntes === null) abaAntes = document.title; document.title = T.aba; }
    else if (d.antes === "confirmacao" && abaAntes !== null) { document.title = abaAntes; abaAntes = null; }
  });

  // nova compra (só no protótipo): a confirmação do pedido anterior sai da página
  document.addEventListener("deo:nova-compra", function () { var ok = document.getElementById("ok"); if (ok) ok.remove(); });

  CK.ok = { montar: montar, textos: T };
})();
