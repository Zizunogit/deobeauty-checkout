/* DeoBeauty · Checkout rápido · v3 (Rodadas 1 e 2 aplicadas) · núcleo
   Protótipo: CEP, frete, cupom e pagamento são simulados no navegador.
   Modos de estrutura: <html data-modo="passos|pagina|janela"> (padrão: passos, aprovado em r1-d1).
   Ganchos para capturas: window.DeoCK.exemplo(etapa, {pag, cupom, cep, numero}), DeoCK.modo(m), DeoCK.resumo(true),
   DeoCK.carteiras(["apple"] | ["google"] | []), DeoCK.carteira(),
   DeoCK.aoPagar = fn(info) → true assume a tela depois de pagar; DeoCK.pedido(); DeoCK.pagarExemplo({pag}).
   Módulos (js/sacola.js, volta.js, pix.js, confirmacao.js, movimento.js, pagamento.js) conversam com o núcleo
   só por window.DeoCK e pelos eventos deo:pronto, deo:tela, deo:checkout, deo:etapa, deo:itens, deo:aprovado
   e deo:nova-compra (v3.1, só no protótipo: DeoCK.novaCompra() recomeça depois do pedido confirmado). */
(function () {
  "use strict";

  /* ---------- dados do protótipo ---------- */
  var ITENS = [
    { id: "oud-passion", nome: "Oud Passion", tipo: "Eau de parfum · 100\u00a0ml", familia: "Amadeirado", q: 1, preco: 99.9, img: "img/oud-passion.webp" },
    { id: "sweet-petals-bs", nome: "Sweet Petals", tipo: "Body splash · 200\u00a0ml", familia: "Floral frutado", q: 1, preco: 49.9, img: "img/sweet-petals-bs.webp" }
  ];
  // sacola de exemplo do começo: "Simular nova compra" (só no protótipo) volta para ela
  var ITENS_INICIO = ITENS.map(function (i) { return Object.assign({}, i); });
  var FRETES = [
    { id: "anjun", nome: "Anjun", dias: 3, preco: 9.9 },
    { id: "jt", nome: "J&T Express", dias: 2, preco: 10.0 }
  ];
  var CEPS = {
    "05121120": { rua: "Rua José Fernandes Lobo", bairro: "Parque São Domingos", cidade: "São Paulo", uf: "SP" },
    "01310100": { rua: "Avenida Paulista", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP" }
  };
  var CUPONS = { DEOQUIZ10: { pct: 10 } };
  var CARTEIRAS = { apple: "Apple Pay", google: "Google Pay" }; // [a confirmar com o provedor de pagamento]
  var FRETE_GRATIS = 199;
  var MAX_PARC = 6;
  var UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  /* ---------- textos (voz calorosa, r1-d3 C) ---------- */
  var NB = " ";
  var T = {
    nome: "Escreva seu nome e sobrenome. Ex.:" + NB + "Maria" + NB + "Souza",
    whatsVazio: "Digite seu WhatsApp com DDD. Ex.:" + NB + "(11)" + NB + "91234-5678",
    whatsRuim: "Confira o número com DDD. Ex.:" + NB + "(11)" + NB + "91234-5678",
    emailRuim: "Confira o e-mail. Ex.:" + NB + "maria@email.com",
    cep: "Digite os 8 números do CEP. Ex.:" + NB + "01310-100",
    cepNada: "Não encontramos esse CEP. Confira os números.",
    numero: "Faltou o número. Se não tiver, marque “Sem" + NB + "número”.",
    recebe: "Escreva nome e sobrenome de quem vai receber. Ex.:" + NB + "Maria" + NB + "Souza",
    rua: "Digite a rua ou avenida.",
    bairro: "Digite o bairro.",
    cidade: "Digite a cidade.",
    uf: "Escolha o estado.",
    cpf: "Confira o CPF, são 11 números. Ex.:" + NB + "123.456.789-09",
    ccNum: "Confira o número do cartão, com todos os dígitos.",
    ccVal: "Confira a validade. Ex.:" + NB + "08/29",
    ccVenc: "Esse cartão venceu. Use outro ou pague com Pix.",
    ccCvv: "Digite os 3 ou 4 números do verso.",
    ccNome: "Digite o nome como está no cartão.",
    fatCep: "Digite os 8 números do CEP da fatura. Ex.:" + NB + "01310-100",
    fatRua: "Digite a rua e o número da fatura. Ex.:" + NB + "Avenida Paulista, 1000",
    cupomRuim: "Não achamos esse cupom. Confira letras e números.",
    cupomTag: function (c, pct) { return c + " · " + pct + "% off"; },
    cupomOk: function (c, pct, t) { return "Cupom " + c + " aplicado: " + pct + "% de desconto. Total agora: " + t + "."; },
    cupomFora: function (t) { return "Cupom removido. Total agora: " + t + "."; },
    freteAntes: "Calculado após o CEP",
    gratis: "Grátis",
    previsao: function (data, dias) { return "Previsão: " + data + " (" + dias + NB + "dias" + NB + "úteis)"; },
    previsaoCurta: function (data) { return "Previsão:" + NB + data.replace(/ /g, NB); },
    seloRapido: "Mais rápido",
    seloBarato: "Mais barato",
    metaFalta: function (v) { return "Faltam " + v + " para frete grátis na capital" + NB + "de" + NB + "SP."; },
    metaOk: "Você ganhou frete grátis na capital" + NB + "de" + NB + "SP.",
    parcela: function (n, v) { return "ou " + n + "x de " + v + " sem juros"; },
    itens: function (n) { return n + (n === 1 ? " item" : " itens"); },
    qtd: function (n) { return n + " unidades"; },
    voce: function (nome) { return nome ? nome + " (você)" : "Você"; },
    outraPessoa: "Outra pessoa",
    euRecebo: "Eu vou receber",
    semNumero: "s/n",
    cartaoV: function (n, v) { return "até " + n + "x de " + v; },
    parcOpc: function (n, v) { return n === 1 ? "1x de " + v + " (à vista)" : n + "x de " + v + " sem juros"; },
    pagarPix: function (v) { return "Pagar " + v + " com Pix"; },
    pagarCartao: function (v) { return "Pagar " + v + " no cartão"; },
    pagarParc: function (n, v) { return "Pagar " + n + "x de " + v + " no cartão"; },
    cartInfo: function (c) { return "Ao tocar no botão, abre a janela do " + c + ". Você escolhe o cartão e confirma com o rosto ou a digital."; },
    cartInfoPc: function (c) { return "O botão abre a janela do " + c + ". Lá você escolhe o cartão e confirma a compra."; },
    botao: { entrega: "Continuar para a entrega", pagamento: "Continuar para o pagamento" },
    ocupado: { pix: "Gerando o seu Pix…", cartao: "Confirmando com o banco…", carteira: function (c) { return "Abrindo o " + c + "…"; } },
  };

  /* ---------- estado ---------- */
  var S = {
    atual: 1, max: 1, feito: { 1: false, 2: false, 3: false },
    endereco: null, manual: false, frete: null,
    pag: "pix", parcelas: 1, cupom: null, recebeOutro: false,
    carteiras: matchMedia("(max-width: 767px)").matches ? ["apple"] : ["google"]
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var el = function (id) { return document.getElementById(id); };
  var modo = function () { return document.documentElement.getAttribute("data-modo") || "passos"; };
  var celular = matchMedia("(max-width: 1023px)");
  var calmo = matchMedia("(prefers-reduced-motion: no-preference)");
  var painel = function () { return celular.matches && modo() !== "janela"; };

  /* ---------- utilidades ---------- */
  function brl(v) { return "R$" + NB + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function dig(s) { return String(s || "").replace(/\D+/g, ""); }
  function cents(v) { return Math.round(v * 100) / 100; }
  function nomeCompleto(s) { return String(s || "").trim().split(/\s+/).filter(Boolean).length >= 2; }
  function mascaraCel(s) {
    var d = dig(s); if (d.length > 11 && d.slice(0, 2) === "55") d = d.slice(2); d = d.slice(0, 11);
    if (!d) return ""; if (d.length <= 2) return "(" + d;
    var r = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length === 10 ? 6 : 7);
    var resto = d.slice(d.length === 10 ? 6 : 7); return resto ? r + "-" + resto : r;
  }
  function celValido(s) { var d = dig(s); if (d.length === 13 && d.slice(0, 2) === "55") d = d.slice(2); return /^[1-9][1-9]9\d{8}$/.test(d); }
  function emailValido(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s).trim()); }
  function mascaraCep(s) { var d = dig(s).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; }
  function mascaraCpf(s) {
    var d = dig(s).slice(0, 11), r = d.slice(0, 3);
    if (d.length > 3) r += "." + d.slice(3, 6); if (d.length > 6) r += "." + d.slice(6, 9); if (d.length > 9) r += "-" + d.slice(9);
    return r;
  }
  function cpfValido(s) {
    var d = dig(s); if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (var t = 9; t < 11; t++) { var soma = 0; for (var i = 0; i < t; i++) soma += +d[i] * (t + 1 - i); var dv = (soma * 10) % 11 % 10; if (dv !== +d[t]) return false; }
    return true;
  }
  function bandeira(n) {
    var d = dig(n);
    if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(d)) return "Elo";
    if (/^(606282|3841)/.test(d)) return "Hipercard";
    if (/^3[47]/.test(d)) return "Amex";
    if (/^4/.test(d)) return "Visa";
    if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
    return "";
  }
  function mascaraCartao(s) {
    var d = dig(s).slice(0, 19);
    if (/^3[47]/.test(d)) return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
    return d.replace(/(\d{4})(?=\d)/g, "$1 ");
  }
  function luhn(n) { var d = dig(n), s = 0, alt = false; for (var i = d.length - 1; i >= 0; i--) { var x = +d[i]; if (alt) { x *= 2; if (x > 9) x -= 9; } s += x; alt = !alt; } return d.length >= 13 && s % 10 === 0; }
  function mascaraVal(s) { var d = dig(s).slice(0, 4); return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d; }
  // feriados nacionais (fixos + Sexta-feira Santa). No site, a data vem da cotação da transportadora [a confirmar]
  var FERIADOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
  function pascoa(a) {
    var b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4, g = Math.floor((c + 8) / 25),
      h = Math.floor((c - g + 1) / 3), i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4,
      m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451), mes = Math.floor((i + m - 7 * n + 114) / 31);
    return new Date(a, mes - 1, ((i + m - 7 * n + 114) % 31) + 1);
  }
  function feriado(d) {
    var md = ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    if (FERIADOS.indexOf(md) >= 0) return true;
    var sexta = pascoa(d.getFullYear()); sexta.setDate(sexta.getDate() - 2);
    return d.getMonth() === sexta.getMonth() && d.getDate() === sexta.getDate();
  }
  function diasUteis(n) {
    var d = new Date(); var c = 0;
    while (c < n) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6 && !feriado(d)) c++; }
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  }
  // q18: cada dígito com a mesma largura, para o valor não andar para o lado quando muda
  function pintarValor(n, texto) {
    // o leitor de tela lê o valor inteiro (texto escondido); na tela, cada dígito ocupa a mesma largura
    var digitos = String(texto).replace(/\d/g, function (x) { return '<span class="dg">' + x + "</span>"; });
    n.innerHTML = '<span class="vh">' + texto + '</span><span aria-hidden="true">' + digitos + "</span>";
  }
  function spCapital(cep) { var n = +dig(cep); return (n >= 1000000 && n <= 5999999) || (n >= 8000000 && n <= 8499999); }
  function opcoesUf(sel) { sel.innerHTML = '<option value="">Escolha</option>' + UFS.map(function (u) { return "<option>" + u + "</option>"; }).join(""); }

  /* ---------- erros ---------- */
  function erro(id, msg) {
    var inp = el(id), e = el(id + "-erro");
    if (inp) inp.setAttribute("aria-invalid", msg ? "true" : "false");
    if (e) { e.textContent = msg || ""; e.hidden = !msg; }
    return !msg;
  }
  // o erro some enquanto a pessoa corrige (q3)
  function limparAoDigitar(id, ok) {
    var i = el(id);
    i.addEventListener(i.tagName === "SELECT" ? "change" : "input", function () {
      if (i.getAttribute("aria-invalid") === "true" && (ok ? ok(i.value) : i.value.trim())) erro(id, "");
    });
  }

  /* ---------- contas ---------- */
  function subtotal() { return ITENS.reduce(function (a, i) { return a + i.preco * i.q; }, 0); }
  function desconto() { return S.cupom ? cents(subtotal() * S.cupom.pct / 100) : 0; }
  function freteGratis() { return !!S.endereco && spCapital(el("cep").value) && subtotal() - desconto() >= FRETE_GRATIS; }
  function valorFrete() {
    if (!S.frete || !S.endereco) return null;
    var f = FRETES.filter(function (x) { return x.id === S.frete; })[0];
    if (!f) return null;
    return freteGratis() ? 0 : f.preco;
  }
  function total() { var fr = valorFrete(); return cents(subtotal() - desconto() + (fr || 0)); }

  function pintarItens() {
    // quantidade só aparece com 2 ou mais unidades (q10)
    el("itens").innerHTML = ITENS.map(function (i) {
      return '<li class="item"><span class="item-img"><img src="' + i.img + '" alt="" width="56" height="56">' +
        (i.q > 1 ? '<span class="item-q num"><span aria-hidden="true">' + i.q + '</span><span class="vh">' + T.qtd(i.q) + '</span></span>' : "") + '</span>' +
        '<span class="item-n">' + i.nome + '<small>' + i.tipo + '</small></span><span class="item-v num">' + brl(i.preco * i.q) + '</span></li>';
    }).join("");
    // fotos dos itens na linha do resumo do rodapé (celular)
    var fotos = ITENS.slice(0, 3).map(function (i) { return '<img src="' + i.img + '" alt="">'; }).join("");
    $$(".rb-fotos").forEach(function (f) { f.innerHTML = fotos; });
  }
  function pintarResumo() {
    var n = ITENS.reduce(function (a, i) { return a + i.q; }, 0);
    $$(".rb-itens").forEach(function (s) { s.textContent = ", " + T.itens(n); });
    $$(".rb-itens-v").forEach(function (s) { s.textContent = T.itens(n); });
    el("v-sub").textContent = brl(subtotal());
    var ds = desconto(); el("linha-desc").hidden = !ds; el("v-desc").textContent = "− " + brl(ds);
    var fr = valorFrete();
    el("v-frete").textContent = fr === null ? T.freteAntes : fr === 0 ? T.gratis : brl(fr);
    var t = total();
    pintarValor(el("v-total"), brl(t));
    $$(".rb-tot").forEach(function (s) { pintarValor(s, brl(t)); });
    el("v-parcela").textContent = T.parcela(MAX_PARC, brl(cents(t / MAX_PARC)));
    // meta de frete grátis: só aparece para a capital de SP
    var meta = el("meta-frete");
    if (S.endereco && spCapital(el("cep").value)) {
      var base = subtotal() - ds, falta = cents(FRETE_GRATIS - base);
      meta.hidden = false;
      el("meta-frete-tx").textContent = falta > 0 ? T.metaFalta(brl(falta)) : T.metaOk;
      el("meta-frete-barra").style.transform = "scaleX(" + Math.min(1, base / FRETE_GRATIS).toFixed(3) + ")";
    } else meta.hidden = true;
    pintarPagamento();
  }

  /* ---------- etapa 1 · contato (nome, WhatsApp e e-mail opcional, r1-d2 ajuste) ---------- */
  function checarWhats(final) {
    var v = el("whats").value, valido = celValido(v);
    el("whats-ok").hidden = !valido;
    if (!final) { if (valido) erro("whats", ""); return valido; }
    if (!dig(v)) return erro("whats", T.whatsVazio);
    return erro("whats", valido ? "" : T.whatsRuim);
  }
  function validar1() {
    var ok = true;
    ok = erro("nome", nomeCompleto(el("nome").value) ? "" : T.nome) && ok;
    ok = checarWhats(true) && ok;
    var em = el("email").value.trim();
    ok = erro("email", !em || emailValido(em) ? "" : T.emailRuim) && ok;
    return ok;
  }
  function resumo1(alvo) {
    // telefone inteiro numa linha só (q10)
    alvo.textContent = "";
    var tel = document.createElement("span"); tel.className = "nq"; tel.textContent = el("whats").value.trim();
    var em = el("email").value.trim();
    alvo.appendChild(document.createTextNode(el("nome").value.trim() + " · "));
    alvo.appendChild(tel);
    if (em) {
      // e-mail longo quebra antes do @, e não no meio do endereço
      var i = em.indexOf("@");
      alvo.appendChild(document.createTextNode(" · " + (i > 0 ? em.slice(0, i) : em)));
      if (i > 0) { alvo.appendChild(document.createElement("wbr")); alvo.appendChild(document.createTextNode(em.slice(i))); }
    }
  }

  /* ---------- etapa 2 · entrega ---------- */
  var buscaT = null;
  function mostrarEndereco(d, revela) {
    var achado = CEPS[d];
    if (achado) {
      S.endereco = achado; S.manual = false;
      el("end-rua").textContent = achado.rua;
      el("end-local").textContent = achado.bairro + " · " + achado.cidade + "/" + achado.uf;
      el("endereco").hidden = false; if (revela) el("endereco").classList.add("revela");
    } else {
      // simulação do caminho "CEP sem rua": completa à mão
      S.endereco = { rua: "", bairro: "", cidade: "", uf: "" }; S.manual = true;
      el("manual").hidden = false; if (revela) el("manual").classList.add("revela");
    }
    if (!S.frete) S.frete = FRETES.slice().sort(function (a, b) { return a.preco - b.preco; })[0].id;
    pintarFretes();
    el("bloco-entrega").hidden = false; if (revela) el("bloco-entrega").classList.add("revela");
    pintarResumo();
  }
  var cepAnterior = "";
  function buscarCep() {
    var d = dig(el("cep").value);
    clearTimeout(buscaT);
    if (d !== cepAnterior) {
      cepAnterior = d;
      S.frete = null;
      if (el("sem-numero").checked) { el("sem-numero").checked = false; el("numero").disabled = false; }
    }
    S.endereco = null; S.manual = false;
    el("endereco").hidden = true; el("manual").hidden = true; el("bloco-entrega").hidden = true;
    if (d.length < 8) { el("cep-busca").hidden = true; pintarResumo(); return; }
    erro("cep", ""); el("cep-busca").hidden = false;
    buscaT = setTimeout(function () { el("cep-busca").hidden = true; mostrarEndereco(d, true); }, 450);
  }
  function pintarFretes() {
    var barato = FRETES.slice().sort(function (a, b) { return a.preco - b.preco; })[0].id;
    var rapido = FRETES.slice().sort(function (a, b) { return a.dias - b.dias; })[0].id;
    var gratis = freteGratis();
    var fs = el("fretes");
    $$(".opcao", fs).forEach(function (n) { n.remove(); });
    FRETES.forEach(function (f) {
      var lab = document.createElement("label"); lab.className = "opcao";
      var selo = f.id === rapido ? '<span class="selo">' + T.seloRapido + '</span>' : f.id === barato ? '<span class="selo">' + T.seloBarato + '</span>' : "";
      lab.innerHTML = '<input type="radio" name="frete" value="' + f.id + '"' + (S.frete === f.id ? " checked" : "") + '>' +
        '<span class="opcao-t">' + f.nome + selo + '</span>' +
        '<span class="opcao-d">' + T.previsao(diasUteis(f.dias), f.dias) + '</span>' +
        '<span class="opcao-v num">' + (gratis ? T.gratis : brl(f.preco)) + '</span>';
      fs.appendChild(lab);
    });
  }
  function pintarRecebe() {
    el("recebe-tx").textContent = S.recebeOutro ? "" : T.voce(el("nome").value.trim());
    el("recebe-tx").hidden = S.recebeOutro;
    el("campo-recebe").hidden = !S.recebeOutro;
    el("outro-recebe").textContent = S.recebeOutro ? T.euRecebo : T.outraPessoa;
    el("outro-recebe").setAttribute("aria-expanded", String(S.recebeOutro));
  }
  function validar2() {
    var ok = true;
    if (dig(el("cep").value).length !== 8) return erro("cep", T.cep) && false;
    if (!S.endereco) return erro("cep", T.cepNada) && false;
    if (S.manual) {
      ok = erro("rua", el("rua").value.trim() ? "" : T.rua) && ok;
      ok = erro("bairro", el("bairro").value.trim() ? "" : T.bairro) && ok;
      ok = erro("cidade", el("cidade").value.trim() ? "" : T.cidade) && ok;
      ok = erro("uf", el("uf").value ? "" : T.uf) && ok;
    }
    var semNum = el("sem-numero").checked;
    ok = erro("numero", semNum || el("numero").value.trim() ? "" : T.numero) && ok;
    if (S.recebeOutro) ok = erro("recebe", nomeCompleto(el("recebe").value) ? "" : T.recebe) && ok;
    return ok;
  }
  function resumo2(alvo) {
    var e = S.manual ? { rua: el("rua").value.trim(), cidade: el("cidade").value.trim(), uf: el("uf").value } : S.endereco;
    var num = el("sem-numero").checked ? T.semNumero : el("numero").value.trim();
    var f = FRETES.filter(function (x) { return x.id === S.frete; })[0];
    alvo.textContent = e.rua + ", " + num + " · " + e.cidade + "/" + e.uf + (f ? " · " + f.nome + " · " + T.previsaoCurta(diasUteis(f.dias)) : "");
  }

  /* ---------- etapa 3 · pagamento ---------- */
  function pintarCarteira() {
    var c = S.carteiras[0], nome = CARTEIRAS[c] || "";
    el("pag-cart").hidden = !c;
    if (!c && S.pag === "carteira") { S.pag = "pix"; $('input[name="pag"][value="pix"]').checked = true; }
    el("cart-marca").textContent = nome;
    el("cart-btn-nome").textContent = nome;
    el("cart-info-tx").textContent = c ? (matchMedia("(hover: hover) and (pointer: fine)").matches ? T.cartInfoPc(nome) : T.cartInfo(nome)) : "";
  }
  function pintarPagamento() {
    var t = total(), pix = S.pag === "pix", cc = S.pag === "cartao", cart = S.pag === "carteira";
    el("pag-pix-v").textContent = brl(t);
    el("pag-cartao-v").textContent = T.cartaoV(MAX_PARC, brl(cents(t / MAX_PARC)));
    el("pag-cart-v").textContent = brl(t);
    var sel = el("parcelas"), atual = +sel.value || S.parcelas || 1;
    sel.innerHTML = "";
    for (var n = 1; n <= MAX_PARC; n++) {
      var o = document.createElement("option"); o.value = n;
      o.textContent = T.parcOpc(n, brl(cents(t / n)));
      if (n === atual) o.selected = true; sel.appendChild(o);
    }
    S.parcelas = atual;
    el("cartao").hidden = !cc; el("pix-info").hidden = !pix; el("cart-info").hidden = !cart;
    el("fatura").hidden = !cc || el("fatura-igual").checked;
    // com a carteira, o botão rosa dá lugar ao botão preto da carteira, sem efeito (r1-d6 C)
    el("btn-pagar").hidden = cart; el("btn-carteira").hidden = !cart;
    el("btn-pagar-tx").textContent = pix ? T.pagarPix(brl(t))
      : S.parcelas > 1 ? T.pagarParc(S.parcelas, brl(cents(t / S.parcelas))) : T.pagarCartao(brl(t));
  }
  function validar3() {
    var ok = true;
    if (S.pag === "cartao") {
      var n = el("cc-num").value; ok = erro("cc-num", luhn(n) ? "" : T.ccNum) && ok;
      var v = dig(el("cc-val").value), m = +v.slice(0, 2), a = +v.slice(2, 4), hoje = new Date(), aa = hoje.getFullYear() % 100, mm = hoje.getMonth() + 1;
      var msgVal = v.length !== 4 || m < 1 || m > 12 ? T.ccVal : (a < aa || (a === aa && m < mm)) ? T.ccVenc : "";
      ok = erro("cc-val", msgVal) && ok;
      var cvv = dig(el("cc-cvv").value); ok = erro("cc-cvv", cvv.length === 3 || cvv.length === 4 ? "" : T.ccCvv) && ok;
      ok = erro("cc-nome", el("cc-nome").value.trim().length >= 3 ? "" : T.ccNome) && ok;
      // endereço da fatura diferente da entrega (q15)
      if (!el("fatura-igual").checked) {
        ok = erro("fat-cep", dig(el("fat-cep").value).length === 8 ? "" : T.fatCep) && ok;
        ok = erro("fat-rua", /\d/.test(el("fat-rua").value) && el("fat-rua").value.trim().length >= 5 ? "" : T.fatRua) && ok;
        ok = erro("fat-cidade", el("fat-cidade").value.trim() ? "" : T.cidade) && ok;
        ok = erro("fat-uf", el("fat-uf").value ? "" : T.uf) && ok;
      }
    }
    ok = erro("cpf", cpfValido(el("cpf").value) ? "" : T.cpf) && ok;
    return ok;
  }
  function validar(k) { return k === 1 ? validar1() : k === 2 ? validar2() : validar3(); }

  /* ---------- barra do rodapé (celular): a altura dela reserva espaço no fim da página ---------- */
  function medirBarra() {
    var a = $$(".etapa-acoes").filter(function (x) { return x.getClientRects().length > 0; })[0];
    if (a && painel()) document.documentElement.style.setProperty("--c-barra", a.offsetHeight + "px");
  }

  /* ---------- movimento ao avançar: a etapa vira a linha de resumo (r1-d7 B) ----------
     Só transform e opacity, 380 ms. O DOM muda na hora (foco no título novo, etapa nova já aceita toque);
     uma cópia inerte da etapa que sai, sem ids nem nomes e fora do leitor de tela, faz a saída.
     Com "reduzir movimento" não roda: a troca é instantânea. */
  var MOV = { dur: 380, ease: "cubic-bezier(.22,.61,.36,1)", gap: 16 };
  var vivas = [], fantasma = null;
  function limparMovimento() {
    vivas.forEach(function (a) { try { a.cancel(); } catch (e) { /* já terminou */ } });
    vivas = [];
    if (fantasma) { fantasma.remove(); fantasma = null; }
  }
  function anima(n, kf, op) { var a = n.animate(kf, op); vivas.push(a); return a; }
  function caixa(n) { var r = n.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }
  function copiaInerte(sec) {
    var c = sec.cloneNode(true);
    var ac = c.querySelector(".etapa-acoes"); if (ac) ac.remove();
    c.classList.remove("entra"); c.removeAttribute("hidden");
    [c].concat($$("*", c)).forEach(function (n) {
      ["id", "name", "for", "aria-labelledby", "aria-describedby", "aria-controls", "aria-live"].forEach(function (at) { n.removeAttribute(at); });
    });
    return c;
  }
  function medirSaida(k) {
    if (!calmo.matches || modo() === "pagina" || typeof Element.prototype.animate !== "function") return null;
    limparMovimento();
    var sec = el("etapa-" + k);
    return { k: k, cab: caixa($(".etapa-cab", sec)), corpo: caixa($(".etapa-corpo", sec)), acoes: caixa($(".etapa-acoes", sec)), copia: copiaInerte(sec) };
  }
  function animarAvanco(antes) {
    var form = el("form"), novo = S.atual;
    var bolso = el("feita-" + antes.k), sec2 = el("etapa-" + novo);
    if (!bolso || bolso.hidden || !sec2 || sec2.hidden) return;
    var sy = window.scrollY, fy = form.getBoundingClientRect().top + sy;
    var b = bolso.getBoundingClientRect();
    var cab2 = $(".etapa-cab", sec2), corpo2 = $(".etapa-corpo", sec2), ac2 = $(".etapa-acoes", sec2);
    // a coluna inteira sobe a mesma distância: a etapa velha entra na linha de resumo, a nova vem colada embaixo
    var D = Math.round(antes.corpo.bottom + MOV.gap - cab2.getBoundingClientRect().top);
    if (D < 24) return;
    var bBot = b.bottom + sy, fundo = antes.corpo.bottom + sy + 24;
    fantasma = document.createElement("div");
    fantasma.className = "d7-fantasma-raiz"; fantasma.setAttribute("aria-hidden", "true"); fantasma.inert = true;
    var ccab = $(".etapa-cab", antes.copia), ccorpo = $(".etapa-corpo", antes.copia);
    var titulo = document.createElement("div"); titulo.className = "d7-fantasma d7-solto";
    titulo.style.top = (antes.cab.top + sy - fy) + "px"; titulo.appendChild(ccab);
    var moldura = document.createElement("div"); moldura.className = "d7-fantasma";
    moldura.style.top = (bBot - fy) + "px"; moldura.style.height = Math.max(0, fundo - bBot) + "px";
    ccorpo.style.top = (antes.corpo.top + sy - bBot) + "px"; moldura.appendChild(ccorpo);
    fantasma.appendChild(titulo); fantasma.appendChild(moldura); form.appendChild(fantasma);

    var dur = MOV.dur, base = { duration: dur, easing: MOV.ease };
    var sobe = [{ transform: "translateY(" + D + "px)" }, { transform: "none" }];
    // etapa velha: o título se apaga no lugar; os campos sobem e entram na linha de resumo
    anima(ccab, [{ opacity: 1 }, { opacity: 0, transform: "translateY(-6px)" }], { duration: dur * 0.18, easing: "ease-in", fill: "forwards" });
    anima(ccorpo, [{ transform: "none" }, { transform: "translateY(" + (-D) + "px)" }], { duration: dur, easing: MOV.ease, fill: "forwards" });
    anima(ccorpo, [{ opacity: 1 }, { opacity: 1, offset: 0.35 }, { opacity: 0, offset: 0.75 }, { opacity: 0 }], { duration: dur, easing: "linear", fill: "forwards" });
    // linha de resumo: aparece parada no lugar do título; o texto chega de baixo 6 px; o ✓ fecha depois
    anima(bolso, [{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.26, delay: dur * 0.05, easing: "linear", fill: "backwards" });
    anima($(".feita-tx", bolso), [{ transform: "translateY(6px)" }, { transform: "none" }], { duration: dur * 0.6, delay: dur * 0.05, easing: MOV.ease, fill: "backwards" });
    anima($(".feita-ic", bolso), [{ opacity: 0, transform: "scale(.5)" }, { opacity: 1, transform: "none" }], { duration: dur * 0.42, delay: dur * 0.42, easing: MOV.ease, fill: "backwards" });
    // etapa nova: sobe colada na velha
    anima(cab2, sobe, base); anima(corpo2, sobe, base);
    anima(cab2, [{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.5, easing: "linear" });
    anima(corpo2, [{ opacity: 0 }, { opacity: 0, offset: 0.2 }, { opacity: 1, offset: 0.7 }, { opacity: 1 }], { duration: dur, easing: "linear" });
    // botão: desliza do lugar antigo para o novo (fixo no rodapé do celular, fica parado)
    var dAc = Math.round(antes.acoes.top - ac2.getBoundingClientRect().top);
    if (Math.abs(dAc) > 1) anima(ac2, [{ transform: "translateY(" + dAc + "px)" }, { transform: "none" }], base);

    var minhas = vivas.slice(), f = fantasma;
    Promise.all(minhas.map(function (a) { return a.finished; })).then(function () {
      if (f === fantasma) { f.remove(); fantasma = null; vivas = []; }
    }, function () { /* cancelada por "Alterar" ou novo avanço */ });
  }

  /* ---------- navegação ---------- */
  function pintarEtapas(animar) {
    var m = modo();
    [1, 2, 3].forEach(function (k) {
      var sec = el("etapa-" + k), feita = el("feita-" + k);
      var mostra = m === "pagina" ? true : k === S.atual;
      var antes = !sec.hidden;
      sec.hidden = !mostra;
      if (feita) feita.hidden = m === "pagina" || k === S.atual || !S.feito[k];
      if (mostra && !antes && animar) { sec.classList.remove("entra"); void sec.offsetWidth; sec.classList.add("entra"); }
      if (!animar) sec.classList.remove("entra");
    });
    $$("#prog .prog-item").forEach(function (li) {
      var p = +li.getAttribute("data-p");
      li.classList.toggle("atual", p === S.atual);
      li.classList.toggle("feito", S.feito[p] && p !== S.atual);
      if (p === S.atual) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    [1, 2].forEach(function (k) {
      var prox = proxima(k), b = $('[data-avancar="' + k + '"]');
      if (b) b.textContent = prox >= 3 ? T.botao.pagamento : T.botao.entrega;
    });
    if (S.feito[1]) resumo1(el("feita-1-tx")); else el("feita-1-tx").textContent = "";
    if (S.feito[2] && S.endereco) resumo2(el("feita-2-tx")); else el("feita-2-tx").textContent = "";
    medirBarra();
  }
  // op.de: medidas da etapa que saiu (movimento r1-d7 B); op.foco === false: não mexe no foco nem na rolagem
  function irPara(k, op) {
    op = op || {};
    var antes = S.atual;
    S.atual = k; if (k > S.max) S.max = k;
    if (k !== antes) S.trava = Date.now() + 500; // q2: o 2º toque de um toque duplo não pula a etapa nova
    pintarEtapas(!op.de);
    if (k === 2) pintarRecebe();
    if (k !== antes) avisar("deo:etapa", { etapa: k, antes: antes });
    if (op.foco === false) return;
    var h = el("t" + k);
    try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
    var alvo = modo() === "pagina" ? el("etapa-" + k) : (el("feita-1").hidden ? el("fluxo") : el("feita-1"));
    var y = Math.max(0, alvo.getBoundingClientRect().top + window.scrollY - 12);
    if (op.de) {
      // vai direto para o lugar certo e só então anima: a página não pula e depois rola (q14)
      if (Math.abs(y - window.scrollY) > 1) window.scrollTo({ top: y, behavior: "instant" });
      animarAvanco(op.de);
      return;
    }
    if (y < window.scrollY || modo() !== "pagina") window.scrollTo({ top: y, behavior: "instant" });
  }
  function primeiroErro(sec) {
    var inv = $('[aria-invalid="true"]', sec);
    if (inv) { inv.focus({ preventScroll: true }); inv.scrollIntoView({ block: "center" }); }
  }
  // próxima etapa a partir de k: pula as que já estão feitas (depois de "Alterar")
  function proxima(k) { var prox = k + 1; while (prox < S.max && S.feito[prox]) prox++; return prox; }
  function concluir(k) {
    if (!validar(k)) { primeiroErro(el("etapa-" + k)); return false; }
    S.feito[k] = true;
    irPara(proxima(k), { de: medirSaida(k) });
    return true;
  }
  function pagar() {
    if (S.pagando) return; // segundo toque enquanto o pagamento está em andamento
    // confere as 3 etapas antes de pagar (q2): se algo foi apagado em "Alterar", volta para a etapa
    for (var k = 1; k <= 3; k++) {
      if (!validar(k)) {
        if (modo() !== "pagina" && S.atual !== k) irPara(k, { foco: false });
        primeiroErro(el("etapa-" + k));
        return;
      }
      S.feito[k] = true;
    }
    // telas depois do pagamento (Pix, aprovação, confirmação, recusa) entram pelo gancho DeoCK.aoPagar(info):
    // o botão fica ocupado e ignora um segundo toque; quem assume a tela libera com DeoCK.ocupado(false)
    var gancho = window.DeoCK && window.DeoCK.aoPagar;
    if (typeof gancho === "function") {
      ocupado(true);
      var info = pedido();
      if (gancho(info) === true) return;
      ocupado(false);
    }
  }

  // botão de pagar ocupado: mostra o que está acontecendo e não aceita outro toque
  function ocupado(on) {
    S.pagando = !!on;
    [el("btn-pagar"), el("btn-carteira")].forEach(function (b) {
      if (on) { b.setAttribute("aria-busy", "true"); b.setAttribute("aria-disabled", "true"); }
      else { b.removeAttribute("aria-busy"); b.removeAttribute("aria-disabled"); }
    });
    var c = CARTEIRAS[S.carteiras[0]] || "";
    if (on) {
      var tx = S.pag === "carteira" ? T.ocupado.carteira(c) : T.ocupado[S.pag];
      (S.pag === "carteira" ? el("btn-carteira") : el("btn-pagar-tx")).textContent = tx;
    } else {
      if (S.pag === "carteira" || el("btn-carteira").textContent.indexOf("…") > 0) el("btn-carteira").innerHTML = 'Pagar com <b id="cart-btn-nome">' + c + '</b>';
      pintarPagamento();
    }
  }
  // retrato do pedido para as telas depois do pagamento (gancho DeoCK.pedido / DeoCK.aoPagar)
  function pedido() {
    var f = FRETES.filter(function (x) { return x.id === S.frete; })[0] || null;
    var e = S.manual ? { rua: el("rua").value.trim(), bairro: el("bairro").value.trim(), cidade: el("cidade").value.trim(), uf: el("uf").value } : (S.endereco || {});
    var t = total();
    return {
      forma: S.pag, carteira: CARTEIRAS[S.carteiras[0]] || "", parcelas: S.parcelas,
      total: t, totalTexto: brl(t), subtotal: subtotal(), desconto: desconto(), frete: valorFrete(),
      itens: ITENS.map(function (i) { return { id: i.id, nome: i.nome, tipo: i.tipo, familia: i.familia, q: i.q, preco: i.preco, img: i.img }; }),
      cpf: el("cpf").value,
      cartao: S.pag === "cartao" ? { bandeira: bandeira(el("cc-num").value), final: dig(el("cc-num").value).slice(-4) } : null,
      nome: el("nome").value.trim(), whats: el("whats").value.trim(), email: el("email").value.trim(),
      endereco: { rua: e.rua || "", numero: el("sem-numero").checked ? T.semNumero : el("numero").value.trim(), complemento: el("complemento").value.trim(),
                  bairro: e.bairro || "", cidade: e.cidade || "", uf: e.uf || "", cep: el("cep").value },
      recebe: S.recebeOutro ? el("recebe").value.trim() : el("nome").value.trim(),
      entrega: f ? { id: f.id, nome: f.nome, dias: f.dias, previsao: diasUteis(f.dias) } : null,
      cupom: S.cupom ? S.cupom.codigo : ""
    };
  }

  // Tab e Shift+Tab dão a volta dentro do que está aberto por cima (painel do resumo)
  function focaveis(caixas) {
    return caixas.reduce(function (l, c) {
      return l.concat($$("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])", c).filter(function (n) {
        return !n.disabled && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== "hidden";
      }));
    }, []);
  }
  function prenderFoco(e) {
    if (e.key !== "Tab") return;
    var caixas = painel() && !el("pedido").classList.contains("recolhido") ? $$(".etapa-acoes").filter(function (a) { return a.getClientRects().length > 0; }).concat(el("pedido")) : null;
    if (!caixas) return;
    var l = focaveis(caixas); if (!l.length) return;
    var ativo = document.activeElement, i = l.indexOf(ativo), fim = l.length - 1;
    var dentro = caixas.some(function (c) { return c.contains(ativo); });
    if (i === -1 && dentro) return; // título com foco: o Tab segue a ordem normal dali
    if (e.shiftKey && i <= 0) { e.preventDefault(); l[fim].focus(); }
    else if (!e.shiftKey && (i === -1 || i === fim)) { e.preventDefault(); l[0].focus(); }
  }

  /* ---------- resumo do pedido: no celular abre como painel por cima (r1-d5 C) ---------- */
  var abriuCom = null;
  function atrasDoVeu() { return $$(".topo, .progresso, .feita, .etapa-cab, .etapa-corpo"); }
  function resumo(abrir) {
    abrir = !!abrir;
    var p = el("pedido");
    p.classList.toggle("recolhido", !abrir);
    $$(".resumo-pe, #resumo-bar").forEach(function (b) { b.setAttribute("aria-expanded", String(abrir)); });
    var sobre = painel() && abrir;
    el("veu").hidden = !sobre;
    document.documentElement.classList.toggle("resumo-aberto", sobre);
    atrasDoVeu().forEach(function (n) { n.inert = sobre; });
    if (sobre) { abriuCom = document.activeElement; el("pedido-titulo").focus({ preventScroll: true }); }
    else if (painel() && abriuCom && abriuCom.isConnected) { abriuCom.focus({ preventScroll: true }); abriuCom = null; }
  }

  // mede o que fica abaixo do cupom, faz a mudança e desliza tudo do lugar antigo para o novo (0,3 s)
  function deslizar(mudanca) {
    var alvos = $$(".pedido-in>.cupom~*");
    var antes = alvos.map(function (n) { return n.getBoundingClientRect().top; });
    mudanca();
    if (!calmo.matches || typeof Element.prototype.animate !== "function") return;
    alvos.forEach(function (n, i) {
      var d = antes[i] - n.getBoundingClientRect().top;
      if (Math.abs(d) > 1) n.animate([{ transform: "translateY(" + d + "px)" }, { transform: "none" }], { duration: 300, easing: "cubic-bezier(.2,.7,.2,1)" });
    });
  }

  /* ---------- cupom: o foco não se perde e o desconto é anunciado (q13) ---------- */
  function aplicarCupom() {
    var c = el("cupom").value.replace(/\s+/g, "").toUpperCase();
    if (!c) return;
    var cp = CUPONS[c];
    if (!cp) { el("cupom-erro").textContent = T.cupomRuim; el("cupom-erro").hidden = false; el("cupom").setAttribute("aria-invalid", "true"); return; }
    S.cupom = { codigo: c, pct: cp.pct };
    deslizar(function () {
      el("cupom-erro").hidden = true; el("cupom").setAttribute("aria-invalid", "false");
      el("cupom-form").hidden = true; el("cupom-abrir").hidden = true; el("cupom-abrir").setAttribute("aria-expanded", "false");
      el("cupom-tag").textContent = T.cupomTag(c, cp.pct); el("cupom-ok").hidden = false;
      if (S.endereco) pintarFretes();
      pintarResumo();
    });
    el("cupom-aviso").textContent = T.cupomOk(c, cp.pct, brl(total()));
    el("cupom-tirar").focus();
  }
  function tirarCupom() {
    S.cupom = null; el("cupom").value = "";
    deslizar(function () {
      el("cupom-ok").hidden = true; el("cupom-abrir").hidden = false;
      if (S.endereco) pintarFretes();
      pintarResumo();
    });
    el("cupom-aviso").textContent = T.cupomFora(brl(total()));
    el("cupom-abrir").focus();
  }

  /* ---------- eventos ---------- */
  function ligar() {
    pintarItens(); pintarCarteira(); pintarResumo();
    opcoesUf(el("uf")); opcoesUf(el("fat-uf"));

    // Enter (ou "Ir" no teclado do celular) vale para a etapa aberta (q1)
    el("form").addEventListener("submit", function (e) {
      e.preventDefault();
      // q2: um toque duplo no botão não pula a etapa que acabou de abrir (o Enter do teclado não é afetado)
      var tq = S.toque;
      if (S.trava && Date.now() < S.trava && tq && tq.b === e.submitter && Date.now() - tq.t < 600) return;
      if (modo() === "pagina" || S.atual === 3) pagar(); else concluir(S.atual);
    });
    document.addEventListener("pointerdown", function (e) { var b = e.target.closest && e.target.closest("[data-avancar]"); if (b) S.toque = { b: b, t: Date.now() }; }, true);
    $$("[data-ir]").forEach(function (b) { b.addEventListener("click", function () { limparMovimento(); irPara(+b.getAttribute("data-ir")); }); });

    el("nome").addEventListener("input", function () { if (this.getAttribute("aria-invalid") === "true" && nomeCompleto(this.value)) erro("nome", ""); pintarRecebe(); });
    el("whats").addEventListener("input", function () { var m = mascaraCel(this.value); if (m !== this.value) this.value = m; checarWhats(false); });
    el("whats").addEventListener("blur", function () { if (dig(this.value)) checarWhats(true); });
    el("email").addEventListener("input", function () { if (this.getAttribute("aria-invalid") === "true" && (!this.value.trim() || emailValido(this.value))) erro("email", ""); });
    el("email").addEventListener("blur", function () { var v = this.value.trim(); if (v) erro("email", emailValido(v) ? "" : T.emailRuim); });

    el("cep").addEventListener("input", function () { this.value = mascaraCep(this.value); buscarCep(); });
    ["rua", "bairro", "cidade", "uf", "fat-rua", "fat-cidade", "fat-uf"].forEach(function (id) { limparAoDigitar(id); });
    limparAoDigitar("fat-cep", function (v) { return dig(v).length === 8; });
    el("fat-cep").addEventListener("input", function () { this.value = mascaraCep(this.value); });
    el("sem-numero").addEventListener("change", function () { el("numero").disabled = this.checked; if (this.checked) { el("numero").value = ""; erro("numero", ""); } });
    el("numero").addEventListener("input", function () { if (this.value.trim()) erro("numero", ""); });
    limparAoDigitar("recebe", nomeCompleto);
    el("outro-recebe").addEventListener("click", function () { S.recebeOutro = !S.recebeOutro; pintarRecebe(); if (S.recebeOutro) el("recebe").focus(); });
    el("fretes").addEventListener("change", function (e) { if (e.target.name === "frete") { S.frete = e.target.value; pintarResumo(); } });

    $$('input[name="pag"]').forEach(function (r) {
      r.addEventListener("change", function () {
        S.pag = this.value; pintarPagamento(); medirBarra();
        if (S.pag === "cartao") { var n = el("cc-nome"); if (!n.value) n.value = el("nome").value.trim().toUpperCase(); }
      });
    });
    el("parcelas").addEventListener("change", function () { S.parcelas = +this.value; pintarPagamento(); });
    el("fatura-igual").addEventListener("change", function () { pintarPagamento(); if (!this.checked) el("fat-cep").focus(); });
    el("cc-num").addEventListener("input", function () { this.value = mascaraCartao(this.value); el("cc-band").textContent = bandeira(this.value); if (luhn(this.value)) erro("cc-num", ""); });
    el("cc-val").addEventListener("input", function () { this.value = mascaraVal(this.value); });
    el("cc-cvv").addEventListener("input", function () { this.value = dig(this.value).slice(0, 4); });
    limparAoDigitar("cc-val", function (v) { return dig(v).length === 4; });
    limparAoDigitar("cc-cvv", function (v) { var n = dig(v).length; return n === 3 || n === 4; });
    limparAoDigitar("cc-nome", function (v) { return v.trim().length >= 3; });
    el("cpf").addEventListener("input", function () { this.value = mascaraCpf(this.value); if (cpfValido(this.value)) erro("cpf", ""); });

    $$(".resumo-pe, #resumo-bar").forEach(function (b) { b.addEventListener("click", function () { resumo(el("pedido").classList.contains("recolhido")); }); });
    el("ped-fechar").addEventListener("click", function () { resumo(false); });
    el("veu").addEventListener("click", function () { resumo(false); });
    el("cupom-abrir").addEventListener("click", function () { var f = el("cupom-form"); f.hidden = !f.hidden; this.setAttribute("aria-expanded", String(!f.hidden)); if (!f.hidden) el("cupom").focus(); });
    el("cupom-aplicar").addEventListener("click", aplicarCupom);
    el("cupom").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); aplicarCupom(); } });
    el("cupom-tirar").addEventListener("click", tirarCupom);
    document.addEventListener("keydown", prenderFoco);
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (painel() && !el("pedido").classList.contains("recolhido")) resumo(false);
    });
    function ajustar() { if (!painel()) resumo(false); medirBarra(); }
    if (celular.addEventListener) celular.addEventListener("change", ajustar);
    window.addEventListener("resize", medirBarra);
    if (window.ResizeObserver) { var ro = new ResizeObserver(medirBarra); $$(".etapa-acoes").forEach(function (a) { ro.observe(a); }); }
    pintarEtapas(false); pintarRecebe();
    if (!document.documentElement.getAttribute("data-tela")) document.documentElement.setAttribute("data-tela", "checkout");
    window.DeoCK.pronto = true;
    avisar("deo:pronto", { tela: document.documentElement.getAttribute("data-tela") });
  }

  /* ---------- telas e avisos entre módulos ----------
     <html data-tela="loja|checkout|pix|confirmacao"> diz o que está na tela; cada módulo (sacola, Pix, confirmação…)
     mostra a sua parte pelo CSS desse atributo. Eventos no document: deo:pronto, deo:tela, deo:checkout. */
  function avisar(nome, detalhe) { document.dispatchEvent(new CustomEvent(nome, { detail: detalhe || {} })); }
  function tela(nome) {
    var antes = document.documentElement.getAttribute("data-tela") || "checkout";
    document.documentElement.setAttribute("data-tela", nome);
    if (nome !== "checkout") resumo(false);
    medirBarra();
    if (antes !== nome) avisar("deo:tela", { tela: nome, antes: antes });
  }
  // entra no checkout (vindo da sacola, por exemplo): mostra a etapa aberta e põe o foco no título dela
  function abrirCheckout() {
    tela("checkout");
    window.scrollTo(0, 0);
    pintarEtapas(false);
    avisar("deo:checkout", { etapa: S.atual });
    var h = el("t" + S.atual); if (h) try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
  }
  // itens mudaram por fora (sacola): redesenha fotos, fretes e contas
  function atualizarItens() {
    for (var i = ITENS.length - 1; i >= 0; i--) if (!(ITENS[i].q > 0)) ITENS.splice(i, 1);
    pintarItens(); if (S.endereco) pintarFretes(); pintarResumo();
    avisar("deo:itens", { itens: ITENS });
  }
  // preenche dados conhecidos (cliente que volta); chaves ausentes ficam como estão
  function preencherDados(d) {
    d = d || {};
    ["nome", "whats", "email", "complemento", "cpf"].forEach(function (k) { if (d[k] != null) preencher(k, d[k]); });
    if (d.cep != null) {
      el("cep").value = mascaraCep(d.cep); buscarCep(); clearTimeout(buscaT); el("cep-busca").hidden = true;
      if (dig(d.cep).length === 8) mostrarEndereco(dig(d.cep), false);
    }
    if (S.manual) {
      ["rua", "bairro", "cidade"].forEach(function (k) { if (d[k] != null) preencher(k, d[k]); });
      if (d.uf != null) { el("uf").value = d.uf; el("uf").dispatchEvent(new Event("change", { bubbles: true })); }
    }
    if (d.semNumero != null) { el("sem-numero").checked = !!d.semNumero; el("sem-numero").dispatchEvent(new Event("change", { bubbles: true })); }
    if (d.numero != null && !el("sem-numero").checked) preencher("numero", d.numero);
    if (d.frete) { S.frete = d.frete; if (S.endereco) pintarFretes(); }
    if (d.pag) escolherPag(d.pag);
    pintarResumo(); pintarRecebe();
  }
  function marcarFeitas(lista) { (lista || []).forEach(function (k) { S.feito[k] = true; if (k + 1 > S.max) S.max = Math.min(3, k + 1); }); pintarEtapas(false); }
  // começa do zero: campos, etapas, frete e cupom (cliente que volta: "Não é você?")
  function limpar() {
    ["nome", "whats", "email", "cep", "numero", "complemento", "recebe", "cpf", "rua", "bairro", "cidade",
      "cc-nome", "fat-cep", "fat-rua", "fat-cidade"].forEach(function (id) { el(id).value = ""; erro(id, ""); });
    el("uf").value = ""; el("fat-uf").value = ""; el("whats-ok").hidden = true;
    el("sem-numero").checked = false; el("numero").disabled = false; el("fatura-igual").checked = true;
    limparCartao(); cepAnterior = ""; buscarCep();
    S.feito = { 1: false, 2: false, 3: false }; S.max = 1; S.frete = null; S.recebeOutro = false;
    if (S.cupom) tirarCupom();
    escolherPag("pix"); pintarRecebe(); pintarResumo(); irPara(1, { foco: false });
  }
  function limparCartao() { ["cc-num", "cc-val", "cc-cvv"].forEach(function (id) { el(id).value = ""; erro(id, ""); }); el("cc-band").textContent = ""; }
  // só no protótipo (v3.1, pedido no chat): depois do pedido confirmado, "Simular nova compra" recomeça o fluxo.
  // Volta a sacola de exemplo, apaga o checkout e avisa os módulos (deo:nova-compra) para cada um zerar o seu.
  // A sacola assume a tela (loja com a sacola aberta); sem ela, o checkout abre na etapa 1.
  // A memória do aparelho ("Lembrar meus dados") fica: assim dá para testar a compra de quem volta.
  function novaCompra() {
    ITENS.length = 0;
    ITENS_INICIO.forEach(function (i) { ITENS.push(Object.assign({}, i)); });
    limpar();
    ocupado(false);
    atualizarItens();
    avisar("deo:nova-compra", { itens: ITENS });
    if (document.documentElement.getAttribute("data-tela") === "confirmacao") abrirCheckout();
  }

  /* ---------- ganchos para o squad (capturas e testes) ---------- */
  function preencher(id, v) { var i = el(id); i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); }
  function escolherPag(v) { var r = $('input[name="pag"][value="' + v + '"]'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); }
  window.DeoCK = {
    estado: S,
    modo: function (m) {
      document.documentElement.setAttribute("data-modo", m);
      var c = el("corpo");
      if (m === "janela") { c.setAttribute("role", "dialog"); c.setAttribute("aria-labelledby", "titulo-pagina"); }
      else { c.removeAttribute("role"); c.removeAttribute("aria-labelledby"); }
      resumo(false); pintarEtapas(false);
    },
    resumo: resumo,
    irPara: irPara,
    carteiras: function (l) { S.carteiras = l || []; pintarCarteira(); pintarPagamento(); },
    carteira: function () { if (S.carteiras.length) escolherPag("carteira"); },
    // Rodada 2: telas depois do pagamento. aoPagar(info) devolve true quando assume a tela; pedido() devolve os dados.
    aoPagar: null,
    pedido: pedido,
    itens: function () { return ITENS; }, // lista viva dos itens (a gaveta da Rodada 2 muda quantidades por aqui)
    pagarExemplo: function (op) { window.DeoCK.exemplo(3, op || {}); pagar(); },
    pagar: pagar,
    ocupado: ocupado,
    tela: tela,
    abrirCheckout: abrirCheckout,
    atualizarItens: atualizarItens,
    preencher: preencherDados,
    marcarFeitas: marcarFeitas,
    limparCartao: limparCartao,
    limpar: limpar,
    novaCompra: novaCompra,
    regras: { freteGratis: FRETE_GRATIS, parcelas: MAX_PARC },
    brl: brl,
    pronto: false,
    validar: validar,
    // ordem das etapas: 1 contato (nome, WhatsApp, e-mail opcional), 2 entrega, 3 pagamento
    exemplo: function (etapa, op) {
      op = op || {};
      limparMovimento();
      preencher("nome", "Marina Costa"); preencher("whats", op.whats || "(11) 98765-4321");
      if (op.email !== false) preencher("email", op.email || "marina.costa@email.com");
      if (etapa >= 2) {
        validar1(); S.feito[1] = true;
        el("cep").value = op.cep || "05121-120"; buscarCep(); clearTimeout(buscaT);
        el("cep-busca").hidden = true;
        mostrarEndereco(dig(el("cep").value), false);
        S.frete = S.frete || "anjun"; pintarFretes();
        if (etapa >= 3 || op.numero) preencher("numero", "220");
      }
      if (etapa >= 3) {
        validar2(); S.feito[2] = true;
        preencher("cpf", "529.982.247-25");
        if (op.pag === "cartao") {
          escolherPag("cartao");
          preencher("cc-num", "4111 1111 1111 1111"); preencher("cc-val", "08/29"); preencher("cc-cvv", "123");
          el("parcelas").value = "3"; el("parcelas").dispatchEvent(new Event("change", { bubbles: true }));
        } else if (op.pag === "carteira") window.DeoCK.carteira();
      }
      if (op.cupom) { el("cupom").value = op.cupom; aplicarCupom(); }
      S.max = Math.max(S.max, etapa); S.atual = etapa; pintarResumo(); pintarEtapas(false); pintarRecebe();
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      window.scrollTo(0, 0);
    }
  };

  // liga depois que todos os scripts da página rodaram, para os módulos ouvirem deo:pronto
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ligar); else setTimeout(ligar, 0);
})();
