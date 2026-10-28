/* DeoBeauty · Checkout rápido · v3 · módulo SACOLA (prefixo gv-)
   Aprovado na Rodada 2: d4 · C com o ajuste do usuário. A sacola da loja é a porta de entrada do checkout.
   - Sem CEP e sem frete aqui: a meta de frete grátis aparece como regra da loja, sem prometer nada.
   - Sugestão de 1 ou 2 produtos da MESMA linha de algo que já está na sacola (ideia da opção B), só se a pessoa quiser.
   - Celular (< 600 px): sobe do rodapé e a loja continua visível em cima. Tablet e computador: painel preso ao ícone da sacola.
   Fluxo: a página abre na loja com a sacola aberta (DeoCK.tela("loja") no deo:pronto); fechar deixa a loja com o ícone
   da sacola e o contador; "Finalizar compra" chama DeoCK.abrirCheckout(); os links [data-loja] do checkout e da
   confirmação voltam para a loja com a sacola aberta (só no protótipo).
   A sacola mexe na lista viva do núcleo (DeoCK.itens()) e chama DeoCK.atualizarItens(): o checkout mostra sempre o mesmo.
   No site: é a gaveta do tema; + / − / remover / adicionar usam a API do carrinho (/cart/change.js e /cart/add.js)
   e o checkout lê o mesmo carrinho. Textos no objeto T; nada observa o DOM. Ganchos de teste em DeoCK.gv. */
(function () {
  "use strict";
  var CK = window.DeoCK;
  if (!CK || CK.gv) return; // sem núcleo, ou módulo carregado duas vezes

  var NB = "\u00a0";
  // regras da loja: as mesmas do núcleo (app.js) [pedido ao núcleo: expor DeoCK.regras para não repetir aqui]
  var FRETE_GRATIS = 199, MAX_PARC = 6;
  var MAX_Q = 10; // [a confirmar] limite por item; no site vem do estoque
  var DUR = { celular: 300, painel: 200 }; // sobe do rodapé em 300 ms; o painel aparece em 200 ms

  /* ---------- textos (voz calorosa da v2; nada de pressa, nada de promessa que o CEP ainda não confirmou) ---------- */
  var T = {
    titulo: "Sua sacola",
    itens: function (n) { return n + (n === 1 ? " item" : " itens"); },
    abrir: function (n) { return n ? "Abrir sacola, " + T.itens(n) : "Abrir sacola, vazia"; },
    fechar: "Fechar sacola",
    familia: "Família olfativa: ",
    qtdDe: function (nome) { return "Quantidade de " + nome; },
    unid: function (q) { return q + (q === 1 ? " unidade" : " unidades"); },
    menos: function (nome) { return "Tirar uma unidade de " + nome; },
    mais: function (nome) { return "Pôr mais uma unidade de " + nome; },
    removerDe: function (nome) { return "Remover " + nome + " da sacola"; },
    maximo: function (nome) { return "Por enquanto, até " + MAX_Q + " unidades de " + nome + "."; },
    cada: function (v) { return v + " cada"; },
    saiu: function (nome) { return nome + " saiu da sacola."; },
    desfazer: "Desfazer",
    desfazerDe: function (nome) { return ": devolver " + nome + " para a sacola"; },
    // meta de frete grátis sem CEP: é a regra da loja, quem confirma é o CEP no checkout
    metaFalta: function (v) { return "Faltam <b class=\"num nq\">" + v + "</b> para o frete" + NB + "grátis"; },
    metaOnde: "Na capital de SP, em compras acima de R$" + NB + "199. O CEP confirma no checkout.",
    metaOk: "<b>Frete grátis</b> liberado na capital de SP",
    metaOkOnde: "Seu pedido passou de R$" + NB + "199. O CEP confirma no checkout.",
    // sugestão da mesma linha (opção B): produtos, preços e família conferidos no site em 28/10/2026
    sugTit: function (linha) { return "Para combinar com seu " + linha.replace(/ /g, NB); },
    sugSub: "Da mesma linha, só se você quiser.",
    adicionar: "Adicionar",
    adicionarDe: function (s, v) { return "Adicionar " + s.nome + " " + s.tipo.replace(" · ", ", ").toLowerCase() + ", " + v + ", à sacola"; },
    completa: "Completa os R$" + NB + "199",
    subtotal: "Subtotal",
    cupom: function (c, v) { return "Cupom " + c + " · − " + v; },
    parcela: function (n, v) { return "ou " + n + "x de " + v + " sem" + NB + "juros"; },
    nota: "Frete e cupom você vê na próxima etapa.",
    notaCupom: "O frete você vê na próxima etapa.",
    finalizar: "Finalizar compra",
    seguir: "Continuar comprando",
    ra: "<b>RA" + NB + "1000</b> no Reclame Aqui",
    troca: "Troca fácil em até 7" + NB + "dias",
    vazia: "Sua sacola está vazia",
    vaziaSub: "Os perfumes estão esperando por você.",
    // anúncios do leitor de tela (região role="status")
    aviso: function (nome, q, sub) { return nome + ": " + T.unid(q) + ". Subtotal " + sub + "."; },
    avisoSaiu: function (nome, sub) { return nome + " saiu da sacola. Subtotal " + sub + ". Para devolver, use Desfazer."; },
    avisoVolta: function (nome, sub) { return nome + " voltou para a sacola. Subtotal " + sub + "."; },
    avisoEntra: function (nome, sub) { return nome + " entrou na sacola. Subtotal " + sub + "."; },
    avisoMetaOk: " Frete grátis liberado na capital de SP; o CEP confirma no checkout.",
    avisoMetaFora: function (v) { return " Agora faltam " + v + " para o frete grátis."; },
    avisoVazia: " Sua sacola está vazia."
  };

  /* ---------- produtos da mesma linha que a sacola pode sugerir (dados do site, 28/10/2026) ----------
     O Oud Passion não tem linha no site: com ele sozinho, não há sugestão. */
  var CATALOGO = [
    { id: "sweet-petals-hidratante", linha: "Sweet Petals", nome: "Sweet Petals", tipo: "Loção hidratante · 200 ml", familia: "Floral frutado", preco: 49.9, img: "img/sweet-petals-hidratante.webp" },
    { id: "sweet-petals-perfume", linha: "Sweet Petals", nome: "Sweet Petals", tipo: "Eau de parfum · 100 ml", familia: "Floral frutado", preco: 119.9, img: "img/sweet-petals-perfume.webp" },
    { id: "sweet-petals-bs", linha: "Sweet Petals", nome: "Sweet Petals", tipo: "Body splash · 200 ml", familia: "Floral frutado", preco: 49.9, img: "img/sweet-petals-bs.webp" }
  ];
  var MAX_SUG = 2;

  /* ---------- ícones (os da v2 entram por <use>) ---------- */
  var IC = {
    sacola: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 8h14l-1 12.5H6Z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/></svg>',
    x: '<svg aria-hidden="true"><use href="#i-x"/></svg>',
    menos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14v2H5z"/></svg>',
    mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
    lixo: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.2 10.5v6M13.8 10.5v6"/></svg>',
    caminhao: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3.2v2.8h-7"/><circle cx="6.5" cy="17.2" r="1.8"/><circle cx="17" cy="17.2" r="1.8"/></svg>',
    ok: '<svg aria-hidden="true"><use href="#i-ok"/></svg>',
    selo: '<svg aria-hidden="true"><use href="#i-selo"/></svg>',
    troca: '<svg aria-hidden="true"><use href="#i-troca"/></svg>'
  };

  var root = document.documentElement;
  var calmo = matchMedia("(prefers-reduced-motion: no-preference)");
  var largo = matchMedia("(min-width: 600px)");
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function brl(v) { return "R$" + NB + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function cents(v) { return Math.round(v * 100) / 100; }
  function naLoja() { return root.getAttribute("data-tela") === "loja"; }

  /* ---------- estado da sacola (os itens em si moram no núcleo: DeoCK.itens()) ---------- */
  var G = {
    aberta: false,
    ordem: [],      // ids na ordem em que aparecem (inclui os que saíram e ainda podem voltar com Desfazer)
    saidos: {},     // id → { item, q }: removidos com Desfazer à mão, até a sacola fechar
    comprou: false, // depois do pedido confirmado a sacola fica vazia (protótipo: o núcleo não é mexido)
    metaOk: false
  };

  /* ---------- contas ---------- */
  function lista() { return CK.itens(); }
  function vivos() { return G.comprou ? [] : lista().filter(function (i) { return i.q > 0; }); }
  function item(id) { return vivos().filter(function (i) { return i.id === id; })[0] || null; }
  function unidades() { return vivos().reduce(function (a, i) { return a + i.q; }, 0); }
  // subtotal e cupom pelo retrato do núcleo (o cupom só existe se a pessoa já passou pelo checkout e voltou)
  function contas() {
    if (G.comprou) return { sub: 0, desc: 0, cupom: "", base: 0 };
    var p = CK.pedido(), sub = cents(p.subtotal), desc = cents(p.desconto || 0);
    return { sub: sub, desc: desc, cupom: p.cupom || "", base: cents(sub - desc) };
  }
  function falta(c) { return cents(FRETE_GRATIS - (c || contas()).base); }
  // "Sweet Petals body splash": distingue produtos da mesma linha nos rótulos e anúncios
  function nomeLongo(i) { return i.nome + " " + String(i.tipo).split(" · ")[0].toLowerCase(); }

  function produto(id) { return CATALOGO.filter(function (c) { return c.id === id; })[0] || null; }
  function sugestoes() {
    var v = vivos(), ids = v.map(function (i) { return i.id; });
    var linhas = v.map(function (i) { var c = produto(i.id); return c ? c.linha : ""; }).filter(Boolean);
    if (!linhas.length) return [];
    return CATALOGO.filter(function (c) {
      return linhas.indexOf(c.linha) > -1 && ids.indexOf(c.id) === -1 && !G.saidos[c.id];
    }).slice(0, MAX_SUG);
  }

  /* ---------- montagem ---------- */
  var E = {}; // elementos
  // selos discretos: no rodapé do painel (tablet e computador); no celular, no fim da lista, para o rodapé não crescer
  function htmlSelos(classe) {
    return '<ul class="gv-selos ' + classe + '"><li>' + IC.selo + '<span>' + T.ra + '</span></li>' +
      '<li>' + IC.troca + '<span>' + T.troca + '</span></li></ul>';
  }
  function montar() {
    var ic = document.createElement("button");
    ic.type = "button"; ic.className = "gv-icone"; ic.id = "gv-icone";
    ic.setAttribute("aria-controls", "gv-sacola"); ic.setAttribute("aria-expanded", "false");
    ic.innerHTML = IC.sacola + '<span class="gv-conta num" aria-hidden="true"></span>';

    var veu = document.createElement("div");
    veu.className = "gv-veu"; veu.id = "gv-veu"; veu.hidden = true;

    var s = document.createElement("section");
    s.className = "gv-sacola"; s.id = "gv-sacola"; s.hidden = true;
    s.setAttribute("role", "dialog"); s.setAttribute("aria-modal", "true");
    s.setAttribute("aria-labelledby", "gv-titulo gv-cab-n");
    s.innerHTML =
      '<header class="gv-cab"><h2 id="gv-titulo" tabindex="-1">' + T.titulo + '</h2>' +
        '<span class="gv-cab-n" id="gv-cab-n"></span>' +
        '<button type="button" class="gv-fechar" data-gv="fechar" aria-label="' + T.fechar + '">' + IC.x + '</button></header>' +
      '<div class="gv-rola" id="gv-rola">' +
        '<ul class="gv-itens" id="gv-itens"></ul>' +
        '<div class="gv-vazia" id="gv-vazia" hidden><p class="gv-vazia-t">' + T.vazia + '</p><p>' + T.vaziaSub + '</p>' +
          '<button type="button" class="btn btn-sec" data-gv="fechar">' + T.seguir + '</button></div>' +
        '<div class="gv-extra" id="gv-extra">' +
          '<div class="gv-meta" id="gv-meta"><p class="gv-meta-tx" id="gv-meta-tx"></p>' +
            '<span class="gv-trilho" aria-hidden="true"><i id="gv-barra"></i></span>' +
            '<p class="gv-meta-onde" id="gv-meta-onde"></p></div>' +
          '<section class="gv-sug" id="gv-sug" aria-labelledby="gv-sug-t" hidden><h3 id="gv-sug-t"></h3>' +
            '<p class="gv-sug-sub">' + T.sugSub + '</p><ul class="gv-sugs" id="gv-sugs"></ul></section>' +
        '</div>' +
        '<div class="gv-fim" id="gv-fim">' + htmlSelos("gv-selos-rola") + '</div>' +
      '</div>' +
      // rodapé fixo: a conta e o botão ficam sempre à vista enquanto a lista rola
      '<footer class="gv-pe" id="gv-pe">' +
        '<p class="gv-desc num" id="gv-desc" hidden></p>' +
        '<p class="gv-sub"><span>' + T.subtotal + '</span><b class="num" id="gv-sub"></b></p>' +
        '<p class="gv-parc num" id="gv-parc"></p>' +
        '<button type="button" class="btn btn-pri gv-ir" data-gv="finalizar">' + T.finalizar + '</button>' +
        '<p class="gv-nota" id="gv-nota">' + T.nota + '</p>' +
        '<button type="button" class="gv-link gv-seguir" data-gv="fechar">' + T.seguir + '</button>' +
        htmlSelos("gv-selos-pe") +
      '</footer>' +
      '<p class="vh" role="status" id="gv-aviso"></p>';

    document.body.appendChild(ic); document.body.appendChild(veu); document.body.appendChild(s);
    E = { icone: ic, veu: veu, sacola: s };
    ["titulo", "cab-n", "rola", "itens", "vazia", "extra", "meta", "meta-tx", "barra", "meta-onde", "sug", "sug-t", "sugs",
     "fim", "pe", "desc", "sub", "parc", "nota", "aviso"].forEach(function (k) { E[k] = document.getElementById("gv-" + k); });
  }

  /* ---------- pintura ---------- */
  function htmlMenos(i) {
    // com 1 unidade o "−" vira lixeira (estrutura da opção C); com Desfazer, tirar sem querer custa um toque
    return i.q <= 1
      ? '<button type="button" class="gv-menos gv-lixo" data-gv="remover" data-id="' + i.id + '" aria-label="' + T.removerDe(nomeLongo(i)) + '">' + IC.lixo + '</button>'
      : '<button type="button" class="gv-menos" data-gv="menos" data-id="' + i.id + '" aria-label="' + T.menos(nomeLongo(i)) + '">' + IC.menos + '</button>';
  }
  // "Body splash · 200 ml": se a linha quebrar, quebra depois do "·" (ele fica colado na palavra de antes)
  // e nunca entre "200" e "ml"
  function partesTipo(tipo) { var p = String(tipo).split(" · "); return { tipo: p[0], tam: p[1] ? p[1].replace(/ /g, NB) : "" }; }
  function htmlTipo(tipo) { var p = partesTipo(tipo); return p.tipo + (p.tam ? NB + "· " + p.tam : ""); }
  function htmlQ(q) { return '<span aria-hidden="true">' + q + '</span><span class="vh">' + T.unid(q) + '</span>'; }
  function htmlItem(i) {
    return '<li class="gv-item" data-id="' + i.id + '">' +
      '<span class="gv-foto"><img src="' + i.img + '" alt="" width="64" height="64"></span>' +
      '<p class="gv-info"><b class="gv-nome">' + i.nome + '</b><span class="gv-tipo">' + htmlTipo(i.tipo) + '</span>' +
        (i.familia ? '<span class="gv-fam"><span class="vh">' + T.familia + '</span>' + i.familia + '</span>' : "") + '</p>' +
      '<p class="gv-preco num"><b class="gv-preco-v">' + brl(cents(i.preco * i.q)) + '</b>' +
        '<span class="gv-cada"' + (i.q > 1 ? "" : " hidden") + '>' + T.cada(brl(i.preco)) + '</span></p>' +
      '<div class="gv-qtd" role="group" aria-label="' + T.qtdDe(nomeLongo(i)) + '">' + htmlMenos(i) +
        '<span class="gv-q num">' + htmlQ(i.q) + '</span>' +
        '<button type="button" class="gv-mais" data-gv="mais" data-id="' + i.id + '" aria-label="' + T.mais(nomeLongo(i)) + '"' +
          ' aria-disabled="' + (i.q >= MAX_Q) + '">' + IC.mais + '</button></div>' +
      '</li>';
  }
  function htmlSaiu(i) {
    return '<li class="gv-item gv-saiu" data-id="' + i.id + '"><p>' + T.saiu(nomeLongo(i)) + '</p>' +
      '<button type="button" class="gv-link" data-gv="desfazer" data-id="' + i.id + '">' + T.desfazer +
        '<span class="vh">' + T.desfazerDe(nomeLongo(i)) + '</span></button></li>';
  }

  // guarda o foco antes de redesenhar e devolve ao mesmo botão (ou a um vizinho que faça sentido)
  function lembrarFoco() {
    var a = document.activeElement;
    return a && E.sacola.contains(a) && a.getAttribute("data-gv") ? { gv: a.getAttribute("data-gv"), id: a.getAttribute("data-id") } : null;
  }
  function voltarFoco(f) {
    if (!f || !f.id) return;
    var n = $('[data-gv="' + f.gv + '"][data-id="' + f.id + '"]', E.sacola) || $('.gv-item[data-id="' + f.id + '"] [data-gv]', E.sacola);
    if (n && n !== document.activeElement) n.focus({ preventScroll: true });
  }

  function sincronizarOrdem() {
    var ids = vivos().map(function (i) { return i.id; });
    G.ordem = G.ordem.filter(function (id) { return ids.indexOf(id) > -1 || G.saidos[id]; });
    ids.forEach(function (id) { if (G.ordem.indexOf(id) === -1) G.ordem.push(id); });
  }

  // redesenho completo da lista (entrou, saiu, voltou)
  function pintar(novo) {
    sincronizarOrdem();
    var f = lembrarFoco();
    E.itens.innerHTML = G.ordem.map(function (id) {
      var i = item(id);
      return i ? htmlItem(i) : G.saidos[id] ? htmlSaiu(G.saidos[id].item) : "";
    }).join("");
    E.itens.hidden = !G.ordem.length;
    if (novo) { var li = $('.gv-item[data-id="' + novo + '"]', E.itens); if (li) li.classList.add("gv-entra"); }
    pintarResto();
    voltarFoco(f);
  }
  // só a linha que mudou de quantidade: o botão com foco continua o mesmo elemento
  function pintarLinha(id) {
    var i = item(id), li = $('.gv-item[data-id="' + id + '"]', E.itens);
    if (!i || !li || li.classList.contains("gv-saiu")) return pintar();
    $(".gv-q", li).innerHTML = htmlQ(i.q);
    $(".gv-preco-v", li).textContent = brl(cents(i.preco * i.q));
    var cada = $(".gv-cada", li); cada.hidden = i.q < 2;
    var m = $(".gv-menos", li), lixo = i.q <= 1;
    m.classList.toggle("gv-lixo", lixo);
    m.setAttribute("data-gv", lixo ? "remover" : "menos");
    m.setAttribute("aria-label", lixo ? T.removerDe(nomeLongo(i)) : T.menos(nomeLongo(i)));
    m.innerHTML = lixo ? IC.lixo : IC.menos;
    $(".gv-mais", li).setAttribute("aria-disabled", String(i.q >= MAX_Q));
    pintarResto();
  }

  function pintarResto() {
    var c = contas(), n = unidades(), vazia = !vivos().length, fl = falta(c), ok = fl <= 0;
    // cabeçalho e ícone
    E["cab-n"].innerHTML = n ? '<span aria-hidden="true">· </span>' + T.itens(n) : "";
    $(".gv-conta", E.icone).textContent = n ? String(n) : "";
    E.icone.setAttribute("aria-label", T.abrir(n));
    E.vazia.hidden = !vazia;
    E.extra.hidden = vazia; E.fim.hidden = vazia; E.pe.hidden = vazia;
    // meta de frete grátis (regra da loja; o trilho cresce em até 450 ms)
    E.meta.classList.toggle("gv-ok", ok);
    E["meta-tx"].innerHTML = (ok ? IC.ok : IC.caminhao) + "<span>" + (ok ? T.metaOk : T.metaFalta(brl(fl))) + "</span>";
    E["meta-onde"].textContent = ok ? T.metaOkOnde : T.metaOnde;
    E.barra.style.transform = "scaleX(" + Math.min(1, Math.max(0, c.base / FRETE_GRATIS)).toFixed(3) + ")";
    G.metaOk = ok;
    pintarSugestoes(fl);
    // conta
    E.desc.hidden = !c.desc;
    E.desc.textContent = c.desc ? T.cupom(c.cupom, brl(c.desc)) : "";
    E.sub.textContent = brl(c.base);
    E.parc.textContent = T.parcela(MAX_PARC, brl(cents(c.base / MAX_PARC)));
    E.nota.textContent = c.desc ? T.notaCupom : T.nota;
  }
  function pintarSugestoes(fl) {
    var sugs = sugestoes(), f = lembrarFoco();
    E.sug.hidden = !sugs.length;
    if (!sugs.length) { E.sugs.innerHTML = ""; return; }
    E["sug-t"].textContent = T.sugTit(sugs[0].linha);
    E.sugs.innerHTML = sugs.map(function (s) {
      var completa = fl > 0 && s.preco >= fl, p = partesTipo(s.tipo);
      return '<li class="gv-s" data-id="' + s.id + '">' +
        '<span class="gv-s-foto"><img src="' + s.img + '" alt="" width="56" height="56"></span>' +
        '<p class="gv-s-info"><b>' + p.tipo + '</b>' +
          '<span>' + (p.tam ? p.tam + " · " : "") + '<span class="gv-s-v num nq">' + brl(s.preco) + '</span></span>' +
          (completa ? '<span class="gv-completa">' + T.completa + '</span>' : "") + '</p>' +
        '<button type="button" class="gv-add" data-gv="adicionar" data-id="' + s.id + '" aria-label="' + T.adicionarDe(s, brl(s.preco)) + '">' +
          T.adicionar + '</button></li>';
    }).join("");
    if (f && f.gv === "adicionar") voltarFoco(f);
  }

  // leitor de tela: limpa e escreve de novo para repetir anúncios iguais
  var tAviso = null;
  function avisar(msg) {
    clearTimeout(tAviso); E.aviso.textContent = "";
    tAviso = setTimeout(function () { E.aviso.textContent = msg; }, 40);
  }
  function mudouMeta(antes, c) {
    if (antes === G.metaOk) return "";
    return G.metaOk ? T.avisoMetaOk : T.avisoMetaFora(brl(falta(c)));
  }

  /* ---------- quantidade, remover, desfazer, sugestão ---------- */
  function mudar(id, d) {
    var i = item(id); if (!i) return;
    if (d > 0 && i.q >= MAX_Q) { avisar(T.maximo(nomeLongo(i))); return; }
    if (d < 0 && i.q <= 1) { remover(id); return; }
    var antes = G.metaOk;
    i.q += d;
    CK.atualizarItens();
    pintarLinha(id);
    var c = contas();
    avisar(T.aviso(nomeLongo(i), i.q, brl(c.base)) + mudouMeta(antes, c));
  }
  function remover(id) {
    var i = item(id); if (!i) return;
    var antes = G.metaOk;
    G.saidos[id] = { item: i, q: i.q };
    i.q = 0; CK.atualizarItens(); // o núcleo tira da lista os itens com q 0
    pintar();
    var d = $('[data-gv="desfazer"][data-id="' + id + '"]', E.sacola); if (d) d.focus({ preventScroll: true });
    var c = contas();
    avisar(T.avisoSaiu(nomeLongo(i), brl(c.base)) + (vivos().length ? mudouMeta(antes, c) : T.avisoVazia));
  }
  function desfazer(id) {
    var s = G.saidos[id]; if (!s) return;
    var antes = G.metaOk;
    delete G.saidos[id];
    s.item.q = s.q;
    // volta para o mesmo lugar: depois dos itens que vinham antes dele na sacola
    var anteriores = G.ordem.slice(0, G.ordem.indexOf(id));
    var pos = lista().filter(function (i) { return anteriores.indexOf(i.id) > -1; }).length;
    lista().splice(pos, 0, s.item);
    CK.atualizarItens();
    pintar();
    var b = $('.gv-item[data-id="' + id + '"] .gv-menos', E.sacola); if (b) b.focus({ preventScroll: true });
    var c = contas();
    avisar(T.avisoVolta(nomeLongo(s.item), brl(c.base)) + mudouMeta(antes, c));
  }
  function adicionar(id) {
    var p = produto(id); if (!p || item(id) || G.comprou) return;
    var antes = G.metaOk;
    delete G.saidos[id];
    lista().push({ id: p.id, nome: p.nome, tipo: p.tipo, familia: p.familia, q: 1, preco: p.preco, img: p.img });
    CK.atualizarItens();
    pintar(id);
    // o foco vai para o item novo, onde ele entrou na lista
    var b = $('.gv-item[data-id="' + id + '"] .gv-mais', E.sacola); if (b) b.focus();
    var c = contas();
    avisar(T.avisoEntra(nomeLongo(p), brl(c.base)) + mudouMeta(antes, c));
  }

  /* ---------- abrir, fechar, finalizar, voltar à loja ---------- */
  var tFecha = null;
  function focaveis() {
    return $$("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])", E.sacola).filter(function (n) {
      return !n.disabled && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== "hidden";
    });
  }
  function abrir(op) {
    op = op || {};
    if (!naLoja()) CK.tela("loja");
    clearTimeout(tFecha);
    var sem = op.sem || !calmo.matches;
    if (sem) root.classList.add("gv-sem-mov");
    pintar();
    E.sacola.hidden = false; E.veu.hidden = false;
    void E.sacola.offsetWidth; // o navegador vê o estado fechado antes da transição
    root.classList.add("gv-aberta");
    G.aberta = true;
    E.icone.inert = true; E.icone.setAttribute("aria-expanded", "true");
    E.rola.scrollTop = 0;
    if (sem) requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove("gv-sem-mov"); }); });
    if (op.foco !== false) E.titulo.focus({ preventScroll: true });
  }
  function esconder() {
    E.sacola.hidden = true; E.veu.hidden = true;
    G.saidos = {}; pintar(); // o Desfazer vale enquanto a sacola está aberta
  }
  function fechar(op) {
    op = op || {};
    if (!G.aberta) return;
    G.aberta = false;
    root.classList.remove("gv-aberta");
    E.icone.inert = false; E.icone.setAttribute("aria-expanded", "false");
    clearTimeout(tFecha);
    if (op.ja || !calmo.matches) esconder();
    else tFecha = setTimeout(function () { if (!G.aberta) esconder(); }, largo.matches ? DUR.painel : DUR.celular);
    if (op.foco !== false && naLoja()) E.icone.focus({ preventScroll: true });
  }
  function finalizar() {
    if (!vivos().length) return;
    fechar({ ja: true, foco: false });
    CK.atualizarItens();
    CK.abrirCheckout(); // vai para a etapa aberta, com o foco no título dela
  }
  function voltarLoja() {
    if (root.getAttribute("data-tela") === "confirmacao") G.comprou = true;
    CK.tela("loja");
    window.scrollTo(0, 0);
    abrir();
  }

  /* ---------- eventos ---------- */
  function ligar() {
    E.sacola.addEventListener("click", function (e) {
      var b = e.target.closest("[data-gv]"); if (!b || !E.sacola.contains(b)) return;
      var a = b.getAttribute("data-gv"), id = b.getAttribute("data-id");
      if (b.getAttribute("aria-disabled") === "true" && a !== "mais") return;
      if (a === "fechar") fechar();
      else if (a === "finalizar") finalizar();
      else if (a === "mais") mudar(id, 1);
      else if (a === "menos") mudar(id, -1);
      else if (a === "remover") remover(id);
      else if (a === "desfazer") desfazer(id);
      else if (a === "adicionar") adicionar(id);
    });
    E.icone.addEventListener("click", function () { abrir(); });
    E.veu.addEventListener("click", function () { fechar(); });
    // Esc fecha; Tab e Shift+Tab dão a volta dentro da sacola enquanto ela está aberta por cima da loja
    document.addEventListener("keydown", function (e) {
      if (!G.aberta) return;
      if (e.key === "Escape") { e.preventDefault(); fechar(); return; }
      if (e.key !== "Tab") return;
      var l = focaveis(); if (!l.length) return;
      var i = l.indexOf(document.activeElement), fim = l.length - 1;
      if (e.shiftKey && i <= 0) { e.preventDefault(); l[fim].focus(); }
      else if (!e.shiftKey && (i === -1 || i === fim)) { e.preventDefault(); l[0].focus(); }
    });
    // protótipo: logo e "Voltar à loja" (checkout, Pix, confirmação) voltam para a loja com a sacola aberta.
    // Só o clique simples; Ctrl/⌘/Shift + clique continuam abrindo a loja de verdade.
    document.addEventListener("click", function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest("[data-loja]");
      if (!a) return;
      e.preventDefault();
      voltarLoja();
    });
    // outra tela tomou a frente (checkout, Pix…): a sacola sai sem movimento
    // e se outro módulo trouxer a loja de volta sem abrir a sacola, o contador do ícone chega certo
    document.addEventListener("deo:tela", function (e) {
      var t = e.detail && e.detail.tela;
      if (t !== "loja" && G.aberta) fechar({ ja: true, foco: false });
      else if (t === "loja" && !G.aberta) pintar();
    });
    // pedido confirmado: na volta à loja, a sacola está vazia
    document.addEventListener("deo:aprovado", function () { G.comprou = true; G.saidos = {}; });
    // só no protótipo (v3.1): "Simular nova compra" na confirmação. O núcleo já voltou a sacola de exemplo;
    // aqui ela deixa de estar vazia e o fluxo recomeça como na abertura da página: loja com a sacola aberta
    document.addEventListener("deo:nova-compra", function () {
      G.comprou = false; G.saidos = {}; G.ordem = []; G.metaOk = false;
      CK.tela("loja");
      window.scrollTo(0, 0);
      abrir();
    });
  }

  /* ---------- início: a página abre na loja com a sacola aberta ---------- */
  var iniciado = false;
  function iniciar() {
    if (iniciado) return; iniciado = true;
    try {
      montar(); ligar();
      // link direto para o checkout (#checkout): a loja fica a um toque, pelo "Voltar à loja"
      if (location.hash === "#checkout") return;
      CK.tela("loja");
      abrir({ sem: true });
    } finally {
      root.classList.remove("gv-pre");
    }
  }
  // o núcleo põe data-tela no deo:pronto; se ele já passou (módulo injetado depois), começa na hora
  if (root.hasAttribute("data-tela")) iniciar();
  else {
    root.classList.add("gv-pre"); // até o deo:pronto, o checkout não pisca antes da loja
    document.addEventListener("deo:pronto", iniciar);
  }

  /* ---------- ganchos de teste e capturas: DeoCK.gv ---------- */
  function qualId(x) {
    if (typeof x === "number") { var v = vivos()[x]; return v ? v.id : ""; }
    return x || "";
  }
  CK.gv = {
    abrir: function () { abrir(); },
    fechar: function () { fechar(); },
    mais: function (x) { mudar(qualId(x), 1); },
    menos: function (x) { mudar(qualId(x), -1); },
    remover: function (x) { remover(qualId(x)); },
    desfazer: function (x) { var id = qualId(x) || Object.keys(G.saidos).pop(); if (id) desfazer(id); },
    adicionar: function (x) { var s = sugestoes(); adicionar(x || (s[0] && s[0].id)); },
    sugestoes: function () { return sugestoes().map(function (s) { return s.id; }); },
    // sacola vazia "de verdade" (como depois de fechar e abrir de novo): sem as linhas de Desfazer
    esvaziar: function () {
      vivos().forEach(function (i) { i.q = 0; }); CK.atualizarItens(); G.saidos = {}; pintar();
    },
    finalizar: finalizar,
    voltarLoja: voltarLoja,
    estado: G
  };
})();
