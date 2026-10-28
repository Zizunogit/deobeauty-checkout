#!/usr/bin/env python3
"""Testes de fluxo do módulo volta (cliente que volta) em 320, 375, 768 e 1280.
Uso: python3 testes/qa_volta.py [--w 320,375,768,1280] [--port 8992] [--out pasta]
Simula o módulo de pagamento: DeoCK.aoPagar dispara deo:aprovado com um slot de teste.
Capturas em saida-testes/qa_volta/."""
import argparse
from playwright.sync_api import sync_playwright
import comum

ap = argparse.ArgumentParser()
ap.add_argument("--w", default="320,375,768,1280")
ap.add_argument("--port", type=int, default=8992)
ap.add_argument("--out", default=None)
a = ap.parse_args()
OUT = comum.saida("qa_volta", a.out)
comum.inicio("qa_volta", a.port)
httpd = comum.servir(a.port)
URL = comum.endereco(a.port, "#checkout")

falhas, oks = [], []
def check(cond, msg):
    (oks if cond else falhas).append(msg)
    print(("  ok    " if cond else "  FALHA ") + msg)

def nova(b, w, reduce=False, init=None, relogio=False):
    ctx = comum.contexto(b, w, reduce=reduce, touch=w < 768)
    pg, erros = comum.nova_pagina(ctx)
    if init: pg.add_init_script(init)
    if relogio: pg.clock.install()
    abrir(pg)
    return ctx, pg, erros

def abrir(pg):
    pg.goto("about:blank"); pg.goto(URL, wait_until="networkidle"); pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(250)

# faz o papel do módulo de pagamento: aprova na hora e dispara deo:aprovado com um slot de teste
SIMULA_PAG = """(() => {
  window.__aprov = 0;
  DeoCK.aoPagar = function (info) {
    window.__aprov++; window.__info = info;
    var c = document.getElementById('teste-conf');
    if (!c) {
      c = document.createElement('div'); c.id = 'teste-conf';
      c.style.cssText = 'position:fixed;inset:0;z-index:60;background:#fff;padding:32px 16px;display:flex;flex-direction:column;gap:16px;max-width:600px;margin:0 auto';
      c.innerHTML = '<h2 style="font-family:var(--f-titulo);font-weight:400;font-size:28px">Pedido confirmado (tela de teste)</h2><div class="slot" id="teste-slot"></div>';
      document.body.appendChild(c);
    }
    DeoCK.tela('confirmacao');
    document.dispatchEvent(new CustomEvent('deo:aprovado', { detail: { info: info, slot: document.getElementById('teste-slot') } }));
    return true;
  };
})()"""

T_FIM = "Seus dados ficam lembrados neste aparelho por 180 dias. Para esquecer, toque em “Não é você?” na próxima compra."
T_LIB = "Pronto! Agora você vê e altera seus dados."
T_ERR = "Esse código não confere. Confira os 6 números ou peça outro."
T_FALTA = "Faltam números. O código tem 6."
T_ESQ = "Pronto, esquecemos os dados deste aparelho."
T_AJUDA = "Na próxima compra, é só pagar. Para ver tudo ou mudar algo, a gente manda um código no seu WhatsApp. Fica por 180 dias."
# nada disso pode aparecer (nem para o leitor de tela) antes do código certo
COMPLETOS = ["98765-4321", "98765", "529.982.247-25", "529", "Fernandes", "Lobo", "05121", "marina.costa", "Costa", "Domingos", ", 220"]

def ev(pg, js): return pg.evaluate(js)
def vis(pg, sel): return pg.evaluate(f"(()=>{{const n=document.querySelector({sel!r});return !!n && n.getClientRects().length>0 && getComputedStyle(n).visibility!=='hidden'}})()")
def txt(pg, sel): return pg.evaluate(f"(document.querySelector({sel!r})||{{}}).textContent||''").strip()
def ativo(pg): return pg.evaluate("document.activeElement && (document.activeElement.id || document.activeElement.className || document.activeElement.tagName)")
def atual(pg): return pg.evaluate("DeoCK.estado.atual")
def lateral(pg, w, onde):
    sw = pg.evaluate("document.documentElement.scrollWidth")
    check(sw <= w, f"[{w}] sem rolagem lateral ({onde}): {sw}")
def shot(pg, w, nome, alvo=None):
    if alvo: pg.evaluate(f"document.querySelector({alvo!r}).scrollIntoView({{block:'center'}})"); pg.wait_for_timeout(350)
    pg.screenshot(path=str(OUT / f"{nome}-{w}.png"))
def privado(pg, w, onde):
    vis_txt = pg.evaluate("document.body.innerText")
    arvore = pg.locator("body").aria_snapshot()
    vaz = [c for c in COMPLETOS if c in vis_txt or c in arvore]
    check(not vaz, f"[{w}] nada completo na tela nem no leitor de tela ({onde}) {vaz}")

def fluxo(b, w):
    print(f"\n== {w}px")
    # ---------- 1ª compra: caixa desmarcada; marcada + aprovado = lembra ----------
    ctx, pg, erros = nova(b, w)
    check(ev(pg, "!!document.querySelector('#slot-pagamento-fim #cv-lembrar')"), f"[{w}] caixa no #slot-pagamento-fim")
    check(not ev(pg, "document.getElementById('cv-lembrar').checked"), f"[{w}] caixa começa desmarcada")
    check(txt(pg, "#cv-lembrar-ajuda") == T_AJUDA, f"[{w}] explicação aprovada")
    check(not ev(pg, "DeoCK.cv.estado().lembrado"), f"[{w}] 1ª visita: nada lembrado")
    ev(pg, "DeoCK.exemplo(3)")
    check(not ev(pg, "!!document.getElementById('cv-oferta')"), f"[{w}] preencher por código não chama a oferta")
    if w in (375, 1280): shot(pg, w, "1-primeira", ".cv-lembrar")
    pg.click("label[for=cv-lembrar]")
    check(ev(pg, "document.getElementById('cv-lembrar').checked"), f"[{w}] tocar no rótulo marca a caixa")
    ev(pg, SIMULA_PAG)
    pg.click("#btn-pagar"); pg.wait_for_timeout(200)
    check(ev(pg, "window.__aprov") == 1, f"[{w}] pagou (aoPagar simulado)")
    check(txt(pg, "#teste-slot .cv-fim") == T_FIM, f"[{w}] aviso dos 180 dias no slot da confirmação")
    mem = ev(pg, "JSON.parse(localStorage.getItem('deo-cv-aparelho'))")
    check(mem and sorted(mem.keys()) == ["ate", "chave", "v"], f"[{w}] aparelho guarda só {{v, ate, chave}}: {sorted((mem or {}).keys())}")
    dias = (mem["ate"] - ev(pg, "Date.now()")) / 864e5 if mem else 0
    check(179.9 < dias <= 180, f"[{w}] validade de 180 dias ({dias:.2f})")
    if w in (375, 1280): shot(pg, w, "2-aprovado")
    lateral(pg, w, "aprovado")

    # ---------- mesmo aparelho, próxima compra ----------
    abrir(pg)
    st = ev(pg, "DeoCK.cv.estado()")
    check(st["lembrado"] and st["mascarado"] and atual(pg) == 3, f"[{w}] abre direto no pagamento com partes escondidas")
    check(vis(pg, "#slot-pagamento-topo .cv-cartao"), f"[{w}] cartão no #slot-pagamento-topo")
    check(txt(pg, ".cv-c-t") == "Oi de novo, Marina!", f"[{w}] título: {txt(pg, '.cv-c-t')}")
    check(not vis(pg, "#feita-1") and not vis(pg, "#feita-2") and not vis(pg, "#cpf"), f"[{w}] resumos das etapas 1 e 2 e campo do CPF fora da tela")
    check("•••••-4321" in txt(pg, ".cv-l-1 .cv-l-v") and "Rua José F•••, nº" in txt(pg, ".cv-l-2 .cv-l-v") and "•••.982.247-••" in txt(pg, ".cv-l-cpf .cv-l-v"), f"[{w}] linhas com partes escondidas")
    check("terminado em 4 3 2 1" in txt(pg, ".cv-l-1 .vh"), f"[{w}] leitor de tela ouve 'terminado em 4 3 2 1'")
    check(ev(pg, "document.getElementById('cv-lembrar').checked"), f"[{w}] caixa marcada (ela já tinha escolhido)")
    privado(pg, w, "cartão")
    lateral(pg, w, "cartão")
    shot(pg, w, "3-volta")
    if w == 375: pg.screenshot(path=str(OUT / f"3-volta-{w}-inteira.png"), full_page=True)
    # 1 toque paga com Pix
    ev(pg, SIMULA_PAG)
    pg.click("#btn-pagar"); pg.wait_for_timeout(200)
    check(ev(pg, "window.__aprov") == 1 and ev(pg, "window.__info.forma") == "pix", f"[{w}] 1 toque paga com Pix")
    check(ev(pg, "DeoCK.estado.atual") == 3, f"[{w}] pagar não abriu etapa com dados completos")

    # ---------- janela do código: Esc, Tab, código errado, faltando, certo ----------
    abrir(pg)
    pg.click(".cv-l-2 .cv-alt"); pg.wait_for_timeout(350)
    check(vis(pg, "#cv-janela") and ativo(pg) == "cv-cod-j", f"[{w}] janela abre com foco no código ({ativo(pg)})")
    check(ev(pg, "document.getElementById('corpo').inert && document.querySelector('.topo').inert"), f"[{w}] fundo inerte")
    check(txt(pg, "#cv-j-t") == "Confirme que é você" and "123456" in txt(pg, ".cv-janela .cv-prototipo"), f"[{w}] título e dica do protótipo")
    check(txt(pg, ".cv-j-sem") == "Usar outro endereço, sem código", f"[{w}] saída sem código (entrega)")
    check(ev(pg, "getComputedStyle(document.querySelector('.cv-casas span')).height") == "56px", f"[{w}] casas de 56 px")
    caixa = pg.locator("#cv-janela").bounding_box()
    if w < 1024:
        check(abs(caixa["y"] + caixa["height"] - (812 if w < 768 else 900)) < 2, f"[{w}] janela presa ao rodapé")
    else:
        check(abs(caixa["x"] + caixa["width"] / 2 - w / 2) < 2 and abs(caixa["y"] + caixa["height"] / 2 - 450) < 2, f"[{w}] janela no centro")
    dentro = True
    for _ in range(7):
        pg.keyboard.press("Tab")
        dentro = dentro and ev(pg, "document.getElementById('cv-janela').contains(document.activeElement)")
    check(dentro, f"[{w}] Tab fica dentro da janela")
    privado(pg, w, "janela")
    lateral(pg, w, "janela")
    shot(pg, w, "4-janela")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    check(not vis(pg, "#cv-janela") and ev(pg, "document.activeElement === document.querySelector('.cv-l-2 .cv-alt')"), f"[{w}] Esc fecha e devolve o foco ao Alterar")
    check(not ev(pg, "document.getElementById('corpo').inert"), f"[{w}] fundo volta a funcionar")
    pg.click(".cv-l-2 .cv-alt"); pg.wait_for_timeout(350)
    pg.keyboard.type("111111"); pg.wait_for_timeout(100)
    check(vis(pg, "#cv-cod-j-erro") and txt(pg, "#cv-cod-j-erro") == T_ERR and ev(pg, "document.getElementById('cv-cod-j').getAttribute('aria-invalid')") == "true", f"[{w}] código errado: erro com o que fazer")
    check(vis(pg, "#cv-janela"), f"[{w}] código errado: janela continua")
    shot(pg, w, "5-janela-erro")
    pg.keyboard.type("12"); pg.wait_for_timeout(50)
    check(not vis(pg, "#cv-cod-j-erro") and ev(pg, "document.getElementById('cv-cod-j').value") == "12", f"[{w}] digitar de novo substitui e limpa o erro")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(50)
    check(txt(pg, "#cv-cod-j-erro") == T_FALTA and atual(pg) == 3, f"[{w}] Enter com código incompleto: 'faltam números' e não envia a etapa")
    pg.keyboard.type("3456"); pg.wait_for_timeout(500)
    check(not vis(pg, "#cv-janela") and atual(pg) == 2, f"[{w}] código certo: janela fecha e abre a entrega")
    check(txt(pg, "#etapa-2 .cv-aviso p") == T_LIB, f"[{w}] aviso 'Pronto! Agora você vê e altera seus dados.'")
    st = ev(pg, "DeoCK.cv.estado()")
    check(st["verificado"] and not st["mascarado"] and ev(pg, "document.getElementById('cep').value") == "05121-120", f"[{w}] dados completos liberados")
    check(ativo(pg) == "t2", f"[{w}] foco no título da entrega ({ativo(pg)})")
    lateral(pg, w, "liberado")
    shot(pg, w, "6-liberado")
    # alterar e pagar: a memória passa a ter o dado novo
    pg.fill("#numero", "300")
    pg.click("[data-avancar='2']"); pg.wait_for_timeout(600)
    check(atual(pg) == 3 and "300" in txt(pg, "#feita-2-tx") and vis(pg, "#feita-2") and vis(pg, "#cpf"), f"[{w}] alterou o número e voltou ao pagamento com tudo à vista")
    check(not vis(pg, "#etapa-2 .cv-aviso"), f"[{w}] aviso da etapa 2 sai junto com a etapa")
    ev(pg, SIMULA_PAG); pg.click("#btn-pagar"); pg.wait_for_timeout(200)
    check(ev(pg, "JSON.parse(localStorage.getItem('deo-cv-sim-loja')).clientes['11987654321'].numero") == "300", f"[{w}] memória atualizada com o número novo")

    # ---------- “Não é você?” ----------
    abrir(pg)
    pg.click(".cv-naosou"); pg.wait_for_timeout(100)
    check(vis(pg, "#cv-confirma") and ativo(pg) == "cv-confirma-p" and ev(pg, "document.querySelector('.cv-naosou').getAttribute('aria-expanded')") == "true", f"[{w}] 'Não é você?' abre a pergunta com foco nela")
    shot(pg, w, "7-naosou", ".cv-cartao")
    pg.click(".cv-cancelar")
    check(not vis(pg, "#cv-confirma") and ev(pg, "document.activeElement.classList.contains('cv-naosou')"), f"[{w}] Cancelar fecha e devolve o foco")
    pg.click(".cv-naosou"); pg.click(".cv-esquecer"); pg.wait_for_timeout(500)
    vazios = ev(pg, "['nome','whats','email','cep','cpf'].every(id => !document.getElementById(id).value)")
    check(atual(pg) == 1 and vazios and txt(pg, "#etapa-1 .cv-aviso p") == T_ESQ, f"[{w}] esqueceu: etapa 1 vazia com aviso")
    check(ev(pg, "localStorage.getItem('deo-cv-aparelho')") is None and not ev(pg, "!!document.querySelector('.cv-cartao')"), f"[{w}] memória do aparelho apagada")
    check(not ev(pg, "document.getElementById('cv-lembrar').checked") and ev(pg, "DeoCK.estado.feito[1]") is False, f"[{w}] caixa desmarcada e etapas zeradas")
    check(txt(pg, "#v-frete") == "Calculado após o CEP", f"[{w}] frete volta para 'Calculado após o CEP' ({txt(pg, '#v-frete')})")
    lateral(pg, w, "esqueceu")
    shot(pg, w, "8-esqueceu")
    abrir(pg)
    check(atual(pg) == 1 and not ev(pg, "DeoCK.cv.estado().lembrado"), f"[{w}] recarregar: começa do zero")
    check(not erros, f"[{w}] console limpo (aparelho 1): {erros}")
    ctx.close()

    # ---------- outro aparelho: oferta na etapa 1 ----------
    ctx, pg, erros = nova(b, w)
    pg.click("#nome"); pg.keyboard.type("Marina Costa"); pg.keyboard.press("Tab"); pg.keyboard.type("11987654321"); pg.wait_for_timeout(150)
    check(vis(pg, "#slot-contato #cv-oferta") and txt(pg, ".cv-o-t") == "Que bom te ver de novo!", f"[{w}] WhatsApp conhecido: oferta no #slot-contato")
    lateral(pg, w, "oferta")
    shot(pg, w, "9-oferta", "#cv-oferta")
    pg.keyboard.press("Tab")
    check(ev(pg, "document.activeElement.classList.contains('cv-o-btn')"), f"[{w}] Tab do WhatsApp vai para 'Receber código'")
    pg.click(".cv-o-agora")
    check(not ev(pg, "!!document.getElementById('cv-oferta')") and ativo(pg) == "email", f"[{w}] 'Agora não' tira a oferta e foca o e-mail")
    pg.fill("#whats", ""); pg.click("#whats"); pg.keyboard.type("11987654321"); pg.wait_for_timeout(100)
    check(not ev(pg, "!!document.getElementById('cv-oferta')"), f"[{w}] depois de 'Agora não', não insiste no mesmo número")
    pg.fill("#email", "")
    pg.click("[data-avancar='1']"); pg.wait_for_timeout(500)
    check(atual(pg) == 2 and ev(pg, "document.getElementById('cep').value") == "", f"[{w}] segue o caminho de sempre, sem dados da loja")
    check(not erros, f"[{w}] console limpo (agora não): {erros}")
    ctx.close()

    ctx, pg, erros = nova(b, w)
    pg.click("#nome"); pg.keyboard.type("Marina Costa"); pg.keyboard.press("Tab"); pg.keyboard.type("11987654321"); pg.wait_for_timeout(150)
    pg.click(".cv-o-btn"); pg.wait_for_timeout(100)
    check(ativo(pg) == "cv-cod-w" and not vis(pg, "#email") and "•••••-4321" in txt(pg, "#cv-o-p2"), f"[{w}] código pedido: foco no campo, e-mail sai")
    check(ev(pg, "document.getElementById('cv-cod-w').getAttribute('autocomplete')") == "one-time-code", f"[{w}] campo com autocomplete one-time-code")
    lateral(pg, w, "oferta código")
    shot(pg, w, "10-oferta-codigo", "#cv-oferta")
    pg.keyboard.type("000000"); pg.wait_for_timeout(100)
    check(txt(pg, "#cv-cod-w-erro") == T_ERR and atual(pg) == 1, f"[{w}] código errado na etapa 1")
    pg.keyboard.type("123456"); pg.wait_for_timeout(600)
    check(atual(pg) == 3 and ev(pg, "document.getElementById('cpf').value") == "529.982.247-25" and vis(pg, "#cpf"), f"[{w}] código certo: CPF preenchido e pagamento")
    check("José Fernandes Lobo, 220" in txt(pg, "#feita-2-tx") and vis(pg, "#feita-2"), f"[{w}] endereço preenchido ({txt(pg, '#feita-2-tx')})")
    check(txt(pg, "#slot-pagamento-topo .cv-aviso p") == "Pronto, Marina! Endereço e CPF preenchidos. Confira e pague.", f"[{w}] aviso de pronto")
    check(not ev(pg, "document.getElementById('cv-lembrar').checked"), f"[{w}] outro aparelho: caixa continua desmarcada")
    lateral(pg, w, "outro aparelho pronto")
    shot(pg, w, "11-outro-pronto")
    pg.click(".cv-limpar"); pg.wait_for_timeout(500)
    check(atual(pg) == 1 and not ev(pg, "document.getElementById('whats').value") and "limpamos" in txt(pg, "#etapa-1 .cv-aviso p"), f"[{w}] 'Limpar dados' volta ao começo")
    check(not erros, f"[{w}] console limpo (outro aparelho): {erros}")
    ctx.close()

    # ---------- saídas sem código e trocar CPF ----------
    ctx, pg, erros = nova(b, w)
    ev(pg, "DeoCK.cv.lembrarExemplo()"); abrir(pg)
    pg.click(".cv-l-2 .cv-alt"); pg.wait_for_timeout(300)
    pg.click(".cv-j-sem"); pg.wait_for_timeout(500)
    check(atual(pg) == 2 and ev(pg, "document.getElementById('cep').value") == "" and "não mostra o endereço" in txt(pg, "#etapa-2 .cv-nota"), f"[{w}] 'Usar outro endereço, sem código': CEP vazio com nota")
    check(txt(pg, "#v-frete") == "Calculado após o CEP", f"[{w}] frete volta para 'Calculado após o CEP'")
    privado(pg, w, "outro endereço")
    shot(pg, w, "12-sem-codigo")
    pg.click("#cep"); pg.keyboard.type("01310100"); pg.wait_for_timeout(700)
    pg.fill("#numero", "1000"); pg.click("[data-avancar='2']"); pg.wait_for_timeout(600)
    check(atual(pg) == 3 and "Avenida Paulista, 1000" in txt(pg, "#feita-2-tx") and not ev(pg, "!!document.querySelector('.cv-l-2')"), f"[{w}] endereço novo no resumo; cartão sem a linha da entrega")
    check(vis(pg, ".cv-l-1") and vis(pg, ".cv-l-cpf") and not vis(pg, "#feita-1"), f"[{w}] contato e CPF continuam escondidos")
    privado(pg, w, "endereço novo")
    pg.click(".cv-l-cpf .cv-alt"); pg.wait_for_timeout(100)
    check(vis(pg, "#cpf") and ev(pg, "document.getElementById('cpf').value") == "" and ativo(pg) == "cpf", f"[{w}] Trocar CPF: campo vazio com foco")
    pg.click(".cv-l-1 .cv-alt"); pg.wait_for_timeout(300)
    check(txt(pg, ".cv-j-sem") == "Digitar outro contato, sem código", f"[{w}] saída sem código (contato)")
    pg.click(".cv-j-sem"); pg.wait_for_timeout(500)
    check(atual(pg) == 1 and ev(pg, "['nome','whats','email'].every(id => !document.getElementById(id).value)"), f"[{w}] contato vazio para digitar de novo")
    pg.click("#nome"); pg.keyboard.type("Ana Lima"); pg.keyboard.press("Tab"); pg.keyboard.type("11987654321"); pg.wait_for_timeout(100)
    check(not ev(pg, "!!document.getElementById('cv-oferta')"), f"[{w}] aparelho lembrado: sem oferta na etapa 1")
    check(ev(pg, "!!document.querySelector('.cv-cartao.cv-cartao-sem-linhas')"), f"[{w}] tudo redigitado: fica só a saudação com 'Não é você?'")
    lateral(pg, w, "sem código")
    check(not erros, f"[{w}] console limpo (sem código): {erros}")
    ctx.close()

    # ---------- vindo da sacola (deo:checkout) ----------
    ctx, pg, erros = nova(b, w, init="document.addEventListener('DOMContentLoaded', function () { document.documentElement.setAttribute('data-tela','loja'); })")
    ev(pg, "DeoCK.cv.lembrarExemplo()"); abrir(pg)
    check(atual(pg) == 1 and not ev(pg, "DeoCK.cv.estado().lembrado"), f"[{w}] na loja: ainda não aplicou")
    ev(pg, "DeoCK.abrirCheckout()"); pg.wait_for_timeout(300)
    check(atual(pg) == 3 and ev(pg, "DeoCK.cv.estado().mascarado") and ativo(pg) == "t3", f"[{w}] deo:checkout: abre no pagamento, foco no título")
    ev(pg, "DeoCK.tela('loja'); DeoCK.abrirCheckout()")
    check(ev(pg, "document.querySelectorAll('.cv-cartao').length") == 1, f"[{w}] abrir de novo não duplica o cartão")
    check(not erros, f"[{w}] console limpo (sacola): {erros}")
    ctx.close()

def extras(b):
    print("\n== extras 375")
    # reenviar com espera (relógio controlado)
    ctx, pg, erros = nova(b, 375, relogio=True)
    ev(pg, "DeoCK.cv.lembrarExemplo()"); abrir(pg)
    pg.click(".cv-l-1 .cv-alt")
    check(txt(pg, ".cv-janela .cv-reenviar .num") == "Reenviar em 0:30" and not vis(pg, ".cv-janela .cv-reenviar-b"), "espera de 0:30 antes de reenviar")
    pg.clock.run_for(31000)
    check(vis(pg, ".cv-janela .cv-reenviar-b"), "depois da espera, botão 'Reenviar código'")
    shot(pg, 375, "13-reenviar")
    pg.click(".cv-janela .cv-reenviar-b")
    pg.clock.run_for(200)
    check(ativo(pg) == "cv-cod-j" and txt(pg, ".cv-janela .cv-reenviar .num") == "Reenviar em 0:30", "reenviar: espera recomeça e o foco volta ao código")
    check(txt(pg, ".cv-janela .cv-reenviar .vh") == "Código reenviado.", "reenviar: anúncio para o leitor de tela")
    check(not erros, f"console limpo (reenviar): {erros}")
    ctx.close()
    # reduzir movimento: janela sem animação; casas nunca animam
    ctx, pg, erros = nova(b, 375, reduce=True)
    ev(pg, "DeoCK.cv.lembrarExemplo()"); abrir(pg)
    pg.click(".cv-l-2 .cv-alt")
    n = ev(pg, "document.getElementById('cv-janela').getAnimations().length + document.querySelector('.cv-veu').getAnimations().length")
    check(n == 0, f"reduzir movimento: janela sem animação ({n})")
    ctx.close()
    ctx, pg, erros = nova(b, 375)
    ev(pg, "DeoCK.cv.lembrarExemplo()"); abrir(pg)
    pg.click(".cv-l-2 .cv-alt")
    an = ev(pg, "document.getElementById('cv-janela').getAnimations().map(a => a.effect.getTiming().duration)")
    casas = ev(pg, "[...document.querySelectorAll('.cv-casas span')].reduce((t, s) => t + s.getAnimations().length, 0)")
    check(an and max(an) <= 450 and casas == 0, f"movimento: janela {an} ms, casas sem animação ({casas})")
    pg.keyboard.type("12")
    casas = ev(pg, "[...document.querySelectorAll('.cv-casas span')].reduce((t, s) => t + s.getAnimations().length + (getComputedStyle(s).transitionDuration !== '0s' ? 1 : 0), 0)")
    check(casas == 0, f"casas não animam ao digitar ({casas})")
    check(not erros, f"console limpo (movimento): {erros}")
    ctx.close()
    # aparelho com a memória bloqueada: segue sem lembrar, sem erro
    ctx, pg, erros = nova(b, 375, init="Object.defineProperty(window,'localStorage',{get(){throw new Error('bloqueado')}})")
    ev(pg, "DeoCK.exemplo(3)"); pg.click("label[for=cv-lembrar]"); ev(pg, SIMULA_PAG); pg.click("#btn-pagar"); pg.wait_for_timeout(200)
    check(txt(pg, "#teste-slot") == "", "memória bloqueada: não promete que lembrou")
    check(not erros, f"console limpo (memória bloqueada): {erros}")
    ctx.close()
    # quem volta pode desmarcar a caixa: pagar esquece o aparelho
    ctx, pg, erros = nova(b, 375)
    ev(pg, "DeoCK.cv.lembrarExemplo()"); abrir(pg)
    pg.click("label[for=cv-lembrar]")
    check(not ev(pg, "document.getElementById('cv-lembrar').checked"), "quem volta desmarca a caixa")
    ev(pg, SIMULA_PAG); pg.click("#btn-pagar"); pg.wait_for_timeout(200)
    check(txt(pg, "#teste-slot .cv-fim") == "Pronto, esquecemos seus dados neste aparelho." and ev(pg, "localStorage.getItem('deo-cv-aparelho')") is None, "desmarcada + aprovado: esquece e avisa")
    ctx.close()
    # com partes escondidas, escolher cartão não mostra o nome inteiro em “Nome impresso no cartão”
    ctx, pg, erros = nova(b, 375)
    ev(pg, "DeoCK.cv.lembrarExemplo()"); abrir(pg)
    pg.click("label.opcao:has(input[value=cartao])"); pg.wait_for_timeout(150)
    check(ev(pg, "document.getElementById('cc-nome').value") == "", "cartão: nome do cartão não vem preenchido com o nome inteiro")
    privado(pg, 375, "cartão escolhido")
    check(not erros, f"console limpo (cartão): {erros}")
    ctx.close()
    # memória vencida: esquece sozinha
    ctx, pg, erros = nova(b, 375)
    ev(pg, "DeoCK.cv.lembrarExemplo(); var m = JSON.parse(localStorage.getItem('deo-cv-aparelho')); m.ate = Date.now() - 1; localStorage.setItem('deo-cv-aparelho', JSON.stringify(m))")
    abrir(pg)
    check(atual(pg) == 1 and ev(pg, "localStorage.getItem('deo-cv-aparelho')") is None, "passou de 180 dias: esquece sozinho")
    ctx.close()
    # ganchos documentados
    ctx, pg, erros = nova(b, 375)
    ev(pg, "DeoCK.cv.voltar()"); check(ev(pg, "DeoCK.cv.mascarado()"), "gancho voltar()")
    ev(pg, "DeoCK.cv.abrirCodigo(1)"); check(vis(pg, "#cv-janela"), "gancho abrirCodigo(1)")
    ev(pg, "DeoCK.cv.codigo('123456')"); pg.wait_for_timeout(300); check(atual(pg) == 1 and ev(pg, "DeoCK.cv.estado().verificado"), "gancho codigo('123456')")
    ev(pg, "DeoCK.cv.outroAparelho('codigo')"); check(vis(pg, "#cv-cod-w"), "gancho outroAparelho('codigo')")
    ev(pg, "DeoCK.cv.primeiraCompra(true)"); check(ev(pg, "document.getElementById('cv-lembrar').checked") and atual(pg) == 3, "gancho primeiraCompra(true)")
    ev(pg, "DeoCK.cv.voltar(); DeoCK.cv.naoSou()"); check(vis(pg, "#cv-confirma"), "gancho naoSou()")
    ev(pg, "DeoCK.cv.esquecer()"); check(ev(pg, "localStorage.getItem('deo-cv-aparelho') === null && localStorage.getItem('deo-cv-sim-loja') === null"), "gancho esquecer()")
    check(not erros, f"console limpo (ganchos): {erros}")
    ctx.close()

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w in [int(x) for x in a.w.split(",") if x]:
            fluxo(b, w)
        extras(b)
        b.close()
finally:
    comum.parar(httpd)
print("capturas em", OUT)
comum.encerrar("qa_volta", len(oks), falhas)
