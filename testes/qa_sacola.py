#!/usr/bin/env python3
"""Testes de fluxo da sacola (teclado, foco, leitor de tela, checkout, volta à loja, reduzir movimento).
Uso: python3 testes/qa_sacola.py [--port 8983]   (abre index.html na loja, com a sacola aberta)"""
import argparse
from playwright.sync_api import sync_playwright
import comum

ap = argparse.ArgumentParser(); ap.add_argument("--port", type=int, default=8983); a = ap.parse_args()
comum.inicio("qa_sacola", a.port)
falhas, oks = [], []
def ok(c, msg):
    print(("ok    " if c else "FALHA ") + msg)
    (oks if c else falhas).append(msg)

def pagina(b, w, reduce=False):
    ctx = comum.contexto(b, w, reduce=reduce, dpr=1)
    pg, erros = comum.nova_pagina(ctx)
    comum.abrir(pg, a.port)
    return ctx, pg, erros

ATIVO = "(() => { const n = document.activeElement; return n ? (n.id || n.getAttribute('data-gv') + ':' + (n.getAttribute('data-id')||'')) : '' })()"
def ativo(pg): return pg.evaluate(ATIVO)
def tela(pg): return pg.evaluate("document.documentElement.getAttribute('data-tela')")
def aviso(pg): pg.wait_for_timeout(120); return pg.evaluate("document.getElementById('gv-aviso').textContent.replace(/\\u00a0/g,' ')")
def itens(pg): return pg.evaluate("DeoCK.itens().map(i => i.id + 'x' + i.q).join(',')")
def dentro(pg): return pg.evaluate("document.getElementById('gv-sacola').contains(document.activeElement)")

httpd = comum.servir(a.port)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        # ---------------- celular 375 ----------------
        ctx, pg, erros = pagina(b, 375)
        ok(tela(pg) == "loja", "abre na loja (data-tela=loja)")
        ok(pg.is_visible("#gv-sacola") and pg.evaluate("document.documentElement.classList.contains('gv-aberta')"), "sacola aberta na abertura")
        ok(ativo(pg) == "gv-titulo", f"foco no título da sacola ({ativo(pg)})")
        ok(pg.evaluate("document.getElementById('gv-sacola').getAttribute('aria-modal')") == "true", "role dialog + aria-modal")
        nome = pg.evaluate("(() => { const s = document.getElementById('gv-sacola'); return s.getAttribute('aria-labelledby').split(' ').map(id => document.getElementById(id).textContent).join(' ').replace(/\\u00a0/g,' ') })()")
        ok("Sua sacola" in nome and "2 itens" in nome, f"nome acessível: {nome}")
        ok(pg.evaluate("getComputedStyle(document.getElementById('gv-sacola')).transitionDuration").startswith("0.3"), "celular: sobe em 300 ms")
        # foco preso: 30 Tabs e 30 Shift+Tabs sem sair da sacola
        fora = 0
        for _ in range(30):
            pg.keyboard.press("Tab"); fora += 0 if dentro(pg) else 1
        for _ in range(30):
            pg.keyboard.press("Shift+Tab"); fora += 0 if dentro(pg) else 1
        ok(fora == 0, "Tab e Shift+Tab ficam dentro da sacola")
        # Esc fecha e o foco volta ao ícone
        pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
        ok(not pg.is_visible("#gv-sacola") and ativo(pg) == "gv-icone", f"Esc fecha e o foco volta ao ícone ({ativo(pg)})")
        ok(pg.evaluate("document.getElementById('gv-icone').getAttribute('aria-label')") == "Abrir sacola, 2 itens", "ícone com contador no rótulo")
        ok(pg.inner_text("#gv-icone .gv-conta") == "2", "contador visível no ícone")
        pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
        ok(pg.is_visible("#gv-sacola") and ativo(pg) == "gv-titulo", "Enter no ícone reabre com foco no título")
        # + no body splash
        pg.click('[data-gv="mais"][data-id="sweet-petals-bs"]')
        ok(itens(pg) == "oud-passionx1,sweet-petals-bsx2", f"+ muda a lista do núcleo ({itens(pg)})")
        av = aviso(pg)
        ok("Sweet Petals body splash: 2 unidades. Subtotal R$ 199,70." in av and "Frete grátis liberado" in av, f"leitor de tela: {av}")
        ok(ativo(pg) == "mais:sweet-petals-bs", "foco continua no +")
        ok(pg.evaluate("document.getElementById('v-sub').textContent.replace(/\\u00a0/g,' ')") == "R$ 199,70", "subtotal do checkout acompanha")
        ok("liberado" in pg.inner_text("#gv-meta-tx"), "meta vira frete grátis liberado")
        ok(not pg.query_selector(".gv-completa"), "sem selo 'Completa' depois da meta")
        # − volta para 1 e vira lixeira, mesmo botão com foco
        pg.click('[data-gv="menos"][data-id="sweet-petals-bs"]')
        ok(pg.evaluate("document.activeElement.getAttribute('data-gv')") == "remover", "− com 1 unidade vira lixeira e o foco fica nele")
        av = aviso(pg); ok("1 unidade" in av and "Agora faltam R$ 49,20" in av, f"leitor de tela (−): {av}")
        # remover e desfazer
        pg.click('[data-gv="remover"][data-id="oud-passion"]')
        ok(itens(pg) == "sweet-petals-bsx1", "lixeira tira o item do núcleo")
        ok(ativo(pg) == "desfazer:oud-passion", "foco vai para Desfazer")
        av = aviso(pg); ok("saiu da sacola" in av, f"leitor de tela (saiu): {av}")
        ok(pg.inner_text("#gv-icone .gv-conta") == "1", "contador do ícone acompanha")
        pg.click('[data-gv="desfazer"][data-id="oud-passion"]')
        ok(itens(pg) == "oud-passionx1,sweet-petals-bsx1", "Desfazer devolve no mesmo lugar")
        ok(ativo(pg) == "remover:oud-passion", "foco volta para o item")
        # sugestão
        sugs = pg.evaluate("DeoCK.gv.sugestoes()")
        ok(sugs == ["sweet-petals-hidratante", "sweet-petals-perfume"], f"sugestões da mesma linha: {sugs}")
        ok(pg.locator(".gv-completa").count() == 2, "selo 'Completa os R$ 199' nas duas (as duas alcançam a meta)")
        bb = pg.eval_on_selector('[data-gv="adicionar"][data-id="sweet-petals-hidratante"]', "n => { const r = n.getBoundingClientRect(); return [r.height, r.width] }")
        ok(bb[0] >= 44, f"Adicionar com {bb[0]:.0f} px de altura (+ 2 px de toque em volta = 48)")
        pg.click('[data-gv="adicionar"][data-id="sweet-petals-hidratante"]')
        ok(itens(pg) == "oud-passionx1,sweet-petals-bsx1,sweet-petals-hidratantex1", f"Adicionar põe no núcleo ({itens(pg)})")
        ok(ativo(pg) == "mais:sweet-petals-hidratante", "foco vai para o item novo")
        av = aviso(pg); ok("entrou na sacola" in av and "Frete grátis liberado" in av, f"leitor de tela (entrou): {av}")
        ok(pg.evaluate("DeoCK.gv.sugestoes()") == ["sweet-petals-perfume"], "sobra 1 sugestão")
        # sem linha: só Oud Passion → sem sugestão
        # Finalizar
        pg.click('[data-gv="finalizar"]'); pg.wait_for_timeout(200)
        ok(tela(pg) == "checkout" and ativo(pg) == "t1", f"Finalizar abre o checkout com foco na etapa 1 ({tela(pg)}, {ativo(pg)})")
        ok(not pg.is_visible("#gv-sacola") and not pg.is_visible("#gv-icone"), "sacola e ícone somem no checkout")
        n = pg.evaluate("document.querySelectorAll('#itens .item').length")
        ok(n == 3, f"resumo do checkout com 3 itens ({n})")
        ok(pg.evaluate("document.getElementById('v-sub').textContent.replace(/\\u00a0/g,' ')") == "R$ 199,70", "subtotal do checkout R$ 199,70")
        larg = pg.evaluate("document.documentElement.scrollWidth"); ok(larg <= 375, f"checkout sem rolagem lateral ({larg})")
        # volta à loja pelo logo
        pg.click(".topo a[data-loja]"); pg.wait_for_timeout(400)
        ok(tela(pg) == "loja" and pg.is_visible("#gv-sacola") and ativo(pg) == "gv-titulo", "logo volta à loja com a sacola aberta")
        ok(pg.locator("#gv-itens .gv-item").count() == 3, "a sacola tem os mesmos 3 itens")
        ok(len(pg.context.pages) == 1, "nada abriu em outra aba")
        # Ctrl+clique não é interceptado
        pg.evaluate("DeoCK.gv.finalizar()")
        prev = pg.evaluate("(() => { const a = document.querySelector('.topo a[data-loja]'); const e = new MouseEvent('click', {bubbles:true, cancelable:true, ctrlKey:true}); a.addEventListener('click', ev => ev.preventDefault(), {once:true}); let pre = null; document.addEventListener('click', ev => { pre = ev.defaultPrevented }, {once:true}); a.dispatchEvent(e); return document.documentElement.getAttribute('data-tela') })()")
        ok(prev == "checkout", "Ctrl+clique no logo não troca de tela (abre a loja de verdade)")
        # depois do pedido confirmado: sacola vazia
        pg.evaluate("document.dispatchEvent(new CustomEvent('deo:aprovado', {detail:{}})); DeoCK.tela('confirmacao')")
        pg.click(".topo a[data-loja]"); pg.wait_for_timeout(400)
        ok(pg.is_visible("#gv-vazia") and not pg.is_visible("#gv-pe"), "depois do pedido confirmado a sacola volta vazia")
        ok(not pg.is_visible("#gv-icone .gv-conta"), "ícone sem contador")
        ok(not erros, f"sem erros de console {erros}")
        ctx.close()

        # ---------------- computador 1280 ----------------
        ctx, pg, erros = pagina(b, 1280)
        ok(pg.evaluate("getComputedStyle(document.getElementById('gv-sacola')).transitionDuration").startswith("0.2"), "computador: aparece em 200 ms")
        r = pg.evaluate("(() => { const i = document.getElementById('gv-icone').getBoundingClientRect(), s = document.getElementById('gv-sacola').getBoundingClientRect(); return [i.bottom, s.top, Math.round(i.left + i.width/2), Math.round(s.right - 24)] })()")
        ok(r[1] - r[0] == 8 and abs(r[2] - r[3]) <= 1, f"painel preso ao ícone (8 px abaixo, bico no centro do ícone) {r}")
        # clique no ícone com a sacola aberta fecha (o ícone está inerte e o clique cai no véu)
        pg.mouse.click(r[2], 76); pg.wait_for_timeout(350)
        ok(not pg.is_visible("#gv-sacola"), "clique no ícone com a sacola aberta fecha")
        pg.click("#gv-icone"); pg.wait_for_timeout(300)
        ok(pg.is_visible("#gv-sacola"), "clique no ícone abre")
        pg.mouse.click(200, 500); pg.wait_for_timeout(350)
        ok(not pg.is_visible("#gv-sacola") and ativo(pg) == "gv-icone", "clique no véu fecha e o foco volta ao ícone")
        # alvo de toque do − / + (o ::after estende para 48 px de altura)
        pg.click("#gv-icone"); pg.wait_for_timeout(300)
        hit = pg.evaluate("(() => { const b = document.querySelector('.gv-mais'), r = b.getBoundingClientRect(); const x = r.left + r.width/2; return [document.elementFromPoint(x, r.top - 4) === b, document.elementFromPoint(x, r.bottom + 4) === b, Math.round(r.height)] })()")
        ok(hit[0] and hit[1], f"+ aceita toque 4 px acima e abaixo (altura visível {hit[2]} px)")
        # Oud Passion sozinho: sem sugestão (não tem linha no site)
        pg.evaluate("DeoCK.gv.remover('sweet-petals-bs')")
        ok(pg.evaluate("DeoCK.gv.sugestoes()") == [] and not pg.is_visible("#gv-sug"), "Oud Passion sozinho: sem sugestão")
        larg = pg.evaluate("document.documentElement.scrollWidth"); ok(larg <= 1280, f"sem rolagem lateral ({larg})")
        ok(not erros, f"sem erros de console {erros}")
        ctx.close()

        # ---------------- reduzir movimento ----------------
        ctx, pg, erros = pagina(b, 375, reduce=True)
        ok(pg.evaluate("getComputedStyle(document.getElementById('gv-sacola')).transitionDuration") in ("0s", "1e-05s"), "reduzir movimento: sem transição na sacola")
        pg.keyboard.press("Escape")
        ok(not pg.is_visible("#gv-sacola"), "reduzir movimento: fecha na hora")
        pg.click("#gv-icone")
        ok(pg.is_visible("#gv-sacola") and ativo(pg) == "gv-titulo", "reduzir movimento: abre na hora, foco no título")
        tr = pg.evaluate("getComputedStyle(document.getElementById('gv-barra')).transitionDuration")
        ok(tr in ("0s", "1e-05s"), f"reduzir movimento: trilho sem transição ({tr})")
        pg.evaluate("DeoCK.gv.adicionar()")
        an = pg.evaluate("getComputedStyle(document.querySelector('.gv-entra') || document.body).animationName")
        ok(an == "none", f"reduzir movimento: item novo sem animação ({an})")
        ok(not erros, f"sem erros de console {erros}")
        ctx.close()

        # ---------------- sem movimento reduzido: tempos ----------------
        ctx, pg, erros = pagina(b, 375)
        tr = pg.evaluate("getComputedStyle(document.getElementById('gv-barra')).transitionDuration")
        ok(tr == "0.42s", f"meta cresce em 420 ms ({tr})")
        pg.evaluate("DeoCK.gv.adicionar()")
        an = pg.evaluate("[getComputedStyle(document.querySelector('.gv-entra')).animationDuration, getComputedStyle(document.querySelector('.gv-entra'), '::before').animationDuration]")
        ok(an == ["0.28s", "0.45s"], f"item novo: 280 ms + brilho 450 ms ({an})")
        ok(not erros, f"sem erros de console {erros}")
        ctx.close()
        b.close()
finally:
    comum.parar(httpd)
print("\n" + ("TUDO OK" if not falhas else f"{len(falhas)} FALHA(S)"))
comum.encerrar("qa_sacola", len(oks), falhas)
