/* DeoBeauty · Checkout rápido · v3 · módulo pagamento · movimento da aprovação (r2-d7 B)
   "O sinal de espera vira o selo de aprovado". Prefixo mv-. Quem chama é o pagamento.js:
     var antes = DeoCK.mv.medir({ origem, saidas, cor })   ainda na tela que sai (Pix ou checkout);
     ... troca o DOM (confirmação montada, foco no título) ...
     DeoCK.mv.tocar(antes, ok)                              ok = { selo, grupos } da confirmação.

   Linha do tempo (ms):
     0–90     a tela que sai (cópia inerte) se apaga subindo 6 px; o pontinho rosa (ou o botão) fica com o selo;
     0–440    o selo verde nasce do tamanho e do lugar do pontinho (ou do botão), voa até o lugar dele e
              assenta com um passo além de 6 %; o rosa (ou preto) vira verde nos primeiros 90 ms;
     140–320  o ✓ se revela da esquerda para a direita;
     90–405   número e título, frase e WhatsApp, linha do tempo, recibo e botões entram subindo 12 px (passo de 30 ms);
     380–680  um anel verde sai do selo uma vez e some. Tudo legível em 0,44 s, tudo parado em 0,68 s.
   Só transform e opacity (Web Animations). O DOM já trocou antes: foco, leitor de tela e toque não esperam nada;
   a cópia que sai é inerte, sem ids e fora do leitor de tela. Com "reduzir movimento": troca imediata.
   Aprovação com a aba escondida (a pessoa está no app do banco): a troca acontece, a passagem espera ela voltar. */
(function () {
  "use strict";
  var CK = window.DeoCK;
  if (!CK) return;

  var MOV = {
    sai: 90, subida: 6,                 // tela que sai
    selo: 440, assenta: 1.06,           // voo do selo
    cor: 90,                            // rosa (ou preto) → verde
    veu: 140, veuDur: 180,              // ✓ se revela
    anel: 380, anelDur: 300, anelEsc: 1.7,
    inicio: 90, passo: 30, maxPasso: 2.5, entra: 240, sobe: 12
  };
  var EASE = "cubic-bezier(.2,.7,.2,1)"; // o mesmo --ease do app.css
  var calmo = matchMedia("(prefers-reduced-motion: no-preference)");
  var ATRIBUTOS = ["id", "name", "for", "tabindex", "role", "aria-labelledby", "aria-describedby", "aria-controls", "aria-live", "aria-label", "autofocus"];

  var vivas = [], voo = null, extras = [], pendente = null;

  function pode() { return calmo.matches && typeof Element.prototype.animate === "function"; }
  function anima(n, kf, op) { var a = n.animate(kf, op); vivas.push(a); return a; }
  function naTela(r) { return r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth; }

  /* ---------- cópia inerte da tela que sai ----------
     Cada saída vira uma cópia sem ids, nomes, rótulos nem foco, presa ao lugar em que estava na tela.
     Se uma saída está dentro de outra (o rodapé fixo do celular dentro do checkout), ela sai da cópia de fora
     e ganha a própria cópia, no lugar dela (assim nada "fixo" pula de lugar). */
  function caminho(raiz, n) {
    var c = [];
    while (n && n !== raiz) { c.unshift(Array.prototype.indexOf.call(n.parentNode.children, n)); n = n.parentNode; }
    return n === raiz ? c : null;
  }
  function seguir(raiz, c) { var n = raiz; for (var i = 0; n && i < c.length; i++) n = n.children[c[i]]; return n; }
  function copiar(saidas) {
    var vistas = saidas.filter(function (s) { return s && s.getClientRects().length > 0; });
    return vistas.map(function (s) {
      var r = s.getBoundingClientRect(), c = s.cloneNode(true);
      // a cópia de um <select> volta para a primeira opção: repõe a escolhida (ex.: "3x de R$ 53,23")
      var so = s.querySelectorAll("select"), sc = c.querySelectorAll("select");
      for (var i = 0; i < so.length && i < sc.length; i++) sc[i].selectedIndex = so[i].selectedIndex;
      vistas.forEach(function (outra) {
        if (outra === s || !s.contains(outra)) return;
        var cam = caminho(s, outra), alvo = cam && seguir(c, cam);
        if (alvo) alvo.remove();
      });
      [c].concat(Array.prototype.slice.call(c.querySelectorAll("*"))).forEach(function (n) {
        ATRIBUTOS.forEach(function (a) { n.removeAttribute(a); });
        if (n.classList) n.classList.remove("entra", "revela", "px-surge");
      });
      // sobras que não estavam à vista: passagem de etapa do núcleo, confirmação ou Pix de uma compra anterior
      Array.prototype.slice.call(c.querySelectorAll(".d7-fantasma-raiz, .ok, .px")).forEach(function (n) { n.remove(); });
      c.classList.add("mv-copia");
      return { no: c, x: r.left, y: r.top, w: r.width, h: r.height };
    });
  }

  // cor de fundo como aparece na tela (o botão ocupado fica com opacidade .8 sobre o branco)
  function corVista(n) {
    var cs = getComputedStyle(n), m = (cs.backgroundColor || "").match(/[\d.]+/g);
    if (!m || m.length < 3) return "";
    var k = (m[3] !== undefined ? +m[3] : 1) * (parseFloat(cs.opacity) || 1);
    return "rgb(" + [0, 1, 2].map(function (i) { return Math.round(+m[i] * k + 255 * (1 - k)); }).join(",") + ")";
  }

  /* ---------- 1) medir: chamado ainda com a tela que sai ----------
     op.origem: o pontinho rosa de "Esperando seu Pix" ou o botão de pagar (cartão/carteira);
     op.saidas: o que sai de cena; op.cor: cor de partida do selo (padrão: a cor de fundo da origem). */
  function medir(op) {
    op = op || {};
    if (!pode()) return null;
    var o = op.origem, r = o && o.getClientRects().length ? o.getBoundingClientRect() : null;
    var cor = op.cor || (o ? corVista(o) : "");
    return {
      origem: r && naTela(r) ? { x: r.left + r.width / 2, y: r.top + r.height / 2, d: Math.min(r.width, r.height) } : null,
      cor: cor,
      copias: copiar(op.saidas || [])
    };
  }

  /* ---------- 2) tocar: depois que a confirmação já está no lugar ---------- */
  function tocar(antes, ok) {
    limpar();
    if (!antes || !ok || !ok.selo) return;
    if (document.hidden) {
      pendente = { antes: antes, ok: ok };
      document.addEventListener("visibilitychange", aoVoltar);
      return;
    }
    executar(antes, ok);
  }
  function aoVoltar() {
    if (document.hidden || !pendente) return;
    var p = pendente; pendente = null;
    document.removeEventListener("visibilitychange", aoVoltar);
    if (pode() && p.ok.selo.isConnected) executar(p.antes, p.ok);
  }

  function executar(antes, ok) {
    // camada por cima de tudo, sem toque e fora do leitor de tela: cópias que saem e o anel
    voo = document.createElement("div");
    voo.className = "mv-voo"; voo.setAttribute("aria-hidden", "true"); voo.inert = true;
    antes.copias.forEach(function (c) {
      var s = c.no.style;
      s.position = "absolute"; s.left = c.x + "px"; s.top = c.y + "px"; s.width = c.w + "px";
      s.right = "auto"; s.bottom = "auto"; s.margin = "0"; s.maxWidth = "none";
      voo.appendChild(c.no);
      anima(c.no, [{ opacity: 1 }, { opacity: 0 }], { duration: MOV.sai, easing: "linear", fill: "forwards" });
      anima(c.no, [{ transform: "none" }, { transform: "translateY(-" + MOV.subida + "px)" }], { duration: MOV.sai, easing: "ease-in", fill: "forwards" });
    });
    // o pontinho da cópia não sai com ela: ele "é" o selo agora
    Array.prototype.slice.call(voo.querySelectorAll(".px-ponto")).forEach(function (p) { p.style.visibility = "hidden"; });
    document.body.appendChild(voo);

    // selo: nasce do pontinho (ou do botão), na cor dele, e voa até o lugar
    var selo = ok.selo, r = selo.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var o = antes.origem || { x: cx, y: cy, d: r.width * 0.2 }; // sem sinal à vista: nasce pequeno no próprio lugar
    var s0 = o.d / r.width;
    selo.classList.add("mv-voando");
    var cor = document.createElement("i"); cor.className = "mv-cor"; if (antes.cor) cor.style.background = antes.cor;
    var veu = document.createElement("i"); veu.className = "mv-veu";
    selo.appendChild(veu); selo.appendChild(cor);
    extras.push(cor, veu);
    anima(selo, [
      { transform: "translate(" + (o.x - cx) + "px," + (o.y - cy) + "px) scale(" + s0 + ")", easing: "cubic-bezier(.25,.6,.3,1)" },
      { transform: "scale(" + MOV.assenta + ")", offset: 0.66, easing: "cubic-bezier(.45,0,.4,1)" },
      { transform: "none" }
    ], { duration: MOV.selo });
    anima(cor, [{ opacity: 1 }, { opacity: 0 }], { duration: MOV.cor, easing: "linear", fill: "forwards" });
    anima(veu, [{ transform: "translateX(0)" }, { transform: "translateX(101%)" }], { duration: MOV.veuDur, delay: MOV.veu, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" });

    // detalhe: um anel sai do selo uma vez, quando ele assenta
    var anel = document.createElement("i"); anel.className = "mv-anel";
    anel.style.left = r.left + "px"; anel.style.top = r.top + "px"; anel.style.width = r.width + "px"; anel.style.height = r.height + "px";
    voo.appendChild(anel);
    anima(anel, [{ opacity: 0.5, transform: "scale(1)" }, { opacity: 0, transform: "scale(" + MOV.anelEsc + ")" }], { duration: MOV.anelDur, delay: MOV.anel, easing: EASE });

    // o conteúdo entra em sequência curta
    (ok.grupos || []).forEach(function (g, i) {
      var atraso = MOV.inicio + Math.min(i, MOV.maxPasso) * MOV.passo;
      g.forEach(function (n) {
        if (!n || !n.getClientRects().length) return;
        anima(n, [{ opacity: 0, transform: "translateY(" + MOV.sobe + "px)" }, { opacity: 1, transform: "none" }],
          { duration: MOV.entra, delay: atraso, easing: EASE, fill: "backwards" });
      });
    });

    // quando tudo para, sai o que era só da passagem
    var minhas = vivas.slice(), v = voo;
    Promise.all(minhas.map(function (a) { return a.finished; })).then(function () {
      if (v === voo) arrumar();
    }, function () { /* cancelada por limpar() */ });
  }

  function arrumar() {
    extras.forEach(function (n) { n.remove(); }); extras = [];
    Array.prototype.slice.call(document.querySelectorAll(".mv-voando")).forEach(function (n) { n.classList.remove("mv-voando"); });
    if (voo) { voo.remove(); voo = null; }
    vivas = [];
  }
  function limpar() {
    vivas.forEach(function (a) { try { a.cancel(); } catch (e) { /* já terminou */ } });
    vivas = [];
    arrumar();
    pendente = null;
    document.removeEventListener("visibilitychange", aoVoltar);
  }

  // saiu da confirmação no meio da passagem: nada fica para trás
  document.addEventListener("deo:tela", function (e) { if ((e.detail || {}).antes === "confirmacao") limpar(); });

  CK.mv = {
    medir: medir,
    tocar: tocar,
    limpar: limpar,
    tempos: MOV,
    // gancho de teste: true enquanto a passagem espera a aba voltar
    pendente: function () { return !!pendente; }
  };
})();
