#!/usr/bin/env python3
"""QA do módulo pagamento (v3): fluxos com clique e teclado, estados, movimento, rolagem lateral e console.
Uso: python3 testes/qa_pagamento.py [--port 8974] [--so nome,nome] [--cap] [--out pasta]
  --so   roda só estes blocos: pix, teclado, cartao, recusa, carteira, calmo, escondida, extras, mv, larguras
  --cap  grava as capturas finais (e os quadros do movimento) em saida-testes/qa_pagamento/ ou --out"""
import argparse, re
from playwright.sync_api import sync_playwright
import comum

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=8974)
ap.add_argument("--so", default=None)
ap.add_argument("--cap", action="store_true")
ap.add_argument("--out", default=None)
a = ap.parse_args()
PORT = a.port
SO = set(a.so.split(",")) if a.so else None
CAP = a.cap
OUT = comum.saida("qa_pagamento", a.out, criar=CAP)
comum.inicio("qa_pagamento", PORT)
httpd = comum.servir(PORT)

falhas, oks = [], []
def check(c, msg):
    (oks if c else falhas).append(msg)
    print(("  ok    " if c else "  FALHA ") + msg)

def nova(b, w, reduce=False):
    ctx = comum.contexto(b, w, reduce=reduce, touch=w < 768)
    ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=f"http://127.0.0.1:{PORT}")
    pg, erros = comum.nova_pagina(ctx)
    comum.abrir(pg, PORT, "#checkout")
    pg.evaluate("window.__aprov=[]; document.addEventListener('deo:aprovado', e => __aprov.push({forma: e.detail.info.forma, slot: e.detail.slot && e.detail.slot.id}))")
    return ctx, pg, erros

def js(pg, s, *a): return pg.evaluate(s, *a) if a else pg.evaluate(s)
def tela(pg): return js(pg, "document.documentElement.getAttribute('data-tela')")
def foco(pg): return js(pg, "(()=>{const a=document.activeElement;return a?(a.id||a.getAttribute('data-px')||a.getAttribute('data-er')||a.className||a.tagName):''})()")
def txt(pg, sel): return js(pg, f"(()=>{{const n=document.querySelector({sel!r});return n?n.textContent.trim():''}})()")
def vis(pg, sel): return js(pg, f"(()=>{{const n=document.querySelector({sel!r});return !!n&&n.getClientRects().length>0&&getComputedStyle(n).visibility!=='hidden'}})()")
def visivel_primeiro(pg, sel):
    return js(pg, f"(()=>{{const l=[...document.querySelectorAll({sel!r})].filter(n=>n.getClientRects().length>0);return l.length}})()")
def clicar(pg, sel):
    pg.locator(sel).filter(visible=True).first.click()
def lateral(pg, w, onde):
    sw = js(pg, "document.documentElement.scrollWidth")
    check(sw <= w, f"[{w}] sem rolagem lateral ({onde}): {sw}")
def anims(pg): return js(pg, "document.getAnimations().filter(a => !(a instanceof CSSTransition)).length")  # transições de 0,01 ms do núcleo (reduzir movimento) não contam
def cap(pg, nome, full=False):
    if not CAP: return
    if full:
        w = pg.viewport_size["width"]; h0 = pg.viewport_size["height"]
        alt = js(pg, "Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)")
        pg.set_viewport_size({"width": w, "height": max(h0, alt)}); pg.wait_for_timeout(250)
        pg.screenshot(path=str(OUT / f"{nome}.png"))
        pg.set_viewport_size({"width": w, "height": h0}); pg.wait_for_timeout(100)
    else:
        pg.screenshot(path=str(OUT / f"{nome}.png"))
def quadros(pg, nome, tempos):
    """congela a passagem em tempos exatos (ms) e captura cada quadro"""
    for t in tempos:
        js(pg, "t => document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; })", t)
        pg.screenshot(path=str(OUT / f"{nome}-{t:03d}.png"))
    js(pg, "document.getAnimations().forEach(a => a.finish())")
def fim_erros(erros, w, nome):
    check(not erros, f"[{w}] {nome}: console sem erros {erros[:3]}")

def roda(nome): return SO is None or nome in SO

# ---------------------------------------------------------------- Pix
def pix(b, w):
    print(f"\n== Pix {w}px")
    ctx, pg, erros = nova(b, w)
    js(pg, "DeoCK.exemplo(3)")
    clicar(pg, "#btn-pagar")
    check(txt(pg, "#btn-pagar-tx") == "Gerando o seu Pix…", f"[{w}] botão mostra 'Gerando o seu Pix…'")
    check(tela(pg) == "checkout", f"[{w}] ainda no checkout durante a espera")
    pg.wait_for_timeout(950)
    check(tela(pg) == "pix", f"[{w}] tela do Pix abriu depois de ~0,8 s")
    check(foco(pg) == "px-titulo", f"[{w}] foco no título do Pix ({foco(pg)})")
    check(not vis(pg, "#form") and not vis(pg, "#pedido") and not vis(pg, "#fluxo>.progresso"), f"[{w}] checkout escondido (etapas, resumo, indicador)")
    check(visivel_primeiro(pg, ".etapa-acoes") == 0, f"[{w}] rodapé fixo escondido")
    check("EXEMPLO" in txt(pg, ".px-codigo-tx"), f"[{w}] código fictício com EXEMPLO")
    check(re.match(r"Vale até \d\d:\d\d", txt(pg, ".px-tempo")) is not None and re.search(r"faltam (30:00|29:\d\d)", txt(pg, ".px-tempo")) is not None, f"[{w}] validade: {txt(pg, '.px-tempo')}")
    check(js(pg, "DeoCK.estado.pagando") is True, f"[{w}] pagamento continua ocupado na tela do Pix")
    lateral(pg, w, "Pix")
    cap(pg, f"pix-{w}")
    # copiar
    clicar(pg, ".px-copiar"); pg.wait_for_timeout(250)
    feito = js(pg, "!!document.querySelector('.px-copiar.px-feito')")
    falhou = js(pg, "!!document.querySelector('.px-aviso.px-falhou')")
    check(feito or falhou, f"[{w}] copiar responde (copiado={feito}, falhou={falhou})")
    if feito:
        check(txt(pg, ".px-copiar .px-copiar-tx") == "Código copiado", f"[{w}] botão vira 'Código copiado'")
        check(vis(pg, ".px-aviso") and "Copiado!" in txt(pg, ".px-aviso"), f"[{w}] aviso verde com o próximo passo")
        check(js(pg, "getComputedStyle(document.querySelector('.px-copiar.px-feito')).backgroundColor") == "rgb(46, 125, 79)", f"[{w}] botão copiado verde")
        if w < 1024: check(not vis(pg, ".px-dica"), f"[{w}] dica sai depois de copiar")
        lido = js(pg, "navigator.clipboard.readText().catch(()=> '')")
        check("EXEMPLO" in (lido or ""), f"[{w}] área de transferência recebeu o código")
    cap(pg, f"pix-copiado-{w}")
    lateral(pg, w, "Pix copiado")
    if w < 1024:
        clicar(pg, '[data-px="qr"]')
        check(js(pg, "document.querySelector('[data-px=qr]').getAttribute('aria-expanded')") == "true" and vis(pg, ".px-qr-fig"), f"[{w}] QR abre (aria-expanded)")
        clicar(pg, '[data-px="passos"]')
        check(vis(pg, ".px-lista.px-so-cel"), f"[{w}] passo a passo abre")
        lateral(pg, w, "Pix com QR e passos")
        cap(pg, f"pix-aberto-{w}", full=True)
        clicar(pg, '[data-px="qr"]'); clicar(pg, '[data-px="passos"]')
        check(not vis(pg, ".px-qr-fig"), f"[{w}] QR fecha")
    else:
        check(vis(pg, ".px-qr-fig") and vis(pg, ".px-lista.px-so-pc") and not vis(pg, '[data-px="qr"]'), f"[{w}] computador: QR e passo a passo à vista, sem botões de abrir")
    # validade: 5 minutos finais
    js(pg, "DeoCK.px.faltam(4.9)"); pg.wait_for_timeout(150)
    check(js(pg, "!!document.querySelector('.px-tempo.px-pouco')"), f"[{w}] validade fica rosa nos 5 minutos finais")
    check("5 minutos" in txt(pg, "#px-sr"), f"[{w}] leitor de tela avisa 5 minutos ({txt(pg, '#px-sr')})")
    check(js(pg, "getComputedStyle(document.querySelector('.px-tempo')).backgroundColor") == "rgb(243, 221, 227)", f"[{w}] validade em blush")
    pg.evaluate("window.scrollTo(0,0)"); cap(pg, f"pix-pouco-{w}")
    # vencido
    js(pg, "DeoCK.px.vencer()"); pg.wait_for_timeout(150)
    check(js(pg, "DeoCK.px.estado()") == "vencido", f"[{w}] estado vencido")
    check(foco(pg) == "px-vencido-t", f"[{w}] foco no aviso de vencido ({foco(pg)})")
    check(not vis(pg, ".px-cartao") and vis(pg, ".px-vencido"), f"[{w}] código e QR somem; aviso aparece")
    check(txt(pg, "#px-vencido-t") == "O código Pix venceu", f"[{w}] título do vencido")
    check(txt(pg, "#px-vencido-d") == "O tempo para pagar acabou e nada foi cobrado. Gere um novo código para pagar os mesmos R$\u00a0159,70.", f"[{w}] texto do vencido: {txt(pg, '#px-vencido-d')}")
    check("Já pagou este código? Não pague de novo" in txt(pg, ".px-vencido .er-dica"), f"[{w}] dica 'Já pagou este código?'")
    check(not vis(pg, ".px-trocar") and visivel_primeiro(pg, '[data-px="aprovar"]') == 0, f"[{w}] trocar e simular somem no vencido")
    lateral(pg, w, "Pix vencido")
    pg.evaluate("window.scrollTo(0,0)"); cap(pg, f"pix-vencido-{w}")
    codigo1 = txt(pg, ".px-codigo-tx")
    clicar(pg, '[data-px="novo"]'); pg.wait_for_timeout(150)
    check(js(pg, "DeoCK.px.estado()") == "aguardando" and txt(pg, ".px-codigo-tx") != codigo1, f"[{w}] novo código gerado")
    check(foco(pg) == "copiar", f"[{w}] foco no botão de copiar depois do novo código ({foco(pg)})")
    check(not js(pg, "!!document.querySelector('.px-tempo.px-pouco')") and re.search(r"faltam (30:00|29:\d\d)", txt(pg, ".px-tempo")) is not None, f"[{w}] validade reiniciada")
    pg.wait_for_timeout(100)
    check("Novo código Pix pronto" in txt(pg, "#px-sr"), f"[{w}] leitor de tela: novo código")
    js(pg, "DeoCK.px.falhou()")
    check(vis(pg, ".px-aviso.px-falhou") and js(pg, "getSelection().toString().includes('EXEMPLO')"), f"[{w}] cópia que falha: aviso e código selecionado")
    pg.wait_for_timeout(100)
    cap(pg, f"pix-falhou-{w}")
    # trocar forma: pergunta, Esc, já paguei, voltar do navegador
    clicar(pg, ".px-trocar"); pg.wait_for_timeout(100)
    check(js(pg, "document.querySelector('.px-troca').classList.contains('px-aberto')") and foco(pg) == "px-troca-t", f"[{w}] pergunta 'Ainda não pagou o Pix?' abre com foco")
    lateral(pg, w, "troca aberta")
    cap(pg, f"pix-troca-{w}")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(50)
    check(not js(pg, "document.querySelector('.px-troca').classList.contains('px-aberto')") and foco(pg) == "trocar", f"[{w}] Esc fecha a pergunta e o foco volta ao link")
    clicar(pg, ".px-trocar"); clicar(pg, '[data-px="troca-nao"]')
    check(not js(pg, "document.querySelector('.px-troca').classList.contains('px-aberto')") and tela(pg) == "pix", f"[{w}] 'Já paguei, vou esperar' fica no Pix")
    js(pg, "history.back()"); pg.wait_for_timeout(250)
    check(tela(pg) == "pix" and js(pg, "document.querySelector('.px-troca').classList.contains('px-aberto')"), f"[{w}] voltar do navegador pergunta antes de sair")
    clicar(pg, '[data-px="troca-nao"]'); pg.wait_for_timeout(50)
    check(js(pg, "history.state && history.state.deo") == "pix", f"[{w}] esperar devolve a entrada do histórico")
    # Não paguei, quero trocar
    clicar(pg, ".px-trocar"); clicar(pg, '[data-px="troca-sim"]'); pg.wait_for_timeout(400)
    check(tela(pg) == "checkout" and js(pg, "DeoCK.estado.atual") == 3, f"[{w}] volta para a etapa 3")
    check(foco(pg) == "t3", f"[{w}] foco no título da etapa 3 ({foco(pg)})")
    check(js(pg, "DeoCK.estado.pagando") is False and txt(pg, "#btn-pagar-tx") == "Pagar R$\u00a0159,70 com Pix", f"[{w}] botão livre: {txt(pg, '#btn-pagar-tx')}")
    check(js(pg, "!document.getElementById('px')"), f"[{w}] tela do Pix desmontada")
    check(js(pg, "!(history.state && history.state.deo)"), f"[{w}] histórico limpo depois de trocar")
    pg.wait_for_timeout(500)
    t3 = js(pg, "document.getElementById('t3').getBoundingClientRect().top")
    check(0 <= t3 < js(pg, "innerHeight") * 0.6, f"[{w}] etapa 3 à vista depois de trocar (título em {t3:.0f})")
    check(js(pg, "history.scrollRestoration") == "auto", f"[{w}] rolagem do histórico volta ao normal")
    lateral(pg, w, "de volta à etapa 3")
    # Pix vencido → Pagar com cartão
    clicar(pg, "#btn-pagar"); pg.wait_for_timeout(950)
    js(pg, "DeoCK.px.vencer()")
    clicar(pg, '[data-px="cartao"]'); pg.wait_for_timeout(400)
    check(tela(pg) == "checkout" and js(pg, "document.querySelector('input[name=pag]:checked').value") == "cartao", f"[{w}] 'Pagar com cartão' volta com o cartão escolhido")
    check(foco(pg) == "cc-num" and js(pg, "DeoCK.estado.pagando") is False, f"[{w}] foco no número do cartão e botão livre ({foco(pg)})")
    # Pix recebido → confirmação com movimento
    js(pg, "DeoCK.preencher({pag:'pix'})")
    clicar(pg, "#btn-pagar"); pg.wait_for_timeout(950)
    pg.evaluate("window.scrollTo(0, 400)")
    clicar(pg, '[data-px="aprovar"]')
    check(tela(pg) == "confirmacao", f"[{w}] Pix recebido → confirmação")
    check(foco(pg) == "ok-t", f"[{w}] foco no título da confirmação ({foco(pg)})")
    check(js(pg, "document.title") == "Pedido confirmado · DeoBeauty", f"[{w}] título da aba")
    check(js(pg, "__aprov.length===1 && __aprov[0].forma==='pix' && __aprov[0].slot==='ok-slot'"), f"[{w}] evento deo:aprovado com info e slot")
    n = anims(pg)
    check(n > 0 and js(pg, "!!document.querySelector('.mv-voo .mv-copia')"), f"[{w}] movimento d7 B toca ({n} animações, cópia inerte)")
    check(js(pg, "document.querySelector('.mv-voo').inert && document.querySelector('.mv-voo').getAttribute('aria-hidden')==='true' && getComputedStyle(document.querySelector('.mv-voo')).pointerEvents==='none'"), f"[{w}] cópia inerte, fora do leitor e sem toque")
    check(js(pg, "!document.querySelector('.mv-voo [id]')"), f"[{w}] cópia sem ids")
    fim = js(pg, "Math.max(...document.getAnimations().map(a=>a.effect.getComputedTiming().endTime))")
    leg = js(pg, "Math.max(...document.getAnimations().filter(a=>!a.effect.target.classList.contains('mv-anel')).map(a=>a.effect.getComputedTiming().endTime))")
    check(fim <= 680 and leg <= 440, f"[{w}] tudo legível em {leg:.0f} ms e parado em {fim:.0f} ms")
    props = js(pg, "[...new Set(document.getAnimations().flatMap(a=>a.effect.getKeyframes().flatMap(k=>Object.keys(k).filter(p=>!['offset','easing','composite','computedOffset'].includes(p)))))]")
    check(set(props) <= {"opacity", "transform"}, f"[{w}] só transform e opacity: {props}")
    pg.wait_for_timeout(800)
    check(anims(pg) == 0 and js(pg, "!document.querySelector('.mv-voo,.mv-voando,.mv-cor,.mv-veu')"), f"[{w}] passagem termina e limpa tudo")
    check("Amadeirado" not in txt(pg, "#ok") and "Floral" not in txt(pg, "#ok"), f"[{w}] sem família olfativa (d6 A)")
    check("Pix de R$\u00a0159,70" in txt(pg, ".ok-passo") and txt(pg, ".ok-pago") == "Pago no Pix", f"[{w}] forma de pagamento real (Pix)")
    check(js(pg, "document.querySelector('.ok-acoes [data-loja]').textContent") == "Voltar à loja", f"[{w}] 'Voltar à loja' com data-loja")
    check(js(pg, "document.querySelector('#ok-slot').children.length===0 && getComputedStyle(document.querySelector('#ok-slot')).display==='none'"), f"[{w}] slot vazio e escondido")
    check(not vis(pg, "#form") and not vis(pg, "#pedido") and not vis(pg, ".topo-seg"), f"[{w}] checkout escondido na confirmação")
    lateral(pg, w, "confirmação Pix")
    cap(pg, f"ok-pix-{w}", full=True)
    # sair da confirmação devolve título da aba e botão
    js(pg, "DeoCK.tela('loja')")
    check(js(pg, "document.title") == "Checkout Rápido DeoBeauty" and js(pg, "DeoCK.estado.pagando") is False, f"[{w}] ao sair da confirmação: aba e botão voltam")
    fim_erros(erros, w, "Pix")
    ctx.close()

# ---------------------------------------------------------------- Pix: teclado
def teclado(b, w):
    print(f"\n== teclado {w}px")
    ctx, pg, erros = nova(b, w)
    kb = pg.keyboard
    js(pg, "DeoCK.exemplo(3)")
    pg.focus("#cpf"); kb.press("Enter"); pg.wait_for_timeout(950)
    check(tela(pg) == "pix" and foco(pg) == "px-titulo", f"[{w}] Enter no CPF paga com Pix e abre a tela")
    ordem = []
    for _ in range(6):
        kb.press("Tab"); ordem.append(foco(pg))
    print("   ordem do Tab:", ordem)
    if w < 1024:
        check(ordem[:5] == ["copiar", "passos", "qr", "trocar", "aprovar"], f"[{w}] Tab segue a ordem visual")
    else:
        check(ordem[:3] == ["copiar", "aprovar", "trocar"], f"[{w}] Tab segue a ordem visual")
    pg.focus(".px-trocar"); kb.press("Enter"); pg.wait_for_timeout(80)
    check(foco(pg) == "px-troca-t", f"[{w}] Enter abre a pergunta")
    kb.press("Tab"); check(foco(pg) == "troca-sim", f"[{w}] Tab vai para 'Não paguei, quero trocar'")
    kb.press("Tab"); check(foco(pg) == "troca-nao", f"[{w}] Tab vai para 'Já paguei, vou esperar'")
    kb.press("Escape"); check(foco(pg) == "trocar", f"[{w}] Esc fecha e devolve o foco")
    js(pg, "DeoCK.px.vencer()")
    kb.press("Tab"); check(foco(pg) == "novo", f"[{w}] no vencido, Tab vai para 'Gerar novo código Pix'")
    kb.press("Enter"); pg.wait_for_timeout(80)
    check(js(pg, "DeoCK.px.estado()") == "aguardando" and foco(pg) == "copiar", f"[{w}] Enter gera novo código e foca o copiar")
    kb.press("Enter"); pg.wait_for_timeout(200)
    check(js(pg, "!!document.querySelector('.px-copiar.px-feito, .px-aviso.px-falhou')"), f"[{w}] Enter copia")
    pg.focus('.px-demo:not([hidden])' if w >= 1024 else '.px-demo.px-so-cel'); kb.press("Enter")
    check(tela(pg) == "confirmacao" and foco(pg) == "ok-t", f"[{w}] Enter em 'Simular Pix recebido' confirma, foco no título")
    kb.press("Tab"); check(js(pg, "document.activeElement.hasAttribute('data-loja')"), f"[{w}] Tab vai para 'Voltar à loja'")
    # recusa pelo teclado
    ctx.close(); ctx, pg, erros2 = nova(b, w); kb = pg.keyboard
    js(pg, "DeoCK.er.recusar()"); pg.wait_for_timeout(1350)
    check(foco(pg) == "er-recusa-t", f"[{w}] recusa: foco no título do aviso ({foco(pg)})")
    kb.press("Tab"); check(foco(pg) == "pix", f"[{w}] Tab vai para 'Pagar … com Pix'")
    kb.press("Tab"); check(foco(pg) == "cartao", f"[{w}] Tab vai para 'Usar outro cartão'")
    kb.press("Enter"); pg.wait_for_timeout(100)
    check(foco(pg) == "cc-num", f"[{w}] Enter em 'Usar outro cartão' foca o número")
    pg.focus('[data-er="pix"]'); kb.press("Enter"); pg.wait_for_timeout(950)
    check(tela(pg) == "pix" and js(pg, "!document.getElementById('er-recusa')"), f"[{w}] Enter em 'Pagar com Pix' abre o Pix e o aviso sai")
    fim_erros(erros + erros2, w, "teclado")
    ctx.close()

# ---------------------------------------------------------------- cartão
def cartao(b, w):
    print(f"\n== cartão 3x {w}px")
    ctx, pg, erros = nova(b, w)
    js(pg, "DeoCK.exemplo(3,{pag:'cartao'})")
    check(txt(pg, "#btn-pagar-tx") == "Pagar 3x de R$\u00a053,23 no cartão", f"[{w}] botão 3x")
    pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    clicar(pg, "#btn-pagar")
    check(txt(pg, "#btn-pagar-tx") == "Confirmando com o banco…", f"[{w}] 'Confirmando com o banco…'")
    pg.wait_for_timeout(1000)
    check(tela(pg) == "checkout", f"[{w}] ainda esperando o banco em 1 s")
    pg.wait_for_function("document.documentElement.getAttribute('data-tela')==='confirmacao'", timeout=1500)
    if CAP: quadros(pg, f"mv-cartao-{w}", [0, 45, 120, 220, 330, 440])
    else: js(pg, "document.getAnimations().forEach(a => a.finish())")
    check(foco(pg) == "ok-t", f"[{w}] foco no título")
    p1 = txt(pg, ".ok-passo")
    check("3x de R$\u00a053,23 no cartão" in p1, f"[{w}] passo 1: {p1}")
    check(txt(pg, ".ok-pago") == "Pago no cartão Visa final\u00a01111, 3x de R$\u00a053,23 sem\u00a0juros", f"[{w}] {txt(pg, '.ok-pago')}")
    check(vis(pg, ".ok-nota"), f"[{w}] nota da fatura no cartão")
    pg.wait_for_timeout(300)
    lateral(pg, w, "confirmação cartão")
    cap(pg, f"ok-cartao-{w}", full=True)
    fim_erros(erros, w, "cartão")
    ctx.close()

# ---------------------------------------------------------------- recusa 0002 → Pix → aprovado
def recusa(b, w):
    print(f"\n== recusa 0002 {w}px")
    ctx, pg, erros = nova(b, w)
    js(pg, "DeoCK.er.recusar()")
    check(txt(pg, "#btn-pagar-tx") == "Confirmando com o banco…", f"[{w}] 'Confirmando com o banco…'")
    pg.wait_for_timeout(1350)
    check(tela(pg) == "checkout" and vis(pg, "#slot-pagamento-topo #er-recusa"), f"[{w}] aviso no começo da etapa 3")
    check(txt(pg, "#er-recusa-t") == "O banco não aprovou o pagamento", f"[{w}] título")
    check(txt(pg, "#er-recusa-d") == "Nada foi cobrado no cartão final\u00a00002 e seus dados continuam aqui.", f"[{w}] texto: {txt(pg, '#er-recusa-d')}")
    check(txt(pg, '[data-er="pix"]') == "Pagar R$\u00a0159,70 com Pix" and txt(pg, '[data-er="cartao"]') == "Usar outro cartão", f"[{w}] botões")
    check(txt(pg, "#er-recusa .er-dica") == "Liberou a compra no app do banco? É só pagar de novo.", f"[{w}] dica")
    check(foco(pg) == "er-recusa-t", f"[{w}] foco no título do aviso")
    check(js(pg, "document.getElementById('cc-num').value").endswith("0002") and js(pg, "document.getElementById('cc-cvv').value") != "", f"[{w}] dados do cartão ficam na recusa")
    check(js(pg, "document.getElementById('cc-nome').value") != "" and js(pg, "document.getElementById('cpf').value") != "", f"[{w}] nome no cartão e CPF ficam")
    check(js(pg, "DeoCK.estado.pagando") is False and txt(pg, "#btn-pagar-tx") == "Pagar 3x de R$\u00a053,23 no cartão", f"[{w}] botão livre")
    pg.wait_for_timeout(700)
    topo = js(pg, "document.getElementById('er-recusa').getBoundingClientRect().top")
    check(0 <= topo < 360, f"[{w}] página rolou até o aviso (topo {topo:.0f})")
    check(js(pg, "getComputedStyle(document.querySelector('input[value=cartao]').closest('.opcao')).borderColor") != "rgb(180, 35, 24)", f"[{w}] opção do cartão não fica vermelha")
    lateral(pg, w, "recusa")
    cap(pg, f"recusa-{w}")
    # outro cartão aprovado: o aviso some
    clicar(pg, '[data-er="cartao"]'); pg.wait_for_timeout(300)
    check(foco(pg) == "cc-num" and vis(pg, "#er-recusa"), f"[{w}] 'Usar outro cartão' foca o número e o aviso fica")
    check(js(pg, "document.getElementById('cc-num').value + document.getElementById('cc-val').value + document.getElementById('cc-cvv').value") == "", f"[{w}] 'Usar outro cartão' limpa número, validade e CVV")
    js(pg, "(()=>{const s=(id,v)=>{const i=document.getElementById(id);i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}))}; s('cc-num','4000 0000 0000 0002'); s('cc-val','08/29'); s('cc-cvv','123')})()")
    clicar(pg, "#btn-pagar"); pg.wait_for_timeout(1350)
    check(vis(pg, "#er-recusa") and js(pg, "document.querySelectorAll('#er-recusa').length") == 1 and foco(pg) == "er-recusa-t", f"[{w}] segunda recusa troca o aviso (um só) e foca de novo")
    # → Pix → aprovado
    clicar(pg, '[data-er="pix"]')
    check(txt(pg, "#btn-pagar-tx") == "Gerando o seu Pix…", f"[{w}] aviso → 'Gerando o seu Pix…'")
    pg.wait_for_timeout(950)
    check(tela(pg) == "pix" and js(pg, "!document.getElementById('er-recusa')"), f"[{w}] Pix abre e o aviso some")
    clicar(pg, '[data-px="aprovar"]')
    pg.wait_for_timeout(800)
    check(tela(pg) == "confirmacao" and txt(pg, ".ok-pago") == "Pago no Pix", f"[{w}] recusa → Pix → aprovado")
    lateral(pg, w, "confirmação depois da recusa")
    # outro caminho: recusa → outro cartão aprovado
    ctx.close(); ctx, pg, erros2 = nova(b, w)
    js(pg, "DeoCK.er.agora()")
    js(pg, "(()=>{const s=(id,v)=>{const i=document.getElementById(id);i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}))}; s('cc-num','5555 5555 5555 4444'); s('cc-val','08/29'); s('cc-cvv','123')})()")
    clicar(pg, "#btn-pagar"); pg.wait_for_timeout(1350)
    check(tela(pg) == "confirmacao" and js(pg, "!document.getElementById('er-recusa')"), f"[{w}] recusa → outro cartão aprovado, aviso some")
    check("Mastercard final\u00a04444" in txt(pg, ".ok-pago"), f"[{w}] {txt(pg, '.ok-pago')}")
    if w < 1024:
        # recusa com o painel do resumo aberto: o painel fecha e o foco chega ao aviso
        ctx2, pg2, erros3 = nova(b, w)
        js(pg2, "DeoCK.exemplo(3,{pag:'cartao'})")
        js(pg2, "(()=>{const i=document.getElementById('cc-num');i.value='4000 0000 0000 0002';i.dispatchEvent(new Event('input',{bubbles:true}))})()")
        js(pg2, "DeoCK.resumo(true)"); clicar(pg2, "#btn-pagar"); pg2.wait_for_timeout(1350)
        check(js(pg2, "document.getElementById('pedido').classList.contains('recolhido')") and foco(pg2) == "er-recusa-t", f"[{w}] recusa com o resumo aberto: painel fecha, foco no aviso ({foco(pg2)})")
        erros2 += erros3; ctx2.close()
    fim_erros(erros + erros2, w, "recusa")
    ctx.close()

# ---------------------------------------------------------------- carteira
def carteira(b, w):
    print(f"\n== carteira {w}px")
    ctx, pg, erros = nova(b, w)
    js(pg, "DeoCK.exemplo(3,{pag:'carteira'})")
    nome = "Apple Pay" if w < 768 else "Google Pay"
    pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    clicar(pg, "#btn-carteira")
    check(txt(pg, "#btn-carteira") == f"Abrindo o {nome}…", f"[{w}] '{txt(pg, '#btn-carteira')}'")
    pg.wait_for_function("document.documentElement.getAttribute('data-tela')==='confirmacao'", timeout=1600)
    if CAP: quadros(pg, f"mv-carteira-{w}", [0, 60, 150, 300, 440])
    else: js(pg, "document.getAnimations().forEach(a => a.finish())")
    check(f"R$\u00a0159,70 com {nome}" in txt(pg, ".ok-passo") and txt(pg, ".ok-pago") == f"Pago com {nome}", f"[{w}] carteira na confirmação")
    check(not vis(pg, ".ok-nota"), f"[{w}] sem nota de fatura na carteira")
    lateral(pg, w, "confirmação carteira")
    cap(pg, f"ok-carteira-{w}")
    fim_erros(erros, w, "carteira")
    ctx.close()

# ---------------------------------------------------------------- reduzir movimento e aba escondida
def calmo(b, w):
    print(f"\n== reduzir movimento {w}px")
    ctx, pg, erros = nova(b, w, reduce=True)
    js(pg, "DeoCK.px.exemplo()")
    check(anims(pg) == 0, f"[{w}] pontinho parado (sem pulso)")
    js(pg, "DeoCK.px.aprovar()")
    check(tela(pg) == "confirmacao" and anims(pg) == 0 and js(pg, "!document.querySelector('.mv-voo')"), f"[{w}] troca imediata, sem animação")
    check(foco(pg) == "ok-t", f"[{w}] foco no título")
    ctx.close(); ctx, pg, erros2 = nova(b, w, reduce=True)
    js(pg, "DeoCK.exemplo(3,{pag:'cartao'})"); clicar(pg, "#btn-pagar")
    pg.wait_for_function("document.documentElement.getAttribute('data-tela')==='confirmacao'", timeout=1600)
    check(anims(pg) == 0, f"[{w}] cartão: troca imediata")
    fim_erros(erros + erros2, w, "reduzir movimento")
    ctx.close()

def escondida(b, w):
    print(f"\n== aba escondida {w}px")
    ctx, pg, erros = nova(b, w)
    js(pg, "DeoCK.px.exemplo()")
    js(pg, """(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
      Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});
      document.dispatchEvent(new Event('visibilitychange'));})()""")
    js(pg, "DeoCK.px.aprovar()")
    check(tela(pg) == "confirmacao" and foco(pg) == "ok-t", f"[{w}] aprovação com a aba escondida troca a tela")
    check(anims(pg) == 0 and js(pg, "DeoCK.mv.pendente()") is True, f"[{w}] movimento espera a pessoa voltar")
    js(pg, """(()=>{delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange'));})()""")
    check(anims(pg) > 0 and js(pg, "DeoCK.mv.pendente()") is False, f"[{w}] ao voltar, o movimento toca uma vez ({anims(pg)})")
    pg.wait_for_timeout(800)
    check(anims(pg) == 0 and js(pg, "!document.querySelector('.mv-voo')"), f"[{w}] e para")
    js(pg, "document.dispatchEvent(new Event('visibilitychange'))")
    check(anims(pg) == 0, f"[{w}] não toca de novo")
    fim_erros(erros, w, "aba escondida")
    ctx.close()

# ---------------------------------------------------------------- extras: espera interrompida, volta ao checkout com Pix aberto, modo página
def extras(b, w):
    print(f"\n== extras {w}px")
    ctx, pg, erros = nova(b, w)
    js(pg, "DeoCK.exemplo(3)")
    clicar(pg, "#btn-pagar"); js(pg, "document.querySelector('#feita-1 .feita-alt').click()")
    pg.wait_for_timeout(950)
    check(tela(pg) == "checkout" and js(pg, "DeoCK.estado.atual") == 1 and js(pg, "DeoCK.estado.pagando") is False, f"[{w}] 'Alterar' durante a espera cancela o Pix e libera o botão")
    js(pg, "DeoCK.px.exemplo()")
    js(pg, "DeoCK.tela('loja'); DeoCK.abrirCheckout()")
    check(tela(pg) == "pix" and foco(pg) == "px-titulo", f"[{w}] voltar ao checkout com Pix em aberto reabre a tela do Pix")
    ctx.close(); ctx, pg, erros2 = nova(b, w)
    js(pg, "DeoCK.modo('pagina'); DeoCK.exemplo(3)")
    clicar(pg, "#btn-pagar"); pg.wait_for_timeout(950)
    check(tela(pg) == "pix" and not vis(pg, "#form"), f"[{w}] modo página: Pix abre")
    clicar(pg, ".px-trocar"); clicar(pg, '[data-px="troca-sim"]'); pg.wait_for_timeout(300)
    check(tela(pg) == "checkout" and vis(pg, "#etapa-3"), f"[{w}] modo página: volta")
    js(pg, "DeoCK.er.agora()"); pg.wait_for_timeout(300)
    check(vis(pg, "#er-recusa"), f"[{w}] modo página: aviso de recusa")
    lateral(pg, w, "modo página")
    # outra pessoa recebe + cupom + sem e-mail
    ctx.close(); ctx, pg, erros3 = nova(b, w)
    js(pg, "DeoCK.ok.exemplo({pag:'cartao', recebe:'Ana Beatriz Lima de Albuquerque', cupom:'DEOQUIZ10', email:false})")
    pg.wait_for_timeout(800)
    t = txt(pg, ".ok-linha")
    check("Quem recebe: Ana Beatriz Lima de Albuquerque" in t, f"[{w}] 'Quem recebe' com outra pessoa")
    check("Desconto (DEOQUIZ10)" in txt(pg, ".ok-ped") and not js(pg, "!!document.querySelector('.ok-zap-mail')"), f"[{w}] desconto com cupom; sem e-mail, sem linha do recibo")
    lateral(pg, w, "confirmação outra pessoa")
    cap(pg, f"ok-outra-pessoa-{w}", full=True)
    fim_erros(erros + erros2 + erros3, w, "extras")
    ctx.close()

def mv_pix(b, w):
    print(f"\n== quadros do movimento Pix {w}px")
    ctx, pg, erros = nova(b, w)
    js(pg, "DeoCK.px.exemplo()"); js(pg, "DeoCK.px.copiado()"); pg.wait_for_timeout(300)
    if w < 1024: pg.evaluate("window.scrollTo(0, 260)")
    js(pg, "DeoCK.px.aprovar()")
    check(tela(pg) == "confirmacao", f"[{w}] aprovado")
    quadros(pg, f"mv-pix-{w}", [0, 45, 90, 150, 220, 330, 440, 560])
    fim_erros(erros, w, "quadros Pix")
    ctx.close()

def larguras(b):
    print("\n== larguras 320/375/768/1024/1280")
    for w in (320, 375, 768, 1024, 1280):
        ctx, pg, erros = nova(b, w)
        js(pg, "DeoCK.px.exemplo()"); js(pg, "DeoCK.px.copiado(); DeoCK.px.qr(true); DeoCK.px.passos(true); DeoCK.px.trocar(true)")
        pg.wait_for_timeout(300); lateral(pg, w, "Pix tudo aberto")
        cap(pg, f"larg-pix-{w}", full=True)
        js(pg, "DeoCK.px.vencer()"); lateral(pg, w, "Pix vencido")
        js(pg, "DeoCK.er.agora()"); pg.wait_for_timeout(400); lateral(pg, w, "recusa")
        if w == 320: cap(pg, "larg-recusa-320")
        js(pg, "DeoCK.ok.exemplo({pag:'cartao', recebe:'Ana Lima'})"); pg.wait_for_timeout(800); lateral(pg, w, "confirmação")
        if w in (320, 768): cap(pg, f"larg-ok-{w}", full=True)
        fim_erros(erros, w, "larguras")
        ctx.close()

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w in (375, 1280):
            if roda("pix"): pix(b, w)
            if roda("teclado"): teclado(b, w)
            if roda("cartao"): cartao(b, w)
            if roda("recusa"): recusa(b, w)
            if roda("carteira"): carteira(b, w)
            if roda("calmo"): calmo(b, w)
            if roda("escondida"): escondida(b, w)
            if roda("extras"): extras(b, w)
            if roda("mv") and CAP: mv_pix(b, w)
        if roda("larguras"): larguras(b)
        b.close()
finally:
    comum.parar(httpd)
if CAP: print("capturas em", OUT)
comum.encerrar("qa_pagamento", len(oks), falhas)
