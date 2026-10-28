/* DeoBeauty · Checkout v3 · módulo “volta” (cliente que volta) · prefixo cv-
   Decisão aprovada na Rodada 2: d3 · C, “Os dois: lembrado no aparelho e código para ver ou mudar”.

   O que o módulo faz
   1. 1ª compra: no fim da etapa 3 (#slot-pagamento-fim), a caixa “Lembrar meus dados neste aparelho”, desmarcada.
      Se ela estiver marcada quando o pagamento for aprovado (deo:aprovado), o aparelho passa a lembrar a pessoa
      por 180 dias e a confirmação diz como esquecer.
   2. Mesmo aparelho, próxima compra: o checkout abre direto no pagamento com o cartão creme “Oi de novo, Marina!”
      (#slot-pagamento-topo). WhatsApp, endereço e CPF aparecem sempre com partes escondidas; ver tudo ou alterar
      pede um código de 6 números no WhatsApp. “Não é você?” esquece o aparelho e começa do zero.
   3. Outro aparelho: quem digita na etapa 1 um WhatsApp que a loja conhece vê a oferta do código (#slot-contato);
      com o código certo, endereço e CPF chegam preenchidos e a pessoa vai direto para o pagamento.

   Protótipo: nenhum código é enviado (o de exemplo é 123456) e o cadastro da loja é simulado no navegador.
   No site real o aparelho guarda só uma chave opaca, gravada pelo servidor, e o servidor devolve os dados já com
   partes escondidas; os dados completos só saem do servidor depois do código certo (ver docs/modulos/volta.md).
   Contrato com o núcleo: window.DeoCK (js/app.js). Ganchos de teste: DeoCK.cv (ver docs/modulos/volta.md). */
(function () {
  "use strict";
  var DeoCK = window.DeoCK;
  if (!DeoCK || DeoCK.cv) return;

  /* ---------- textos (aprovados na r2-d3 C; ajustados só para encaixar nas telas da v3) ---------- */
  var NB = " ";
  var T = {
    // cartão de quem volta no mesmo aparelho
    oi: function (n) { return "Oi de novo, " + n + "!"; },
    oiSub: "Seus dados estão lembrados neste aparelho.",
    trava: "Ver tudo ou alterar pede um código no seu WhatsApp.",
    naoSou: "Não é você?",
    naoSouPergunta: "Vamos esquecer os dados lembrados neste aparelho e começar do zero.",
    esquecer: "Esquecer e começar do zero",
    cancelar: "Cancelar",
    esqueceu: "Pronto, esquecemos os dados deste aparelho.",
    rotWhats: "WhatsApp", rotEntrega: "Entrega", rotCpf: "CPF na nota",
    alterar: "Alterar", trocar: "Trocar",
    vhWhats: " WhatsApp", vhEntrega: " entrega", vhCpf: " CPF",
    freteLinha: function (e) { return e ? e.nome + ", previsão " + String(e.previsao).replace(/ /g, NB) : ""; },
    // leitor de tela: o que está escondido é dito com palavras, nunca como uma fila de bolinhas
    falaTel: function (fim) { return "número terminado em " + fim.split("").join(" "); },
    falaEmail: function (ini, dominio) { return "e-mail que começa com " + ini + " e termina em " + dominio; },
    falaRua: function (visivel) { return visivel + ", resto escondido"; },
    falaNumero: "número escondido",
    falaCpf: function (meio) { return "começo e fim escondidos, meio " + meio; },
    // janela do código
    jTitulo: "Confirme que é você",
    jTexto: {
      1: "Para mostrar seu contato completo, enviamos um código de 6 números para ",
      2: "Para mostrar o endereço completo, enviamos um código de 6 números para "
    },
    noWhats: " no WhatsApp.",
    jSem: { 1: "Digitar outro contato, sem código", 2: "Usar outro endereço, sem código" },
    jFechar: "Fechar",
    liberado: "Pronto! Agora você vê e altera seus dados.",
    redigitar: {
      1: "Por segurança, a gente não mostra o contato lembrado completo. Digite de novo.",
      2: "Por segurança, a gente não mostra o endereço lembrado completo. Digite de novo."
    },
    // campo do código (o “faltam números” vem dos textos aprovados da opção B, que dividem o mesmo campo)
    codRot: "Código de 6 números",
    codErro: "Esse código não confere. Confira os 6 números ou peça outro.",
    codFalta: "Faltam números. O código tem 6.",
    reenviarEm: function (s) { return "Reenviar em " + Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); },
    reenviar: "Reenviar código",
    reenviado: "Código reenviado.",
    prototipo: "Só no protótipo: o código é ",
    // outro aparelho: oferta na etapa 1
    wTitulo: "Que bom te ver de novo!",
    wOferta: "Com um código no seu WhatsApp, a gente preenche endereço e CPF para você.",
    wReceber: "Receber código no WhatsApp",
    wAgoraNao: "Agora não",
    wEnviado: "Enviamos um código de 6 números para ",
    semCodigo: "Continuar sem código",
    pronto: function (n) { return "Pronto, " + n + "! Endereço e CPF preenchidos. Confira e pague."; },
    limpar: "Não é você? Limpar dados",
    limpou: "Pronto, limpamos os dados desta compra.",
    // permissão na 1ª compra e aviso na confirmação
    lembrarRot: "Lembrar meus dados neste aparelho",
    lembrarAjuda: "Na próxima compra, é só pagar. Para ver tudo ou mudar algo, a gente manda um código no seu WhatsApp. Fica por 180 dias.",
    fimLembrou: "Seus dados ficam lembrados neste aparelho por 180 dias. Para esquecer, toque em “Não é você?” na próxima compra.",
    fimEsqueceu: "Pronto, esquecemos seus dados neste aparelho."
  };

  /* ---------- configuração ---------- */
  var DIAS = 180;                         // [a confirmar] validade da memória (o site atual usa 180 dias)
  var ESPERA = 30;                        // [a confirmar] segundos até poder pedir outro código
  var CODIGO_EXEMPLO = "123456";          // só no protótipo: nenhum código é enviado
  var CHAVE_APARELHO = "deo-cv-aparelho"; // o que o aparelho guarda: {v, ate, chave}
  var CHAVE_LOJA = "deo-cv-sim-loja";     // só no protótipo: faz o papel do cadastro no servidor da loja
  // cliente que a loja já conhece (no site real: cadastro da cliente, com o endereço do último pedido)
  var EXEMPLO = {
    nome: "Marina Costa", whats: "(11) 98765-4321", email: "marina.costa@email.com",
    cep: "05121-120", rua: "Rua José Fernandes Lobo", bairro: "Parque São Domingos", cidade: "São Paulo", uf: "SP",
    numero: "220", semNumero: false, complemento: "", cpf: "529.982.247-25", frete: "anjun", manual: false
  };

  /* ---------- utilidades ---------- */
  var raiz = document.documentElement;
  var S = DeoCK.estado;
  var SVG = "http://www.w3.org/2000/svg";
  function el(id) { return document.getElementById(id); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function dig(s) { return String(s || "").replace(/\D+/g, ""); }
  function numWhats(s) { var d = dig(s); if (d.length === 13 && d.slice(0, 2) === "55") d = d.slice(2); return d; }
  function primeiro(n) { return String(n || "").trim().split(/\s+/)[0] || ""; }
  function copia(o) { var c = {}; Object.keys(o || {}).forEach(function (k) { c[k] = o[k]; }); return c; }
  // cria elementos sem innerHTML: dado digitado entra sempre como texto
  function h(tag, at, filhos) {
    var n = document.createElement(tag);
    Object.keys(at || {}).forEach(function (k) {
      var v = at[k];
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else if (v === true) n.setAttribute(k, "");
      else if (v !== false && v != null) n.setAttribute(k, v);
    });
    (filhos || []).forEach(function f(x) {
      if (x == null || x === false) return;
      if (Array.isArray(x)) x.forEach(f);
      else n.appendChild(typeof x === "string" ? document.createTextNode(x) : x);
    });
    return n;
  }
  // ícones: os do núcleo vêm do sprite da página; os do módulo são desenhados aqui
  function icone(id) {
    var s = document.createElementNS(SVG, "svg"), u = document.createElementNS(SVG, "use");
    s.setAttribute("aria-hidden", "true"); s.setAttribute("focusable", "false");
    u.setAttribute("href", "#" + id); s.appendChild(u);
    return s;
  }
  var DESENHO = {
    chat: "M12 3c5 0 9 3.6 9 8.1s-4 8.1-9 8.1c-1.2 0-2.4-.2-3.4-.6L4 20.4l1.3-3.8A7.7 7.7 0 0 1 3 11.1C3 6.6 7 3 12 3Zm0 2C8 5 5 7.7 5 11.1c0 1.5.6 2.9 1.7 4l.4.4-.6 1.8 2.2-.9.4.2c.9.4 1.9.6 2.9.6 4 0 7-2.7 7-6.1S16 5 12 5Z",
    doc: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v10h16V7Zm2 2h5v2H6Zm0 4h8v2H6Zm10-4h2v2h-2Z"
  };
  function desenho(nome) {
    var s = document.createElementNS(SVG, "svg"), p = document.createElementNS(SVG, "path");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.setAttribute("focusable", "false");
    p.setAttribute("d", DESENHO[nome]); s.appendChild(p);
    return s;
  }
  // texto com partes escondidas: os olhos veem as bolinhas, o leitor de tela ouve a frase
  function falado(visivel, fala) { return [h("span", { "aria-hidden": "true", text: visivel }), h("span", { class: "vh", text: fala })]; }

  /* ---------- partes escondidas: o suficiente para a pessoa se reconhecer, nunca o dado inteiro ---------- */
  var M = {
    nome: function (n) { var p = String(n || "").trim().split(/\s+/); return p[0] + (p.length > 1 ? " " + p[p.length - 1].charAt(0) + "." : ""); },
    tel: function (w) { var d = numWhats(w); return "(" + d.slice(0, 2) + ")" + NB + "•••••-" + d.slice(-4); },
    email: function (e) { e = String(e || ""); var i = e.indexOf("@"); return i > 0 ? e.slice(0, Math.min(2, i)) + "•••" + e.slice(i) : ""; },
    // “Rua José Fernandes Lobo” → “Rua José F•••”; “Avenida Paulista” → “Avenida P•••”
    ruaVisivel: function (r) {
      var p = String(r || "").trim().split(/\s+/).filter(Boolean); if (!p.length) return "";
      var k = p.length >= 3 ? 2 : p.length - 1;
      return p.slice(0, k).concat(p[k].charAt(0)).join(" ");
    },
    rua: function (r) { var v = M.ruaVisivel(r); return v ? v + "•••" : ""; },
    cpf: function (c) { var d = dig(c); return "•••." + d.slice(3, 6) + "." + d.slice(6, 9) + "-••"; }
  };
  var F = {
    tel: function (w) { return T.falaTel(numWhats(w).slice(-4)); },
    email: function (e) { e = String(e || ""); var i = e.indexOf("@"); return i > 0 ? T.falaEmail(e.slice(0, Math.min(2, i)), e.slice(i + 1)) : ""; },
    cpf: function (c) { var d = dig(c); return T.falaCpf(d.slice(3, 6) + " " + d.slice(6, 9)); }
  };

  /* ---------- memória do aparelho (localStorage sempre dentro de try/catch) ----------
     Aparelho: só {v, ate, chave}. A chave aponta para o cadastro no “servidor” (aqui simulado em CHAVE_LOJA).
     Navegação anônima, aparelho sem espaço ou memória bloqueada: o checkout segue normal, sem lembrar. */
  function ler(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function apagar(k) { try { localStorage.removeItem(k); } catch (e) { /* nada a apagar */ } }

  function lojaSim() { var l = ler(CHAVE_LOJA); return l && l.chaves && l.clientes ? l : { chaves: {}, clientes: {} }; }
  function clientePorWhats(n) {
    var c = lojaSim().clientes[n];
    if (c) return c;
    return numWhats(EXEMPLO.whats) === n ? EXEMPLO : null;
  }
  function clientePorChave(ch) { var n = lojaSim().chaves[ch]; return n ? clientePorWhats(n) : null; }
  function memoria() {
    var m = ler(CHAVE_APARELHO);
    if (!m || m.v !== 1 || !m.chave) return null;
    if (!(Date.now() < m.ate)) { esquecerAparelho(m); return null; } // passou de 180 dias: esquece sozinho
    return m;
  }
  // grava (ou renova por mais 180 dias) a memória deste aparelho; devolve false se o aparelho não deixar
  function lembrarAparelho(d) {
    var l = lojaSim(), n = numWhats(d.whats), velha = ler(CHAVE_APARELHO);
    if (velha && velha.chave) delete l.chaves[velha.chave];
    var chave = "cv-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    l.chaves[chave] = n; l.clientes[n] = d;
    if (!gravar(CHAVE_LOJA, l)) return false;
    if (gravar(CHAVE_APARELHO, { v: 1, ate: Date.now() + DIAS * 864e5, chave: chave })) return true;
    delete l.chaves[chave]; gravar(CHAVE_LOJA, l);
    return false;
  }
  // esquece o aparelho: apaga a chave daqui e a invalida na loja (o cadastro da cliente continua na loja)
  function esquecerAparelho(m) {
    m = m || ler(CHAVE_APARELHO);
    if (m && m.chave) { var l = lojaSim(); if (l.chaves[m.chave]) { delete l.chaves[m.chave]; gravar(CHAVE_LOJA, l); } }
    apagar(CHAVE_APARELHO);
  }
  // o que vai para a loja quando o pagamento é aprovado
  function registroDoPedido(info) {
    var e = info.endereco || {};
    return {
      nome: info.nome, whats: info.whats, email: info.email || "",
      cep: e.cep, rua: e.rua, bairro: e.bairro, cidade: e.cidade, uf: e.uf,
      numero: e.numero, semNumero: !!el("sem-numero").checked, complemento: e.complemento || "",
      cpf: info.cpf, frete: S.frete || "", manual: !!S.manual
    };
  }

  /* ---------- estado do módulo ---------- */
  var lembrado = null;      // {chave, dados}: este aparelho lembrou a pessoa e o checkout abriu com partes escondidas
  var verificado = false;   // o código certo já foi digitado nesta visita
  var jaAplicado = false;   // a memória entra uma vez por visita
  var aplicando = false;    // preenchendo os campos por código (não é a pessoa digitando)
  var dispensado = {};      // WhatsApps em que a pessoa disse “Agora não”
  var cartao = null, linhas = {}, caixaLembrar = null, anuncio = null, slots = {};

  /* ---------- preencher o checkout com dados conhecidos ---------- */
  function preencherCom(d) {
    aplicando = true;
    DeoCK.preencher({
      nome: d.nome, whats: d.whats, email: d.email || "", cep: d.cep,
      semNumero: !!d.semNumero, numero: d.semNumero ? null : d.numero,
      complemento: d.complemento || "", cpf: d.cpf, frete: d.frete || null
    });
    // CEP sem rua: o núcleo abre o endereço manual e o módulo completa (pedido ao núcleo em docs/modulos/volta.md: preencher com rua, bairro…)
    if (S.manual) {
      [["rua", d.rua], ["bairro", d.bairro], ["cidade", d.cidade]].forEach(function (p) {
        var i = el(p[0]); i.value = p[1] || ""; i.dispatchEvent(new Event("input", { bubbles: true }));
      });
      el("uf").value = d.uf || ""; el("uf").dispatchEvent(new Event("change", { bubbles: true }));
    }
    aplicando = false;
  }

  // começa do zero: campos, erros e etapas do lado do módulo (o núcleo também tem DeoCK.limpar())
  function zerarCheckout() {
    fecharJanela(false);
    tirarOferta();
    tirarCartao();
    tirarAvisos();
    raiz.classList.remove("cv-lembrado", "cv-mask-1", "cv-mask-2", "cv-mask-cpf");
    lembrado = null; verificado = false; dispensado = {};
    if (caixaLembrar) caixaLembrar.checked = false;
    aplicando = true;
    S.frete = null; S.recebeOutro = false;
    ["rua", "bairro", "cidade", "recebe"].forEach(function (id) { el(id).value = ""; });
    el("uf").value = "";
    DeoCK.limparCartao(); el("cc-nome").value = "";
    DeoCK.preencher({ nome: "", whats: "", email: "", complemento: "", cpf: "", cep: "", semNumero: false, numero: "", pag: "pix" });
    aplicando = false;
    $$('#form [aria-invalid="true"]').forEach(function (n) { n.setAttribute("aria-invalid", "false"); });
    $$("#form .erro").forEach(function (n) { n.textContent = ""; n.hidden = true; });
    S.feito[1] = S.feito[2] = S.feito[3] = false; S.max = 1;
    DeoCK.irPara(1);
  }

  /* ---------- avisos curtos (criados na hora) e um anúncio para o leitor de tela ---------- */
  function anunciar(msg) {
    if (!anuncio) return;
    anuncio.textContent = "";
    setTimeout(function () { anuncio.textContent = msg; }, 60);
  }
  function tirarAvisos() { $$(".cv-aviso, .cv-nota").forEach(function (n) { n.remove(); }); }
  // o aviso pertence ao momento: some quando a pessoa sai da etapa em que ele apareceu
  function limparAvisosFora() {
    var atual = el("etapa-" + S.atual);
    $$(".cv-aviso, .cv-nota").forEach(function (n) { if (n.closest(".etapa") !== atual) n.remove(); });
  }
  // etapa 3 tem lugar reservado; nas etapas 1 e 2 o aviso vai no começo do corpo (pedido ao núcleo em docs/modulos/volta.md: lugares no topo)
  function lugarDoAviso(k) { return k === 3 ? slots.topo : el("etapa-" + k).querySelector(".etapa-corpo"); }
  function avisoEtapa(k, msg, acao) {
    tirarAvisos();
    var a = h("div", { class: "cv-aviso" }, [h("span", { class: "cv-aviso-ic" }, [icone("i-ok")]), h("p", { text: msg }), acao]);
    lugarDoAviso(k).prepend(a);
    anunciar(msg);
    return a;
  }
  function notaEtapa(k, msg) {
    tirarAvisos();
    lugarDoAviso(k).prepend(h("p", { class: "cv-nota" }, [icone("i-cadeado"), h("span", { text: msg })]));
  }

  /* ---------- campo do código: 1 campo só (aceita colar e a sugestão do teclado), desenhado como 6 casas ---------- */
  function campoCodigo(id, conferir) {
    var inp = h("input", {
      id: id, class: "cv-cod-in", type: "text", inputmode: "numeric", autocomplete: "one-time-code",
      maxlength: "6", spellcheck: "false", autocapitalize: "off", "aria-invalid": "false"
    });
    var casas = h("div", { class: "cv-casas", "aria-hidden": "true" });
    for (var i = 0; i < 6; i++) casas.appendChild(h("span"));
    var caixa = h("div", { class: "cv-cod" }, [h("label", { class: "vh", for: id, text: T.codRot }), inp, casas]);
    var erro = h("p", { class: "erro", id: id + "-erro", role: "alert", hidden: true });
    function pinta() {
      var v = inp.value;
      $$("span", casas).forEach(function (s, k) {
        s.textContent = v.charAt(k);
        s.classList.toggle("atual", k === Math.min(v.length, 5));
      });
    }
    function limpaErro() {
      if (erro.hidden) return;
      erro.hidden = true; erro.textContent = "";
      inp.setAttribute("aria-invalid", "false"); caixa.classList.remove("cv-errado");
    }
    // erro diz o que fazer; com o código errado, o próximo número digitado já substitui os 6
    function mostraErro(msg, selecionar) {
      erro.textContent = msg; erro.hidden = false;
      inp.setAttribute("aria-invalid", "true"); caixa.classList.add("cv-errado");
      if (selecionar) inp.select();
    }
    inp.addEventListener("input", function () {
      var v = dig(inp.value).slice(0, 6);
      if (v !== inp.value) inp.value = v;
      limpaErro(); pinta();
      if (v.length === 6) conferir(v, mostraErro);
    });
    inp.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault(); // Enter confere o código e não envia a etapa que está por baixo
      if (inp.value.length === 6) conferir(inp.value, mostraErro); else mostraErro(T.codFalta, false);
    });
    inp.addEventListener("focus", function () { caixa.classList.add("foco"); });
    inp.addEventListener("blur", function () { caixa.classList.remove("foco"); });
    pinta();
    return {
      caixa: caixa, erro: erro, input: inp,
      zerar: function () { inp.value = ""; limpaErro(); pinta(); },
      descrever: function (ids) { inp.setAttribute("aria-describedby", ids + " " + erro.id); }
    };
  }
  // “Reenviar em 0:30”, depois o botão; reenviar devolve o foco ao campo (o botão some de novo)
  function reenvio(depois) {
    var conta = h("span", { class: "num" });
    var b = h("button", { type: "button", class: "link cv-reenviar-b", text: T.reenviar, hidden: true });
    var st = h("span", { class: "vh", role: "status" });
    var t = null, s = 0;
    function para() { if (t) clearInterval(t); t = null; }
    function tic() {
      var fim = s <= 0;
      conta.textContent = fim ? "" : T.reenviarEm(s);
      conta.hidden = fim; b.hidden = !fim;
      if (fim) para(); else s--;
    }
    function inicia() { para(); s = ESPERA; tic(); t = setInterval(tic, 1000); }
    b.addEventListener("click", function () { inicia(); st.textContent = ""; setTimeout(function () { st.textContent = T.reenviado; }, 60); depois(); });
    return { no: h("p", { class: "cv-reenviar" }, [conta, b, st]), inicia: function () { st.textContent = ""; inicia(); }, para: para };
  }
  function dicaPrototipo() { return h("p", { class: "cv-prototipo" }, [T.prototipo, h("b", { class: "num", text: CODIGO_EXEMPLO }), "."]); }

  /* =====================================================================
     1ª compra: a pessoa escolhe, com a caixa desmarcada, se o aparelho lembra
     ===================================================================== */
  function montarLembrar() {
    caixaLembrar = h("input", { type: "checkbox", id: "cv-lembrar", "aria-describedby": "cv-lembrar-ajuda" });
    slots.fim.appendChild(h("div", { class: "cv-lembrar" }, [
      h("label", { class: "marca", for: "cv-lembrar" }, [caixaLembrar, h("span", { text: T.lembrarRot })]),
      h("p", { class: "ajuda", id: "cv-lembrar-ajuda", text: T.lembrarAjuda })
    ]));
  }
  // deo:aprovado {info, slot}: grava (ou esquece) e diz na confirmação o que ficou guardado
  function aoAprovar(e) {
    var det = (e && e.detail) || {}, info = det.info || DeoCK.pedido(), slot = det.slot, msg = "";
    fecharJanela(false);
    jaAplicado = true;
    if (caixaLembrar.checked) { if (lembrarAparelho(registroDoPedido(info))) msg = T.fimLembrou; }
    else if (memoria()) { esquecerAparelho(); msg = T.fimEsqueceu; }
    if (!slot || !slot.appendChild) return;
    $$(".cv-fim", slot).forEach(function (n) { n.remove(); });
    if (msg) slot.appendChild(h("p", { class: "cv-fim" }, [icone("i-cadeado"), h("span", { text: msg })]));
  }

  /* =====================================================================
     Mesmo aparelho: abre direto no pagamento, com partes escondidas
     ===================================================================== */
  function entrarLembrado() {
    if (jaAplicado || lembrado || verificado) return;
    // a pessoa já começou a preencher: a memória não passa por cima
    if (S.feito[1] || S.atual !== 1 || el("nome").value || el("whats").value) return;
    var m = memoria(); if (!m) return;
    var d = clientePorChave(m.chave);
    if (!d) { esquecerAparelho(m); return; }
    jaAplicado = true;
    raiz.classList.add("cv-lembrado", "cv-mask-1", "cv-mask-2", "cv-mask-cpf");
    preencherCom(d);
    // dado guardado que não passa mais na conferência do núcleo: esquece em vez de abrir uma etapa com tudo à mostra
    if (!(DeoCK.validar(1) && DeoCK.validar(2) && DeoCK.validar(3))) { esquecerAparelho(m); zerarCheckout(); return; }
    lembrado = { chave: m.chave, dados: d };
    DeoCK.marcarFeitas([1, 2]);
    montarCartao(d);
    caixaLembrar.checked = true; // ela já tinha escolhido lembrar; desmarcar e pagar esquece o aparelho
    DeoCK.irPara(3, { foco: false });
  }

  function montarCartao(d) {
    tirarCartao();
    var nome = primeiro(d.nome), entrega = DeoCK.pedido().entrega, frete = T.freteLinha(entrega);
    var naoSou = blocoNaoSou();
    linhas = {
      1: linha("1", desenho("chat"), T.rotWhats, falado(M.tel(d.whats), F.tel(d.whats)),
        falado(M.nome(d.nome) + (d.email ? " · " + M.email(d.email) : ""), M.nome(d.nome) + (d.email ? ", " + F.email(d.email) : "")),
        T.alterar, T.vhWhats, function () { abrirJanela(1, this); }),
      2: linha("2", icone("i-pino"), T.rotEntrega,
        falado(M.rua(d.rua) + ", nº" + NB + "••• · " + String(d.cidade).replace(/ /g, NB) + "/" + d.uf, T.falaRua(M.ruaVisivel(d.rua)) + ", " + T.falaNumero + ", " + d.cidade + ", " + d.uf),
        frete ? [frete] : null, T.alterar, T.vhEntrega, function () { abrirJanela(2, this); }),
      cpf: linha("cpf", desenho("doc"), T.rotCpf, falado(M.cpf(d.cpf), F.cpf(d.cpf)), null, T.trocar, T.vhCpf, trocarCpf)
    };
    cartao = h("section", { class: "cv-cartao", "aria-labelledby": "cv-c-t" }, [
      h("div", { class: "cv-c-cab" }, [
        h("span", { class: "cv-avatar", "aria-hidden": "true", text: nome.charAt(0).toUpperCase() }),
        h("div", { class: "cv-c-tx" }, [h("h3", { class: "cv-c-t", id: "cv-c-t", text: T.oi(nome) }), h("p", { class: "cv-c-sub", text: T.oiSub }), naoSou.link])
      ]),
      naoSou.caixa,
      h("ul", { class: "cv-linhas" }, [linhas[1], linhas[2], linhas.cpf]),
      h("p", { class: "cv-trava" }, [icone("i-cadeado"), h("span", { text: T.trava })])
    ]);
    slots.topo.appendChild(cartao);
  }
  function linha(k, ic, rotulo, valor, sub, acao, vh, aoTocar) {
    var b = h("button", { type: "button", class: "cv-alt" }, [acao, h("span", { class: "vh", text: vh })]);
    b.addEventListener("click", aoTocar);
    return h("li", { class: "cv-l cv-l-" + k }, [
      h("span", { class: "cv-l-ic" }, [ic]),
      h("p", { class: "cv-l-tx" }, [h("b", { text: rotulo }), h("span", { class: "cv-l-v" }, valor), sub ? h("small", {}, sub) : null]),
      b
    ]);
  }
  function tirarCartao() { if (cartao) cartao.remove(); cartao = null; linhas = {}; }
  // a parte que a pessoa digitou de novo sai do cartão; sem partes escondidas, sai também o aviso do código
  function tirarLinha(k) {
    raiz.classList.remove("cv-mask-" + k);
    if (linhas[k]) { linhas[k].remove(); delete linhas[k]; }
    if (cartao && !Object.keys(linhas).length) cartao.classList.add("cv-cartao-sem-linhas");
  }

  // “Não é você?”: pergunta antes de esquecer
  function blocoNaoSou() {
    var q = h("p", { id: "cv-confirma-p", tabindex: "-1", text: T.naoSouPergunta });
    var sim = h("button", { type: "button", class: "btn btn-sec cv-esquecer", text: T.esquecer });
    var nao = h("button", { type: "button", class: "link cv-cancelar", text: T.cancelar });
    var caixa = h("div", { class: "cv-confirma", id: "cv-confirma", hidden: true }, [q, h("div", { class: "cv-confirma-acoes" }, [sim, nao])]);
    var link = h("button", { type: "button", class: "link cv-naosou", "aria-expanded": "false", "aria-controls": "cv-confirma", text: T.naoSou });
    function abre(sim) { caixa.hidden = !sim; link.setAttribute("aria-expanded", String(sim)); }
    link.addEventListener("click", function () { var abrir = caixa.hidden; abre(abrir); if (abrir) q.focus(); });
    nao.addEventListener("click", function () { abre(false); link.focus(); });
    sim.addEventListener("click", function () {
      esquecerAparelho();
      zerarCheckout();
      avisoEtapa(1, T.esqueceu);
    });
    return { link: link, caixa: caixa };
  }

  function trocarCpf() {
    tirarLinha("cpf");
    aplicando = true; DeoCK.preencher({ cpf: "" }); aplicando = false;
    el("cpf").focus();
  }
  // sem código: a parte lembrada some e a pessoa digita de novo (nada do que estava guardado aparece)
  function redigitar(k) {
    aplicando = true;
    if (k === 1) DeoCK.preencher({ nome: "", whats: "", email: "" });
    else {
      S.frete = null;
      ["rua", "bairro", "cidade"].forEach(function (id) { el(id).value = ""; });
      el("uf").value = "";
      DeoCK.preencher({ cep: "", semNumero: false, numero: "", complemento: "" });
    }
    aplicando = false;
    tirarLinha(k);
    DeoCK.irPara(k);
    notaEtapa(k, T.redigitar[k]);
  }
  // código certo: tudo aparece completo (as linhas de resumo e o CPF voltam a mostrar o dado inteiro)
  function liberar() {
    verificado = true;
    raiz.classList.remove("cv-lembrado", "cv-mask-1", "cv-mask-2", "cv-mask-cpf");
    tirarCartao();
  }

  /* =====================================================================
     Janela “Confirme que é você”: sobe do rodapé no celular; no computador fica no centro
     ===================================================================== */
  var jan = { caixa: null }, inertes = [];
  function montarJanela() {
    var titulo = h("h2", { id: "cv-j-t", tabindex: "-1", text: T.jTitulo });
    var x = h("button", { type: "button", class: "cv-j-x", "aria-label": T.jFechar }, [icone("i-x")]);
    jan.p = h("p", { class: "cv-j-p", id: "cv-j-p" });
    jan.cod = campoCodigo("cv-cod-j", conferirJanela);
    jan.cod.descrever("cv-j-p");
    jan.re = reenvio(function () { jan.cod.input.focus(); });
    jan.sem = h("button", { type: "button", class: "link cv-j-sem" });
    jan.veu = h("div", { class: "cv-veu", hidden: true });
    jan.caixa = h("div", { class: "cv-janela", id: "cv-janela", role: "dialog", "aria-modal": "true", "aria-labelledby": "cv-j-t", hidden: true }, [
      h("div", { class: "cv-j-cab" }, [titulo, x]), jan.p, jan.cod.caixa, jan.cod.erro, dicaPrototipo(), jan.re.no,
      h("div", { class: "cv-j-pe" }, [jan.sem])
    ]);
    document.body.appendChild(jan.veu); document.body.appendChild(jan.caixa);
    x.addEventListener("click", function () { fecharJanela(true); });
    jan.veu.addEventListener("click", function () { fecharJanela(true); });
    jan.sem.addEventListener("click", function () { var k = jan.k; fecharJanela(false); redigitar(k); });
  }
  function abrirJanela(k, origem) {
    if (!lembrado) return;
    if (!jan.caixa) montarJanela();
    var d = lembrado.dados;
    jan.k = k; jan.origem = origem || document.activeElement;
    jan.p.textContent = "";
    jan.p.appendChild(document.createTextNode(T.jTexto[k]));
    jan.p.appendChild(h("b", { class: "num nq" }, falado(M.tel(d.whats), F.tel(d.whats))));
    jan.p.appendChild(document.createTextNode(T.noWhats));
    jan.sem.textContent = T.jSem[k];
    jan.cod.zerar(); jan.re.inicia();
    jan.caixa.hidden = false; jan.veu.hidden = false;
    // o resto da página fica inerte enquanto a janela está aberta
    inertes = Array.prototype.filter.call(document.body.children, function (n) {
      return n !== jan.caixa && n !== jan.veu && n !== anuncio && !n.inert;
    });
    inertes.forEach(function (n) { n.inert = true; });
    raiz.classList.add("cv-janela-aberta");
    jan.cod.input.focus({ preventScroll: true });
  }
  function fecharJanela(devolverFoco) {
    if (!jan.caixa || jan.caixa.hidden) return;
    jan.caixa.hidden = true; jan.veu.hidden = true; jan.re.para();
    inertes.forEach(function (n) { n.inert = false; }); inertes = [];
    raiz.classList.remove("cv-janela-aberta");
    if (devolverFoco && jan.origem && jan.origem.isConnected) jan.origem.focus();
  }
  function conferirJanela(v, erro) {
    if (v !== CODIGO_EXEMPLO) { erro(T.codErro, true); return; }
    var k = jan.k;
    fecharJanela(false);
    liberar();
    DeoCK.irPara(k);
    avisoEtapa(k, T.liberado);
  }
  // Esc fecha; Tab e Shift+Tab dão a volta dentro da janela
  function teclado(e) {
    if (!jan.caixa || jan.caixa.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); fecharJanela(true); return; }
    if (e.key !== "Tab") return;
    var l = $$("button, input", jan.caixa).filter(function (n) { return !n.disabled && n.getClientRects().length > 0; });
    if (!l.length) return;
    var i = l.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); l[l.length - 1].focus(); }
    else if (!e.shiftKey && (i === -1 || i === l.length - 1)) { e.preventDefault(); l[0].focus(); }
  }

  /* =====================================================================
     Outro aparelho: a loja reconhece o WhatsApp digitado na etapa 1
     ===================================================================== */
  var oferta = null;
  function montarOferta() {
    var o = { num: "" };
    var receber = h("button", { type: "button", class: "btn btn-sec cv-o-btn" }, [desenho("chat"), h("span", { text: T.wReceber })]);
    var agora = h("button", { type: "button", class: "link cv-o-agora", text: T.wAgoraNao });
    o.f1 = h("div", { class: "cv-o-fase" }, [h("p", { class: "cv-o-p", text: T.wOferta }), h("div", { class: "cv-o-acoes" }, [receber, agora])]);
    o.tel = h("b", { class: "num nq" });
    o.cod = campoCodigo("cv-cod-w", conferirOferta);
    o.cod.descrever("cv-o-p2");
    o.re = reenvio(function () { o.cod.input.focus(); });
    var sem = h("button", { type: "button", class: "link cv-o-sem", text: T.semCodigo });
    o.f2 = h("div", { class: "cv-o-fase", hidden: true }, [
      h("p", { class: "cv-o-p", id: "cv-o-p2" }, [T.wEnviado, o.tel, T.noWhats]),
      o.cod.caixa, o.cod.erro, dicaPrototipo(), h("div", { class: "cv-o-pe" }, [o.re.no, sem])
    ]);
    o.no = h("div", { class: "cv-oferta", id: "cv-oferta" }, [h("h3", { class: "cv-o-t", text: T.wTitulo }), o.f1, o.f2]);
    receber.addEventListener("click", function () { pedirCodigo(); o.cod.input.focus(); });
    agora.addEventListener("click", dispensar);
    sem.addEventListener("click", dispensar);
    return o;
  }
  function mostrarOferta(n) {
    if (!oferta) oferta = montarOferta();
    oferta.num = n;
    oferta.f1.hidden = false; oferta.f2.hidden = true; oferta.re.para();
    raiz.classList.remove("cv-codigo-on");
    if (!oferta.no.isConnected) slots.contato.appendChild(oferta.no);
    anunciar(T.wTitulo + " " + T.wOferta);
  }
  function pedirCodigo() {
    if (!oferta || !oferta.no.isConnected) return;
    oferta.tel.textContent = "";
    falado(M.tel(oferta.num), F.tel(oferta.num)).forEach(function (n) { oferta.tel.appendChild(n); });
    oferta.f1.hidden = true; oferta.f2.hidden = false;
    oferta.cod.zerar(); oferta.re.inicia();
    raiz.classList.add("cv-codigo-on"); // o e-mail vem do cadastro: sai da tela enquanto o código está nela
  }
  function tirarOferta() {
    if (!oferta) return;
    oferta.re.para(); oferta.num = "";
    if (oferta.no.isConnected) oferta.no.remove();
    raiz.classList.remove("cv-codigo-on");
  }
  function dispensar() {
    if (oferta && oferta.num) dispensado[oferta.num] = true;
    tirarOferta();
    el("email").focus();
  }
  // a oferta aparece quando a pessoa digita (ou o celular preenche) um WhatsApp conhecido;
  // preenchimentos feitos por código (DeoCK.exemplo, DeoCK.preencher) não chamam a oferta
  function reconhecer(e) {
    if (aplicando || (e && !e.isTrusted)) return;
    var n = numWhats(el("whats").value);
    var pode = n.length === 11 && !!clientePorWhats(n) && !verificado && !lembrado && !dispensado[n];
    if (pode) { if (!oferta || oferta.num !== n || !oferta.no.isConnected) mostrarOferta(n); }
    else tirarOferta();
  }
  function conferirOferta(v, erro) {
    if (v !== CODIGO_EXEMPLO) { erro(T.codErro, true); return; }
    var d = copia(clientePorWhats(oferta.num));
    if (!d.whats) return;
    // vale o que a pessoa já escreveu nesta compra
    var nome = el("nome").value.trim(), email = el("email").value.trim();
    if (nome.split(/\s+/).length >= 2) d.nome = nome;
    if (email) d.email = email;
    verificado = true;
    tirarOferta();
    preencherCom(d);
    DeoCK.marcarFeitas([1, 2]);
    DeoCK.irPara(3);
    var limpar = h("button", { type: "button", class: "link cv-limpar", text: T.limpar });
    limpar.addEventListener("click", function () { zerarCheckout(); avisoEtapa(1, T.limpou); });
    avisoEtapa(3, T.pronto(primeiro(d.nome)), limpar);
  }
  // seguiu para a entrega sem usar a oferta: vale como “Agora não”
  function depoisDeEnviar() {
    if (oferta && oferta.no.isConnected && S.atual !== 1) { dispensado[oferta.num] = true; tirarOferta(); }
    limparAvisosFora();
  }

  /* ---------- ligar (depois de deo:pronto: o núcleo já desenhou tudo) ---------- */
  var iniciado = false;
  function iniciar() {
    if (iniciado) return;
    slots = { contato: el("slot-contato"), topo: el("slot-pagamento-topo"), fim: el("slot-pagamento-fim") };
    if (!slots.contato || !slots.topo || !slots.fim || !el("cpf")) return; // núcleo sem os lugares reservados
    iniciado = true;
    // marcas nos campos que o módulo esconde (pedido ao núcleo em docs/modulos/volta.md: ids próprios)
    el("cpf").closest(".campo").classList.add("cv-campo-cpf");
    el("email").closest(".campo").classList.add("cv-campo-email");
    anuncio = h("p", { class: "vh", id: "cv-anuncio", role: "status" });
    document.body.appendChild(anuncio);
    montarLembrar();
    el("whats").addEventListener("input", reconhecer);
    // com partes escondidas, o núcleo não pode completar “Nome impresso no cartão” com o nome inteiro
    $$('input[name="pag"]').forEach(function (r) {
      r.addEventListener("change", function () {
        var cc = el("cc-nome");
        if (lembrado && raiz.classList.contains("cv-mask-1") && cc.value === el("nome").value.trim().toUpperCase()) cc.value = "";
      });
    });
    el("form").addEventListener("submit", depoisDeEnviar);
    el("form").addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-ir]")) limparAvisosFora(); });
    document.addEventListener("keydown", teclado);
    document.addEventListener("deo:checkout", entrarLembrado);
    document.addEventListener("deo:tela", function (e) { if (!e.detail || e.detail.tela !== "checkout") fecharJanela(false); });
    document.addEventListener("deo:aprovado", aoAprovar);
    // só no protótipo (v3.1): "Simular nova compra" começa outra visita. A memória do aparelho fica: se a pessoa
    // marcou "Lembrar meus dados", a próxima ida ao checkout abre no "Oi de novo"
    document.addEventListener("deo:nova-compra", function () { zerarCheckout(); jaAplicado = false; });
    if (raiz.getAttribute("data-tela") === "checkout") entrarLembrado();
  }
  if (document.readyState === "loading") document.addEventListener("deo:pronto", iniciar);
  else setTimeout(iniciar, 0); // carregado depois da página: o núcleo já ligou

  /* ---------- ganchos para capturas e testes (documentados em docs/modulos/volta.md) ---------- */
  function campoVisivel() {
    if (jan.caixa && !jan.caixa.hidden) return jan.cod.input;
    if (oferta && oferta.no.isConnected && !oferta.f2.hidden) return oferta.cod.input;
    return null;
  }
  DeoCK.cv = {
    // grava no aparelho a cliente de exemplo, como se a 1ª compra tivesse sido aprovada com a caixa marcada
    lembrarExemplo: function () { return lembrarAparelho(copia(EXEMPLO)); },
    // mesmo aparelho, próxima compra: começa do zero, lembra a cliente de exemplo e abre direto no pagamento
    voltar: function () {
      zerarCheckout(); tirarAvisos();
      lembrarAparelho(copia(EXEMPLO));
      jaAplicado = false; entrarLembrado();
      window.scrollTo(0, 0);
    },
    // apaga a memória do aparelho e o cadastro simulado (a cliente de exemplo continua conhecida pela loja)
    esquecer: function () { esquecerAparelho(); apagar(CHAVE_LOJA); },
    // abre a janela do código: 1 contato, 2 entrega (só com o cartão “Oi de novo” na tela)
    abrirCodigo: function (k) { abrirJanela(k === 1 ? 1 : 2, linhas[k === 1 ? 1 : 2] ? linhas[k === 1 ? 1 : 2].querySelector(".cv-alt") : null); },
    // digita um código no campo que estiver na tela (janela ou etapa 1)
    codigo: function (v) { var i = campoVisivel(); if (!i) return; i.focus({ preventScroll: true }); i.value = String(v); i.dispatchEvent(new Event("input", { bubbles: true })); },
    // outro aparelho: sem memória, a pessoa digita nome e o WhatsApp conhecido; fase "codigo" já pediu o código
    outroAparelho: function (fase) {
      esquecerAparelho(); zerarCheckout(); tirarAvisos();
      aplicando = true; DeoCK.preencher({ nome: EXEMPLO.nome, whats: EXEMPLO.whats }); aplicando = false;
      reconhecer();
      if (fase === "codigo") pedirCodigo();
      window.scrollTo(0, 0);
    },
    // abre a pergunta “Não é você?”
    naoSou: function () { var b = cartao && cartao.querySelector(".cv-naosou"); if (b && b.getAttribute("aria-expanded") !== "true") b.click(); },
    // 1ª compra: preenche o exemplo até o pagamento e mostra a caixa (marcada ou não)
    primeiraCompra: function (marcar) {
      esquecerAparelho(); zerarCheckout(); tirarAvisos();
      DeoCK.exemplo(3);
      caixaLembrar.checked = !!marcar;
      caixaLembrar.closest(".cv-lembrar").scrollIntoView({ block: "center" });
    },
    // para outros módulos (ex.: confirmação): true enquanto a tela mostra só partes escondidas
    mascarado: function () { return raiz.classList.contains("cv-lembrado"); },
    estado: function () {
      return {
        lembrado: !!lembrado, verificado: verificado, mascarado: DeoCK.cv.mascarado(),
        partes: { contato: raiz.classList.contains("cv-mask-1"), entrega: raiz.classList.contains("cv-mask-2"), cpf: raiz.classList.contains("cv-mask-cpf") },
        oferta: !!(oferta && oferta.no.isConnected), janela: !!(jan.caixa && !jan.caixa.hidden),
        memoria: memoria()
      };
    }
  };
})();
