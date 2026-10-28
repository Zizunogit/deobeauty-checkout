/* DeoBeauty · Checkout rápido · v3 · módulo pagamento · tela do Pix (r2-d1 B + Pix vencido da r2-d5 A)
   Prefixo px-. Quem abre e fecha esta tela é o pagamento.js (único que define DeoCK.aoPagar):
     DeoCK.px.abrir(info, { recebido, trocar, cartao })  monta a tela dentro do #fluxo e liga o relógio;
     DeoCK.px.encerrar({ aprovado })                    para o relógio e tira a tela.
   O que aparece na tela depende de <html data-tela="pix"> (pix.css); o estado do Pix fica em
   <section class="px" data-estado="aguardando|vencido">.

   No site de verdade:
   - o código copia e cola e o QR vêm do provedor do Pix (nunca gerados no navegador);
   - "Esperando seu Pix" consulta o status da cobrança (ou recebe aviso do servidor) e chama eventos.recebido();
   - o Pix fica guardado no pedido: se a aba recarregar na volta do app do banco, a mesma tela reabre com o mesmo código;
   - "Trocar forma de pagamento" deve cancelar a cobrança Pix no provedor [a confirmar], para não haver pagamento em dobro.

   Ganchos de teste (DeoCK.px.*): copiado(), falhou(), passos(bool), qr(bool), faltam(min), vencer(), novo(),
   trocar(bool), aprovar(), estado(). O pagamento.js acrescenta DeoCK.px.exemplo(). Detalhes em docs/modulos/pagamento.md. */
(function () {
  "use strict";
  var CK = window.DeoCK;
  if (!CK) return;

  /* ---------- textos (aprovados na r2-d1 B; Pix vencido com os textos da r2-d5 A) ---------- */
  var NB = "\u00a0"; // espaço que não quebra
  var PCC = "Pix" + NB + "Copia" + NB + "e" + NB + "Cola";
  var T = {
    olho: "Pagamento com Pix",
    titulo: "Agora é só pagar o Pix",
    sub: "Assim que o Pix cair, seu pedido está confirmado.",
    valorRot: "Valor do Pix",
    ate: "Vale até",
    faltam: "faltam",
    codigoRot: "Código Pix copia e cola",
    codigoRotPc: "Ou use o código Pix copia e cola",
    copiar: "Copiar código Pix",
    copiado: "Código copiado",
    copiarDeNovo: "Copiar de novo",
    avisoCopiado: "Copiado! Agora abra o app do seu banco, entre em Pix e escolha " + PCC + ".",
    avisoCopiadoPc: "Copiado! Cole no app do banco, em " + PCC + ".",
    avisoFalhou: "Não deu para copiar sozinho. Toque e segure no código acima e escolha Copiar.",
    dicaCel: "Depois de copiar, abra o app do seu banco e escolha <b>" + PCC + "</b>.",
    esperando: "Esperando seu Pix",
    esperandoTx: "Pode deixar esta página aberta. Quando o Pix cair, ela muda sozinha.",
    passosBtn: "Passo a passo",
    passosBtnMais: " no app do banco",
    passosCel: function (v) {
      return ["Toque em <b>Copiar código Pix</b>.",
        "Abra o app do seu banco e entre em <b>Pix</b>.",
        "Escolha <b>" + PCC + "</b> e cole o código.",
        "Confira o valor, <b class=\"nq\">" + v + "</b>, e confirme.",
        "Volte para esta página: a confirmação aparece sozinha."];
    },
    passosPc: function (v) {
      return ["Abra o app do seu banco <b>no celular</b> e entre em <b>Pix</b>.",
        "Escolha <b>Ler QR" + NB + "Code</b> e aponte a câmera para o código.",
        "Confira o valor, <b class=\"nq\">" + v + "</b>, e confirme.",
        "Pronto: a confirmação aparece nesta tela."];
    },
    qrBtn: "Ver QR" + NB + "Code",
    qrBtnSub: "Para pagar com outro celular",
    qrLegenda: "Aponte a câmera do app do banco para o código.",
    qrAlt: "QR Code do Pix (desenho de exemplo, não serve para pagar)",
    exemplo: "EXEMPLO",
    trocar: "Trocar forma de pagamento",
    trocaTitulo: "Ainda não pagou o Pix?",
    trocaTx: "Se já pagou, espere aqui: a confirmação chega em instantes. Se não, volte e escolha outra forma.",
    trocaSim: "Não paguei, quero trocar",
    trocaNao: "Já paguei, vou esperar",
    demo: "Simular Pix recebido",
    demoRot: "(só no protótipo)",
    // Pix vencido: mesmo aviso de "o pagamento não passou" da r2-d5 A
    vencT: "O código Pix venceu",
    vencD: function (v) { return "O tempo para pagar acabou e nada foi cobrado. Gere um novo código para pagar os mesmos " + v + "."; },
    vencNovo: "Gerar novo código Pix",
    vencCartao: "Pagar com cartão",
    vencJa: "Já pagou este código? Não pague de novo: a confirmação chega no seu WhatsApp.",
    pedidoItens: function (l) { return l.length < 2 ? l.join("") : l.slice(0, -1).join(", ") + " e " + l[l.length - 1]; },
    pedidoEntrega: function (e) { return e ? "Entrega " + e.nome + " · previsão " + e.previsao.replace(/ /g, NB) : ""; },
    totalRot: "Total",
    // só para o leitor de tela
    srCopiado: "Código Pix copiado. Agora abra o app do seu banco e escolha Pix Copia e Cola.",
    srFalhou: "Não deu para copiar sozinho. O código está selecionado: copie pelo menu do aparelho.",
    srCinco: "Faltam 5 minutos para o código do Pix vencer.",
    srUm: "Falta 1 minuto para o código do Pix vencer.",
    srNovo: function (h) { return "Novo código Pix pronto. Vale até " + h + "."; }
  };

  var VALIDADE_MIN = 30;  // [a confirmar com o provedor do Pix] hoje o Shopify mostra uns 7 min
  var COPIADO_MS = 5000;  // depois disso o botão volta a "Copiar de novo"; o aviso com o próximo passo fica
  var POUCO_MS = 5 * 60000;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var el = function (id) { return document.getElementById(id); };
  var celular = matchMedia("(max-width: 1023px)");

  /* ---------- estado ---------- */
  var P = {
    sec: null, info: null, ev: null, codigo: "", geracao: 0,
    fim: 0, relogio: null, copiadoT: null, avisou5: false, avisou1: false,
    historico: false, ignorarPop: false, rolagem: null
  };

  /* ---------- utilidades ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hora(t) { return new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); s %= 60; return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s; }
  function focar(n) { if (!n) return; try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
  function visivel(n) { return !!n && n.getClientRects().length > 0; }
  function falar(msg) {
    var sr = el("px-sr"); if (!sr) return;
    sr.textContent = "";
    setTimeout(function () { if (sr.isConnected) sr.textContent = msg; }, 60);
  }

  /* ---------- dados de exemplo (claramente fictícios: não pagam nada) ---------- */
  function codigoExemplo(info, n) {
    return "00020126-EXEMPLO-PIX-FICTICIO-DEOBEAUTY-NAO-PAGUE-ESTE-CODIGO-VALOR-" + info.total.toFixed(2) +
      "-PEDIDO-1043-EXEMPLO-" + n + "-6304EXEM";
  }
  // desenho de QR só para o protótipo: módulos pseudoaleatórios fixos, sem dado nenhum, selo EXEMPLO no meio
  function qrSvg() {
    var n = 29, s = 20261028, d = "";
    function rnd() { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }
    function olho(x, y) {
      var c = [[0, 0], [n - 7, 0], [0, n - 7]];
      for (var i = 0; i < 3; i++) {
        var fx = x - c[i][0], fy = y - c[i][1];
        if (fx >= -1 && fx <= 7 && fy >= -1 && fy <= 7) {
          if (fx < 0 || fy < 0 || fx > 6 || fy > 6) return 0;
          if (fx === 0 || fy === 0 || fx === 6 || fy === 6) return 1;
          return fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4 ? 1 : 0;
        }
      }
      return -1;
    }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var f = olho(x, y), on;
      if (f !== -1) on = f === 1;
      else if (x >= 9 && x <= 19 && y >= 12 && y <= 16) on = false; // espaço do selo
      else if (y === 6) on = x % 2 === 0;
      else if (x === 6) on = y % 2 === 0;
      else on = rnd() > 0.52;
      if (on) d += "M" + x + " " + y + "h1v1h-1z";
    }
    return '<svg viewBox="-1 -1 ' + (n + 2) + " " + (n + 2) + '" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path fill="#1A1416" d="' + d + '"/></svg>';
  }

  /* ---------- montagem ---------- */
  var IC = {
    relogio: '<svg class="px-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 3v4.6l3.4 2-1 1.7L11 12.7V7Z"/></svg>',
    copiar: '<svg class="px-ic px-ic-cp" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9 2h10a2 2 0 0 1 2 2v12h-2V4H9Zm-4 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm0 2v12h10V8Z"/></svg>',
    ok: '<svg class="px-ic px-ic-ok" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9.5 16.2 19.7 6l1.6 1.6L9.5 19.4 2.7 12.6l1.6-1.6Z"/></svg>',
    seta: '<svg class="px-ic px-seta" aria-hidden="true" focusable="false"><use href="#i-seta"/></svg>',
    pix: '<svg class="px-ic" aria-hidden="true" focusable="false"><use href="#i-pix"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1 5v7h2V7Zm0 9v2h2v-2Z"/></svg>'
  };
  function lista(itens, cls) {
    return '<ol class="px-lista ' + cls + '">' + itens.map(function (t) { return "<li><span>" + t + "</span></li>"; }).join("") + "</ol>";
  }
  function demo(cls) {
    return '<button type="button" class="px-demo ' + cls + '" data-px="aprovar"><b>' + T.demo + "</b> <span>" + T.demoRot + "</span></button>";
  }
  function html(info) {
    var v = esc(info.totalTexto);
    var fotos = info.itens.slice(0, 3).map(function (i) { return '<img src="' + esc(i.img) + '" alt="" width="40" height="40">'; }).join("");
    return (
      '<header class="px-cab">' +
        '<p class="px-olho">' + IC.pix + T.olho + "</p>" +
        '<h2 id="px-titulo" tabindex="-1">' + T.titulo + "</h2>" +
        '<p class="px-sub">' + T.sub + "</p>" +
      "</header>" +

      // o que serve para pagar (some quando o código vence)
      '<div class="px-cartao px-so-ativo">' +
        '<div class="px-valor">' +
          '<p class="px-valor-bloco"><span class="px-rot">' + T.valorRot + '</span><b class="px-valor-n num">' + v + "</b></p>" +
          '<p class="px-tempo" role="timer">' + IC.relogio + "<span>" + T.ate + ' <b class="px-ate num"></b></span><span class="px-resta-w">' + T.faltam + ' <span class="px-resta num"></span></span></p>' +
        "</div>" +
        '<div class="px-copia">' +
          '<p class="px-codigo-rot"><span class="px-so-cel">' + T.codigoRot + '</span><span class="px-so-pc">' + T.codigoRotPc + "</span></p>" +
          '<p class="px-codigo num"><span class="px-codigo-tx">' + esc(P.codigo) + "</span></p>" +
          '<button type="button" class="btn btn-pri px-copiar" data-px="copiar">' + IC.copiar + IC.ok + '<span class="px-copiar-tx">' + T.copiar + "</span></button>" +
          '<p class="px-aviso" hidden>' + IC.ok + "<span></span></p>" +
          '<p class="px-dica px-so-cel">' + T.dicaCel + "</p>" +
        "</div>" +
        '<div class="px-status">' +
          '<span class="px-ponto" aria-hidden="true"></span>' +
          '<p class="px-status-tx"><b>' + T.esperando + "</b> <span>" + T.esperandoTx + "</span></p>" +
          demo("px-so-pc") +
        "</div>" +
        '<div class="px-passos">' +
          '<button type="button" class="px-abre px-so-cel" data-px="passos" aria-expanded="false" aria-controls="px-passos-corpo"><span><span>' + T.passosBtn + T.passosBtnMais + "</span></span>" + IC.seta + "</button>" +
          '<div class="px-passos-corpo" id="px-passos-corpo">' + lista(T.passosCel(v), "px-so-cel") + lista(T.passosPc(v), "px-so-pc") + "</div>" +
        "</div>" +
        '<div class="px-qr">' +
          '<button type="button" class="px-abre px-so-cel" data-px="qr" aria-expanded="false" aria-controls="px-qr-corpo"><span>' + T.qrBtn + "<small>" + T.qrBtnSub + "</small></span>" + IC.seta + "</button>" +
          '<div class="px-qr-corpo" id="px-qr-corpo"><figure class="px-qr-fig" role="img" aria-label="' + T.qrAlt + '">' + qrSvg() +
            '<span class="px-qr-selo" aria-hidden="true">' + T.exemplo + '</span></figure><p class="px-qr-leg">' + T.qrLegenda + "</p></div>" +
        "</div>" +
      "</div>" +

      // código vencido (r2-d5 A): o mesmo aviso de "o pagamento não passou"
      '<div class="er-aviso px-vencido px-so-vencido">' +
        '<span class="er-ic" aria-hidden="true">' + IC.alerta + "</span>" +
        '<div class="er-aviso-tx">' +
          '<h3 id="px-vencido-t" tabindex="-1" aria-describedby="px-vencido-d">' + T.vencT + "</h3>" +
          '<p id="px-vencido-d">' + esc(T.vencD(info.totalTexto)) + "</p>" +
          '<div class="er-aviso-acoes"><button type="button" class="btn btn-pri" data-px="novo">' + T.vencNovo + '</button>' +
            '<button type="button" class="btn btn-sec" data-px="cartao">' + T.vencCartao + "</button></div>" +
          '<p class="er-dica">' + T.vencJa + "</p>" +
        "</div>" +
      "</div>" +

      // o pedido numa linha
      '<div class="px-pedido">' +
        '<span class="px-pedido-fotos" aria-hidden="true">' + fotos + "</span>" +
        '<p class="px-pedido-tx"><b>' + esc(T.pedidoItens(info.itens.map(function (i) { return i.nome; }))) + "</b><span>" + esc(T.pedidoEntrega(info.entrega)) + "</span></p>" +
        '<p class="px-pedido-tot"><span>' + T.totalRot + '</span> <b class="num">' + v + "</b></p>" +
      "</div>" +

      '<div class="px-pe">' +
        '<div class="px-troca-w px-so-ativo">' +
          '<button type="button" class="link px-trocar" data-px="trocar" aria-expanded="false" aria-controls="px-troca">' + T.trocar + "</button>" +
          '<div class="px-troca" id="px-troca">' +
            '<p class="px-troca-t" id="px-troca-t" tabindex="-1">' + T.trocaTitulo + "</p><p>" + T.trocaTx + "</p>" +
            '<div class="px-troca-bt"><button type="button" class="btn btn-sec" data-px="troca-sim">' + T.trocaSim + "</button>" +
              '<button type="button" class="link" data-px="troca-nao">' + T.trocaNao + "</button></div>" +
          "</div>" +
        "</div>" +
        demo("px-so-cel px-so-ativo") +
      "</div>" +
      '<p class="vh" id="px-sr" role="status"></p>'
    );
  }

  /* ---------- relógio da validade ---------- */
  function estado() { return P.sec ? P.sec.getAttribute("data-estado") : null; }
  function pintarTempo() {
    if (!P.sec) return;
    var r = P.fim - Date.now();
    $$(".px-ate", P.sec).forEach(function (n) { n.textContent = hora(P.fim); });
    $$(".px-resta", P.sec).forEach(function (n) { n.textContent = mmss(r); });
    // nos 5 minutos finais a validade fica rosa
    $$(".px-tempo", P.sec).forEach(function (n) { n.classList.toggle("px-pouco", r <= POUCO_MS); });
    if (!P.avisou5 && r <= POUCO_MS && r > 60000) { P.avisou5 = true; falar(T.srCinco); }
    if (!P.avisou1 && r <= 60000 && r > 0) { P.avisou1 = true; falar(T.srUm); }
    if (r <= 0) vencer();
  }
  function ligarRelogio() {
    clearInterval(P.relogio);
    P.fim = Date.now() + VALIDADE_MIN * 60000; P.avisou5 = false; P.avisou1 = false;
    pintarTempo();
    P.relogio = setInterval(pintarTempo, 1000);
  }
  // com a aba escondida o navegador atrasa o relógio: ao voltar, a conta é refeita na hora
  document.addEventListener("visibilitychange", function () { if (!document.hidden && P.relogio) pintarTempo(); });

  function vencer() {
    clearInterval(P.relogio); P.relogio = null;
    if (estado() !== "aguardando") return;
    limparCopiado(true); pedirTroca(false, false);
    P.sec.setAttribute("data-estado", "vencido");
    // o botão de copiar some: o foco vai para o aviso (o leitor de tela lê título e texto)
    focar(el("px-vencido-t"));
  }
  function novoCodigo() {
    if (!P.sec) return;
    P.geracao++;
    P.codigo = codigoExemplo(P.info, P.geracao);
    $$(".px-codigo-tx", P.sec).forEach(function (n) { n.textContent = P.codigo; });
    limparCopiado(true);
    P.sec.setAttribute("data-estado", "aguardando");
    ligarRelogio();
    falar(T.srNovo(hora(P.fim)));
    focar($$(".px-copiar", P.sec).filter(visivel)[0]);
  }

  /* ---------- copiar ---------- */
  function copiaAntiga() {
    var foco = document.activeElement, t = document.createElement("textarea"), ok = false;
    t.value = P.codigo; t.setAttribute("readonly", ""); t.setAttribute("aria-hidden", "true");
    t.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(t); t.select();
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    t.remove(); focar(foco);
    return ok;
  }
  function copiar() {
    var nao = function () { marcarCopiado(copiaAntiga()); };
    try {
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(P.codigo).then(function () { marcarCopiado(true); }, nao);
      else nao();
    } catch (e) { nao(); }
  }
  function limparCopiado(tudo) {
    clearTimeout(P.copiadoT);
    if (!P.sec) return;
    $$(".px-copiar", P.sec).forEach(function (b) { b.classList.remove("px-feito"); $(".px-copiar-tx", b).textContent = T.copiar; });
    if (tudo) $$(".px-aviso", P.sec).forEach(function (a) { a.hidden = true; a.classList.remove("px-falhou", "px-surge"); });
  }
  function marcarCopiado(ok) {
    if (!P.sec || estado() !== "aguardando") return;
    limparCopiado(false);
    $$(".px-aviso", P.sec).forEach(function (a) {
      a.hidden = false; a.classList.toggle("px-falhou", !ok);
      $("span", a).textContent = !ok ? T.avisoFalhou : celular.matches ? T.avisoCopiado : T.avisoCopiadoPc;
      a.classList.remove("px-surge"); void a.offsetWidth; a.classList.add("px-surge");
    });
    if (!ok) {
      // deixa o código selecionado para copiar à mão
      var c = $(".px-codigo-tx", P.sec);
      if (c && window.getSelection) { var r = document.createRange(); r.selectNodeContents(c); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      falar(T.srFalhou); return;
    }
    $$(".px-copiar", P.sec).forEach(function (b) { b.classList.add("px-feito"); $(".px-copiar-tx", b).textContent = T.copiado; });
    falar(T.srCopiado);
    P.copiadoT = setTimeout(function () {
      if (!P.sec) return;
      $$(".px-copiar", P.sec).forEach(function (b) { b.classList.remove("px-feito"); $(".px-copiar-tx", b).textContent = T.copiarDeNovo; });
    }, COPIADO_MS);
  }

  /* ---------- partes que abrem: passo a passo e QR (no celular) ---------- */
  function alternar(sel, acao, abrir) {
    var caixa = P.sec && $(sel, P.sec); if (!caixa) return false;
    abrir = abrir === undefined ? !caixa.classList.contains("px-aberto") : !!abrir;
    caixa.classList.toggle("px-aberto", abrir);
    $$('[data-px="' + acao + '"]', P.sec).forEach(function (b) { b.setAttribute("aria-expanded", String(abrir)); });
    return abrir;
  }

  /* ---------- trocar a forma de pagamento: pergunta antes (evita pagar duas vezes) ---------- */
  function pedirTroca(abrir, focarTitulo) {
    var aberto = alternar(".px-troca", "trocar", abrir);
    if (aberto && focarTitulo !== false) {
      var t = el("px-troca-t"); focar(t);
      if (t) t.scrollIntoView({ block: "nearest" });
    }
    return aberto;
  }
  function ficar() {
    pedirTroca(false);
    // quem voltou pelo "voltar" do navegador e decidiu esperar ganha de novo a entrada no histórico
    if (!P.historico) empilhar();
    focar($(".px-trocar", P.sec));
  }

  /* ---------- "voltar" do navegador com o Pix aberto: pergunta antes de sair, sem prender a pessoa ---------- */
  function empilhar() {
    try { history.pushState({ deo: "pix" }, ""); P.historico = true; } catch (e) { P.historico = false; }
  }
  // enquanto o Pix usa o histórico, o navegador não devolve a rolagem antiga ao andar nele
  // (senão a página pula depois de "Não paguei, quero trocar" ou do "voltar")
  function rolagemManual(on) {
    if (!("scrollRestoration" in history)) return;
    if (on && P.rolagem === null) { P.rolagem = history.scrollRestoration; history.scrollRestoration = "manual"; }
    else if (!on && P.rolagem !== null) { history.scrollRestoration = P.rolagem; P.rolagem = null; }
  }
  window.addEventListener("popstate", function () {
    if (P.ignorarPop) { P.ignorarPop = false; if (!P.sec) rolagemManual(false); return; }
    if (!P.sec || !P.historico) return;
    P.historico = false; // a nossa entrada saiu da pilha
    if (document.documentElement.getAttribute("data-tela") !== "pix") return;
    if (estado() === "aguardando") pedirTroca(true);
    else if (P.ev && P.ev.trocar) P.ev.trocar(); // código vencido: não há o que perder, volta para a etapa 3
  });

  /* ---------- ações ---------- */
  function acao(a) {
    if (!P.sec) return;
    if (a === "copiar") copiar();
    else if (a === "passos") alternar(".px-passos", "passos");
    else if (a === "qr") alternar(".px-qr", "qr");
    else if (a === "trocar") pedirTroca();
    else if (a === "troca-nao") ficar();
    else if (a === "troca-sim") { if (P.ev && P.ev.trocar) P.ev.trocar(); }
    else if (a === "cartao") { if (P.ev && P.ev.cartao) P.ev.cartao(); }
    else if (a === "novo") novoCodigo();
    else if (a === "aprovar") aprovar();
  }
  function aprovar() {
    if (!P.sec || !P.ev || !P.ev.recebido) return false;
    P.ev.recebido();
    return true;
  }

  /* ---------- abrir e encerrar ---------- */
  function abrir(info, eventos) {
    encerrar({ silencioso: true });
    P.info = info; P.ev = eventos || {}; P.geracao = 1;
    P.codigo = codigoExemplo(info, P.geracao);
    var sec = document.createElement("section");
    sec.className = "px"; sec.id = "px"; sec.setAttribute("data-estado", "aguardando");
    sec.setAttribute("aria-labelledby", "px-titulo");
    sec.innerHTML = html(info);
    sec.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-px]");
      if (b && sec.contains(b)) acao(b.getAttribute("data-px"));
    });
    sec.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && $(".px-troca", sec).classList.contains("px-aberto")) { e.preventDefault(); ficar(); }
    });
    el("fluxo").appendChild(sec);
    P.sec = sec;
    ligarRelogio();
    rolagemManual(true);
    empilhar();
    return sec;
  }
  // op.aprovado: a confirmação assume (a entrada do histórico fica, marcada como confirmação)
  function encerrar(op) {
    op = op || {};
    clearInterval(P.relogio); P.relogio = null;
    clearTimeout(P.copiadoT);
    if (P.historico) {
      P.historico = false;
      try {
        if (op.aprovado) history.replaceState({ deo: "confirmacao" }, "");
        else { P.ignorarPop = true; history.back(); }
      } catch (e) { P.ignorarPop = false; }
    }
    if (!P.ignorarPop) rolagemManual(false); // com o "voltar" a caminho, ela volta ao normal quando ele chegar
    if (P.sec) { P.sec.remove(); P.sec = null; }
    P.ev = null;
  }

  CK.px = {
    // usados pelo pagamento.js
    abrir: abrir,
    encerrar: encerrar,
    raiz: function () { return P.sec; },
    titulo: function () { return el("px-titulo"); },
    ponto: function () { var p = P.sec && $(".px-ponto", P.sec); return visivel(p) ? p : null; },
    ativo: function () { return !!P.sec; },
    // ganchos de teste e captura
    estado: estado,
    copiar: copiar,
    copiado: function () { marcarCopiado(true); },
    falhou: function () { marcarCopiado(false); },
    passos: function (abrir) { return alternar(".px-passos", "passos", abrir); },
    qr: function (abrir) { return alternar(".px-qr", "qr", abrir); },
    faltam: function (min) { if (!P.sec) return; P.fim = Date.now() + min * 60000; pintarTempo(); },
    vencer: function () { if (!P.sec) return; P.fim = Date.now(); pintarTempo(); },
    novo: novoCodigo,
    trocar: function (abrir) { return pedirTroca(abrir === undefined ? true : abrir); },
    aprovar: aprovar,
    textos: T
  };
})();
