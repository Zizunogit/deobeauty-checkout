#!/usr/bin/env python3
"""QA de fluxo do protótipo Deo Checkout v3 (núcleo + módulos).
Uso: python3 testes/qa_v3.py [--out pasta] [--port 8899]
Abre direto no checkout (index.html#checkout) e roda o fluxo completo com teclado em 375, 1280 e 768 (reduzir movimento):
erros, Enter avança, Alterar, cupom DEOQUIZ10, CEP manual 99999-999, Pix (tela própria -> trocar forma), cartão com fatura
-> confirmação, carteira -> confirmação, painel do resumo, correções rápidas da Rodada 2 (q2-q19) e rolagem lateral em
320/375/768/1280. Os módulos têm testes próprios (testes/qa_pagamento.py, testes/qa_volta.py, testes/qa_sacola.py).
Capturas em saida-testes/qa_v3/. Falha com código 1 se algo der errado."""
import argparse
from playwright.sync_api import sync_playwright
import comum

ap = argparse.ArgumentParser(); ap.add_argument("--out", default=None); ap.add_argument("--port", type=int, default=8899)
a = ap.parse_args()
out = comum.saida("qa_v3", a.out)
comum.inicio("qa_v3", a.port)
httpd = comum.servir(a.port)

falhas, ok = [], []
def check(cond, msg):
    (ok if cond else falhas).append(msg)
    print(("  ok  " if cond else "  FALHA ") + msg)

def nova(b, w, reduce=False):
    ctx = comum.contexto(b, w, reduce=reduce, touch=w < 768)
    pg, erros = comum.nova_pagina(ctx)
    comum.abrir(pg, a.port, "#checkout")
    return ctx, pg, erros

def lateral(pg, w, onde):
    sw = pg.evaluate("document.documentElement.scrollWidth")
    check(sw <= w, f"[{w}] sem rolagem lateral ({onde}): {sw}")

def atual(pg): return pg.evaluate("DeoCK.estado.atual")
def tela(pg): return pg.evaluate("document.documentElement.getAttribute('data-tela')")
def txt(pg, sel): return pg.evaluate(f"(document.querySelector({sel!r})||{{}}).textContent||''").strip()
def visivel(pg, sel): return pg.evaluate(f"(()=>{{const n=document.querySelector({sel!r});return !!n && n.getClientRects().length>0 && getComputedStyle(n).visibility!=='hidden'}})()")

def fluxo(b, w, reduce=False):
    print(f"\n== fluxo {w}px{' (reduzir movimento)' if reduce else ''}")
    ctx, pg, erros = nova(b, w, reduce)
    kb = pg.keyboard
    # etapa 1: Enter com tudo vazio mostra erros e não avança
    pg.click("#nome"); kb.press("Enter"); pg.wait_for_timeout(150)
    check(atual(pg) == 1, "Enter com campos vazios fica na etapa 1")
    check(visivel(pg, "#nome-erro") and visivel(pg, "#whats-erro"), "erros de nome e WhatsApp aparecem")
    check("Ex.:" in txt(pg, "#whats-erro"), f"erro do WhatsApp com exemplo: {txt(pg, '#whats-erro')}")
    check(pg.evaluate("document.activeElement.id") == "nome", "foco vai para o primeiro campo com erro")
    kb.type("Marina Costa"); kb.press("Tab"); kb.type("21987654321")
    check(pg.input_value("#whats") == "(21) 98765-4321", "máscara do WhatsApp")
    check(not visivel(pg, "#nome-erro"), "erro do nome some ao corrigir")
    kb.press("Tab"); kb.type("marina@x"); kb.press("Enter"); pg.wait_for_timeout(150)
    check(atual(pg) == 1 and visivel(pg, "#email-erro"), "e-mail inválido segura a etapa")
    pg.fill("#email", ""); pg.click("#email"); kb.press("Enter"); pg.wait_for_timeout(500)
    check(atual(pg) == 2, "Enter avança para a entrega com e-mail vazio (opcional)")
    check(pg.evaluate("document.activeElement.id") == "t2", "foco no título da etapa 2")
    lateral(pg, w, "etapa 2")
    pg.screenshot(path=str(out / f"fluxo-{w}-e2.png"))
    # etapa 2: CEP manual 99999-999
    pg.click("#cep"); kb.type("99999999"); pg.wait_for_timeout(700)
    check(pg.input_value("#cep") == "99999-999", "máscara do CEP")
    check(visivel(pg, "#manual") and visivel(pg, "#bloco-entrega"), "CEP sem rua abre o endereço manual e o frete")
    pg.click("#numero"); kb.press("Enter"); pg.wait_for_timeout(200)
    check(atual(pg) == 2, "Enter na etapa 2 com faltas não avança")
    for i in ("rua", "bairro", "cidade", "uf", "numero"):
        check(visivel(pg, f"#{i}-erro"), f"erro em {i}")
    check("Sem\u00a0número" in txt(pg, "#numero-erro"), "erro do número com a saída “Sem número”")
    pg.fill("#rua", "Rua das Flores"); pg.dispatch_event("#rua", "input")
    check(not visivel(pg, "#rua-erro"), "erro da rua some ao digitar")
    pg.fill("#bairro", "Centro"); pg.fill("#cidade", "Campinas"); pg.select_option("#uf", "SP")
    check(not visivel(pg, "#uf-erro") and not visivel(pg, "#cidade-erro"), "erros de cidade e estado somem ao corrigir")
    pg.click("#sem-numero")
    check(pg.evaluate("document.getElementById('numero').disabled"), "Sem número desliga o campo")
    pg.click("#outro-recebe"); check(txt(pg, "#outro-recebe") == "Eu vou receber", "texto “Eu vou receber”")
    pg.click("#recebe"); kb.type("Ana"); kb.press("Enter"); pg.wait_for_timeout(200)
    check(atual(pg) == 2 and "Maria\u00a0Souza" in txt(pg, "#recebe-erro"), "quem recebe pede nome e sobrenome com exemplo")
    kb.type(" Lima");
    check(not visivel(pg, "#recebe-erro"), "erro de quem recebe some ao corrigir")
    check("Previsão:" in txt(pg, "#fretes .opcao-d"), f"frete com previsão: {txt(pg, '#fretes .opcao-d')}")
    pg.click("#fretes .opcao:nth-of-type(2)")
    kb.press("Enter") if False else None
    pg.click("#recebe"); kb.press("Enter"); pg.wait_for_timeout(500)
    check(atual(pg) == 3, "Enter avança para o pagamento")
    check(" · Previsão:" in txt(pg, "#feita-2-tx") and ", previsão" not in txt(pg, "#feita-2-tx"), f"linha da entrega (q4): {txt(pg, '#feita-2-tx')}")
    check(pg.evaluate("document.querySelectorAll('.d7-fantasma-raiz').length") <= 1, "no máximo uma cópia de etapa durante o movimento")
    pg.wait_for_timeout(500)
    check(pg.evaluate("document.querySelectorAll('.d7-fantasma-raiz').length") == 0, "a cópia some depois do movimento")
    lateral(pg, w, "etapa 3")
    # etapa 3: cupom
    if w < 1024:
        pg.click("#etapa-3 .resumo-pe"); pg.wait_for_timeout(400)
        check(visivel(pg, "#pedido-in") and visivel(pg, "#veu"), "painel do resumo abre por cima")
        check(pg.evaluate("document.activeElement.id") == "pedido-titulo", "foco no título do painel")
        bg = pg.evaluate("getComputedStyle(document.getElementById('pedido')).backgroundColor")
        check(bg == "rgb(248, 243, 239)", f"painel com fundo creme ({bg})")
        pg.screenshot(path=str(out / f"fluxo-{w}-painel.png"))
    pg.click("#cupom-abrir"); pg.fill("#cupom", "ERRADO"); pg.press("#cupom", "Enter")
    check(visivel(pg, "#cupom-erro"), "cupom inválido mostra erro")
    pg.fill("#cupom", "deoquiz10"); pg.press("#cupom", "Enter"); pg.wait_for_timeout(100)
    check("DEOQUIZ10" in txt(pg, "#cupom-tag"), "cupom DEOQUIZ10 aplicado")
    check(pg.evaluate("document.activeElement.id") == "cupom-tirar", "foco fica no cupom (Remover)")
    check("aplicado" in txt(pg, "#cupom-aviso"), f"desconto anunciado: {txt(pg, '#cupom-aviso')}")
    check(txt(pg, "#v-desc").startswith("−"), "linha de desconto no resumo")
    if w < 1024:
        kb.press("Escape"); pg.wait_for_timeout(400)
        check(not visivel(pg, "#pedido-in") or pg.evaluate("document.getElementById('pedido').classList.contains('recolhido')"), "Esc fecha o painel")
        check(pg.evaluate("document.activeElement.classList.contains('resumo-pe')"), "foco volta para a linha do resumo")
    tot = txt(pg, "#v-total .vh")
    check(tot.replace(" ", " ") in txt(pg, "#btn-pagar-tx").replace(" ", " "), f"botão com o valor exato: {txt(pg, '#btn-pagar-tx')}")
    # Pix: CPF vazio segura
    pg.click("#cpf"); kb.press("Enter"); pg.wait_for_timeout(150)
    check(visivel(pg, "#cpf-erro") and tela(pg) == "checkout", "CPF inválido segura o pagamento")
    # CPF não fica atrás da barra do rodapé
    if w < 1024:
        r = pg.evaluate("(()=>{const c=document.getElementById('cpf').getBoundingClientRect();const b=[...document.querySelectorAll('.etapa-acoes')].find(x=>x.getClientRects().length).getBoundingClientRect();return [c.bottom,b.top]})()")
        check(r[0] <= r[1], f"CPF visível acima da barra ({r[0]:.0f} ≤ {r[1]:.0f})")
    kb.type("52998224725")
    # Alterar: apaga o nome e tenta pagar → volta para a etapa 1 (q2)
    pg.click("#feita-1 .feita-alt"); pg.wait_for_timeout(400)
    check(atual(pg) == 1, "Alterar volta para o contato")
    pg.fill("#nome", "");
    pg.evaluate("DeoCK.irPara(3)"); pg.wait_for_timeout(700)  # q2: meio segundo de trava depois de trocar de etapa
    pg.click("#btn-pagar"); pg.wait_for_timeout(300)
    check(atual(pg) == 1 and visivel(pg, "#nome-erro") and tela(pg) == "checkout", "pagar confere as 3 etapas (nome apagado volta para a etapa 1)")
    pg.fill("#nome", "Marina Costa"); pg.click("#nome"); kb.press("Enter"); pg.wait_for_timeout(500)
    check(atual(pg) == 3, "Continuar pula direto para o pagamento já preenchido")
    # Pix: botão ocupado, segundo toque ignorado (q1), tela própria (d1 B)
    pg.click("#cpf"); kb.press("Enter"); pg.wait_for_timeout(100)
    check("Gerando o seu Pix" in txt(pg, "#btn-pagar-tx") and pg.get_attribute("#btn-pagar", "aria-busy") == "true", f"botão ocupado (q1): {txt(pg, '#btn-pagar-tx')}")
    pg.click("#btn-pagar", force=True); pg.wait_for_timeout(1100)
    check(tela(pg) == "pix" and pg.locator("#px").count() == 1, f"Enter paga com Pix e abre a tela do Pix ({tela(pg)})")
    check(pg.evaluate("document.activeElement.id") == "px-titulo", f"foco no título do Pix ({pg.evaluate('document.activeElement.id')})")
    lateral(pg, w, "tela do Pix")
    pg.screenshot(path=str(out / f"fluxo-{w}-pix.png"))
    # trocar a forma de pagamento: volta à etapa 3 com o botão livre
    pg.evaluate("DeoCK.px.trocar(true)"); pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Não paguei, quero trocar").click(); pg.wait_for_timeout(600)
    check(tela(pg) == "checkout" and atual(pg) == 3 and pg.get_attribute("#btn-pagar", "aria-busy") is None, "trocar forma volta à etapa 3 com o botão livre")
    # Cartão + fatura diferente
    pg.click("#pagamentos .opcao:nth-of-type(2)")
    check(visivel(pg, "#cartao") and pg.input_value("#cc-nome") == "MARINA COSTA", "cartão abre com o nome")
    check(txt(pg, "#pag-cartao-v").startswith("até 6x de"), f"opção do cartão (q8): {txt(pg, '#pag-cartao-v')}")
    pg.click("#fatura-igual"); pg.wait_for_timeout(100)
    check(visivel(pg, "#fatura"), "desmarcar a fatura mostra os campos do endereço da fatura")
    lateral(pg, w, "cartão com fatura")
    pg.click("#btn-pagar"); pg.wait_for_timeout(200)
    for i in ("cc-num", "cc-val", "cc-cvv", "fat-cep", "fat-rua", "fat-cidade", "fat-uf"):
        check(visivel(pg, f"#{i}-erro"), f"erro em {i}")
    sh = pg.evaluate("getComputedStyle(document.activeElement).boxShadow")
    check("rgb(243, 221, 227)" in sh, f"campo com erro em foco mostra o halo ({sh[:60]})")
    pg.fill("#cc-num", "4111111111111111"); pg.dispatch_event("#cc-num", "input")
    pg.fill("#cc-val", "08/29"); pg.fill("#cc-cvv", "123")
    pg.select_option("#parcelas", "3"); pg.wait_for_timeout(50)
    check(txt(pg, "#btn-pagar-tx").endswith("no cartão") and "3x" in txt(pg, "#btn-pagar-tx"), f"botão do cartão: {txt(pg, '#btn-pagar-tx')}")
    pg.fill("#fat-cep", "01310100"); pg.dispatch_event("#fat-cep", "input"); pg.fill("#fat-rua", "Avenida Paulista, 1000"); pg.fill("#fat-cidade", "São Paulo"); pg.select_option("#fat-uf", "SP")
    pg.screenshot(path=str(out / f"fluxo-{w}-cartao.png"), full_page=False)
    pg.click("#btn-pagar"); pg.wait_for_timeout(150)
    check("Confirmando com o banco" in txt(pg, "#btn-pagar-tx"), f"cartão ocupado: {txt(pg, '#btn-pagar-tx')}")
    pg.wait_for_timeout(1800)
    check(tela(pg) == "confirmacao" and "3x" in txt(pg, "#ok"), f"cartão aprovado em 3x leva à confirmação ({tela(pg)})")
    check(pg.evaluate("(document.activeElement.textContent||'').includes('Pedido confirmado')"), f"foco em “Pedido confirmado” ({pg.evaluate('document.activeElement.id')})")
    lateral(pg, w, "confirmação")
    pg.screenshot(path=str(out / f"fluxo-{w}-confirmacao.png"))
    ctx.close()
    # carteira (página nova)
    ctx, pg, erros2 = nova(b, w, reduce)
    pg.evaluate("DeoCK.exemplo(3,{pag:'carteira'})"); pg.wait_for_timeout(100)
    check(visivel(pg, "#btn-carteira") and not visivel(pg, "#btn-pagar"), "carteira troca o botão rosa pelo preto")
    pg.click("#btn-carteira"); pg.wait_for_timeout(150)
    check("Abrindo o" in txt(pg, "#btn-carteira"), f"carteira ocupada: {txt(pg, '#btn-carteira')}")
    pg.wait_for_timeout(1700)
    check(tela(pg) == "confirmacao" and "Pay" in txt(pg, "#ok"), f"paga com a carteira ({tela(pg)})")
    erros += erros2
    check(not erros, f"[{w}] console sem erros: {erros}")
    ctx.close()

def rapidas(b):
    print("\n== correções rápidas da Rodada 2")
    ctx, pg, erros = nova(b, 375)
    # q13 + q2: depois de "Alterar" no contato com a entrega feita, o botão diz "pagamento"; toque duplo não pula etapa
    pg.evaluate("DeoCK.exemplo(3)"); pg.click("#feita-1 .feita-alt"); pg.wait_for_timeout(500)
    b1 = txt(pg, '[data-avancar="1"]')
    check(b1 == "Continuar para o pagamento", f"q13 botão: {b1}")
    pg.evaluate("""(()=>{const toque=n=>{n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));n.click()};toque(document.querySelector('[data-avancar="1"]'));toque(document.querySelector('[data-avancar="3"]'))})()""")
    pg.wait_for_timeout(700)
    check(atual(pg) == 3 and tela(pg) == "checkout" and pg.get_attribute("#btn-pagar", "aria-busy") is None, f"q2 toque duplo não paga sem ver a etapa 3 ({atual(pg)}, {tela(pg)})")
    # q3: previsão não cai em feriado nacional
    datas = pg.evaluate("[...document.querySelectorAll('#fretes .opcao-d')].map(n=>n.textContent)")
    check(all("02/11" not in d and "15/11" not in d and "20/11" not in d for d in datas), f"q3 previsão sem feriado: {datas}")
    # q14 + q15: trocar o CEP desmarca "Sem número" e o frete volta para "Calculado após o CEP"
    pg.click("#feita-2 .feita-alt"); pg.wait_for_timeout(500)
    pg.click("#sem-numero"); pg.fill("#cep", "0131"); pg.dispatch_event("#cep", "input"); pg.wait_for_timeout(100)
    check(pg.evaluate("DeoCK.pedido().frete") is None, "q15 sem CEP, sem frete no total")
    pg.fill("#cep", "01310100"); pg.dispatch_event("#cep", "input"); pg.wait_for_timeout(700)
    check(not pg.evaluate("document.getElementById('sem-numero').checked") and not pg.evaluate("document.getElementById('numero').disabled"), "q14 trocar o CEP desmarca “Sem número”")
    # q16: rótulos dentro do campo em quem recebe e cupom
    check(pg.evaluate("!!document.querySelector('#campo-recebe .flut label[for=recebe]') && !!document.querySelector('.cupom-form .flut label[for=cupom]')"), "q16 rótulo dentro do campo")
    # q11: sem "diálogo" fora do modo janela, com título principal
    check(pg.evaluate("!document.getElementById('corpo').hasAttribute('role') && !!document.querySelector('h1.titulo-checkout')"), "q11 página sem role=dialog e com título")
    # q5, q6, q7
    check("código Pix para copiar e colar" in pg.evaluate("document.querySelector('#pix-info p').textContent"), "q5 apoio do Pix")
    check("depois de receber" in pg.evaluate("document.querySelector('.confianca').textContent"), "q6 troca depois de receber")
    check("a gente fala com você" in pg.evaluate("document.getElementById('whats-ok').textContent"), "q7 voz do aviso do WhatsApp")
    # q10: respiro da lista de itens
    check(pg.evaluate("getComputedStyle(document.getElementById('itens')).paddingTop") == "16px", "q10 respiro dos itens")
    # q18: dígitos de mesma largura no total
    check(pg.evaluate("document.querySelectorAll('#v-total .dg').length") >= 4, "q18 dígitos com largura fixa")
    # q19: cupom desliza o que fica abaixo
    pg.evaluate("DeoCK.resumo(true)"); pg.wait_for_timeout(350)
    pg.click("#cupom-abrir"); pg.fill("#cupom", "DEOQUIZ10"); pg.press("#cupom", "Enter")
    check(pg.evaluate("document.getAnimations().some(a=>a.effect&&a.effect.target&&a.effect.target.closest&&a.effect.target.closest('.pedido-in'))"), "q19 o resumo desliza ao aplicar o cupom")
    ctx.close()
    # q9: 320 px — botão de pagar numa linha, ícone ao lado de "Cartão de crédito"
    ctx, pg, erros2 = nova(b, 320)
    pg.evaluate("DeoCK.exemplo(3,{pag:'cartao'})"); pg.wait_for_timeout(200)
    hb = pg.evaluate("document.getElementById('btn-pagar').getBoundingClientRect().height")
    check(hb <= 54, f"q9 botão de pagar numa linha em 320 px ({hb:.0f} px)")
    alinhado = pg.evaluate("(()=>{const o=[...document.querySelectorAll('#pagamentos .opcao-t')][1];const i=o.querySelector('svg').getBoundingClientRect(),t=o.querySelector('span').getBoundingClientRect();return Math.abs(i.top-t.top)<24})()")
    check(alinhado, "q9 ícone do cartão ao lado do nome")
    ctx.close()
    # q17: tablet com a coluna de 640 px
    ctx, pg, erros3 = nova(b, 768)
    wf = pg.evaluate("document.getElementById('fluxo').getBoundingClientRect().width")
    check(abs(wf - 640) < 2, f"q17 coluna das etapas no tablet ({wf:.0f} px)")
    ctx.close()
    check(not (erros + erros2 + erros3), f"console limpo nas correções rápidas {erros + erros2 + erros3}")

def tab_desktop(b):
    print("\n== Tab no computador começa pelo formulário")
    ctx, pg, erros = nova(b, 1280)
    ids = []
    for _ in range(4):
        pg.keyboard.press("Tab"); ids.append(pg.evaluate("document.activeElement.id || document.activeElement.className || document.activeElement.tagName"))
    check("nome" in ids, f"Tab: {ids}")
    ctx.close()

def laterais(b):
    print("\n== rolagem lateral e alvos de toque")
    for w in (320, 375, 768, 1280):
        for e, op in ((1, "{}"), (2, "{}"), (3, "{pag:'cartao'}"), (3, "{pag:'carteira'}")):
            ctx, pg, erros = nova(b, w)
            pg.evaluate(f"DeoCK.exemplo({e},{op})")
            if "cartao" in op: pg.click("#fatura-igual")
            pg.wait_for_timeout(200)
            lateral(pg, w, f"etapa {e} {op}")
            if w == 375 and e == 2:
                pequenos = pg.evaluate("""[...document.querySelectorAll('.link,.feita-alt,#outro-recebe')].filter(n=>n.getClientRects().length).map(n=>[n.textContent.trim(),Math.round(n.getBoundingClientRect().height)]).filter(x=>x[1]<44)""")
                check(not pequenos, f"alvos de texto ≥ 44 px: {pequenos}")
            check(not erros, f"[{w}] e{e} console: {erros}")
            ctx.close()

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        fluxo(b, 375); fluxo(b, 1280); fluxo(b, 768, reduce=True)
        rapidas(b); tab_desktop(b); laterais(b)
        b.close()
finally:
    comum.parar(httpd)
print("capturas em", out)
comum.encerrar("qa_v3", len(ok), falhas)
