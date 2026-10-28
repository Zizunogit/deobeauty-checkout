#!/usr/bin/env python3
"""QA da v3.1 · "Simular nova compra (só no protótipo)" na confirmação.

Uso: python3 testes/qa_nova.py [--out pasta] [--port 8781]
Roda em 375 e 1280 (e 1280 com movimento reduzido, 320 e 768): Pix → confirmação → nova compra → cartão com "Lembrar"
→ nova compra abre no "Oi de novo" → carteira; cupom e sacola mexida voltam ao exemplo. Imprime falhas e capturas
(saida-testes/qa_nova/).
"""
import argparse
from playwright.sync_api import sync_playwright
import comum

ap = argparse.ArgumentParser()
ap.add_argument("--out", default=None)
ap.add_argument("--port", type=int, default=8781)
a = ap.parse_args()
out = comum.saida("qa_nova", a.out)
comum.inicio("qa_nova", a.port)

falhas, ok = [], 0


def check(cond, msg):
    global ok
    if cond:
        ok += 1
    else:
        falhas.append(msg)


httpd = comum.servir(a.port)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w, red in [(375, False), (1280, False), (1280, True), (320, False), (768, False)]:
            tag = f"{w}{'-red' if red else ''}"
            ctx = comum.contexto(b, w, reduce=red)
            pg, erros = comum.nova_pagina(ctx)
            comum.abrir(pg, a.port)
            pg.evaluate("try{localStorage.clear()}catch(e){}")
            ev = pg.evaluate
            titulo0 = ev("document.title")

            def lateral(onde):
                sw = ev("document.documentElement.scrollWidth")
                check(sw <= w, f"[{tag}] rolagem lateral em {onde}: {sw}")

            def confirmar(onde):
                pg.wait_for_function("document.documentElement.getAttribute('data-tela')==='confirmacao'", timeout=8000)
                pg.wait_for_timeout(800)
                bt = pg.locator('[data-ok="nova"]')
                check(bt.count() == 1 and bt.is_visible(), f"[{tag}] {onde}: botão de nova compra não aparece")
                check(bt.inner_text().replace("\n", " ").strip() == "Simular nova compra (só no protótipo)",
                      f"[{tag}] {onde}: texto do botão: {bt.inner_text()!r}")
                bx = bt.bounding_box()
                check(bx and bx["height"] >= 48, f"[{tag}] {onde}: botão com menos de 48 px: {bx}")
                st = ev("""(()=>{const b=document.querySelector('[data-ok="nova"]'),s=getComputedStyle(b);
                  return {bs:s.borderTopStyle,r:s.borderTopLeftRadius,fs:s.fontSize}})()""")
                check(st["bs"] == "dashed" and st["fs"] == "14px", f"[{tag}] {onde}: desenho diferente do Pix: {st}")
                # mesma aparência do "Simular Pix recebido": fica abaixo das ações
                ac = pg.locator(".ok-acoes").bounding_box()
                check(bx["y"] >= ac["y"] + ac["height"] - 1, f"[{tag}] {onde}: botão não fica abaixo das ações")
                lateral(onde)

            def nova(onde):
                pg.locator('[data-ok="nova"]').scroll_into_view_if_needed()
                pg.locator('[data-ok="nova"]').click()
                pg.wait_for_timeout(700)
                r = ev("""(()=>({tela:document.documentElement.getAttribute('data-tela'),
                  aberta:document.documentElement.classList.contains('gv-aberta'),
                  itens:DeoCK.itens().map(i=>i.id+':'+i.q).join(','), ok:!!document.getElementById('ok'),
                  foco:document.activeElement&&document.activeElement.id, feito:JSON.stringify(DeoCK.estado.feito),
                  atual:DeoCK.estado.atual, nome:document.getElementById('nome').value, cpf:document.getElementById('cpf').value,
                  cupom:DeoCK.pedido().cupom||'', busy:document.getElementById('btn-pagar').getAttribute('aria-busy'),
                  vivos:document.querySelectorAll('#gv-itens .gv-item, #gv-itens > li').length, titulo:document.title,
                  y:window.scrollY}))()""")
                check(r["tela"] == "loja", f"[{tag}] {onde}: tela depois da nova compra = {r['tela']}")
                check(r["aberta"], f"[{tag}] {onde}: sacola não abriu")
                check(r["itens"] == "oud-passion:1,sweet-petals-bs:1", f"[{tag}] {onde}: itens = {r['itens']}")
                check(not r["ok"], f"[{tag}] {onde}: confirmação antiga continua na página")
                check(r["foco"] == "gv-titulo", f"[{tag}] {onde}: foco foi para {r['foco']}")
                check(r["feito"] == '{"1":false,"2":false,"3":false}' and r["atual"] == 1, f"[{tag}] {onde}: etapas não zeraram {r}")
                check(r["nome"] == "" and r["cpf"] == "", f"[{tag}] {onde}: campos não zeraram")
                check(r["cupom"] == "", f"[{tag}] {onde}: cupom ficou: {r['cupom']}")
                check(r["busy"] is None, f"[{tag}] {onde}: botão de pagar ficou ocupado")
                check(r["titulo"] == titulo0, f"[{tag}] {onde}: título da aba {r['titulo']!r}")
                check(r["y"] == 0, f"[{tag}] {onde}: página não voltou ao topo ({r['y']})")
                lateral(onde + " (sacola)")
                return r

            # 1) compra com Pix, como a pessoa faria: sacola → finalizar → exemplo → pagar → simular Pix
            pg.locator('[data-gv="finalizar"]').click()
            pg.wait_for_timeout(300)
            ev("DeoCK.exemplo(3)")
            pg.locator("#btn-pagar").click()
            pg.wait_for_function("document.documentElement.getAttribute('data-tela')==='pix'", timeout=5000)
            pg.wait_for_timeout(300)
            pg.locator('[data-px="aprovar"]:visible').first.click()
            confirmar("Pix")
            pg.screenshot(path=str(out / f"1-confirmacao-{tag}.png"), full_page=True)
            pg.locator('[data-ok="nova"]').scroll_into_view_if_needed()
            pg.wait_for_timeout(150)
            pg.screenshot(path=str(out / f"1b-botao-{tag}.png"))
            nova("depois do Pix")
            pg.screenshot(path=str(out / f"2-sacola-{tag}.png"))

            # 2) sacola mexida + cupom + cartão + lembrar meus dados
            ev("DeoCK.gv.remover(1)")
            ev("DeoCK.gv.fechar()")
            ev("DeoCK.gv.abrir()")
            pg.locator('[data-gv="finalizar"]').click()
            pg.wait_for_timeout(300)
            check(ev("DeoCK.itens().length") == 1, f"[{tag}] remover item da sacola não valeu no checkout")
            ev("DeoCK.exemplo(3,{pag:'cartao',cupom:'DEOQUIZ10'})")
            ev("document.getElementById('cv-lembrar').checked=true")
            pg.locator("#btn-pagar").click()
            confirmar("cartão + lembrar")
            check(pg.locator(".cv-fim").count() == 1, f"[{tag}] confirmação sem o aviso de dados lembrados")
            nova("depois do cartão")

            # 3) mesmo aparelho, próxima compra: abre no "Oi de novo" e paga com carteira
            pg.locator('[data-gv="finalizar"]').click()
            pg.wait_for_timeout(500)
            r = ev("""({lemb:document.documentElement.classList.contains('cv-lembrado'), atual:DeoCK.estado.atual,
                       card:!!document.querySelector('.cv-cartao')})""")
            check(r["lemb"] and r["atual"] == 3 and r["card"], f"[{tag}] nova compra não abriu no 'Oi de novo': {r}")
            pg.screenshot(path=str(out / f"3-oi-de-novo-{tag}.png"))
            ev("DeoCK.preencher({pag:'carteira'})")
            pg.locator("#btn-carteira").click() if ev("!!document.getElementById('btn-carteira').getClientRects().length") else pg.locator("#btn-pagar").click()
            confirmar("carteira lembrada")
            nova("depois da carteira")

            # 4) "Voltar à loja" continua como antes: sacola vazia
            pg.locator('[data-gv="finalizar"]').click(); pg.wait_for_timeout(400)
            if ev("document.documentElement.classList.contains('cv-lembrado')"):
                pg.locator(".cv-naosou").click(); pg.wait_for_timeout(200)
                b2 = pg.locator(".cv-naosou-sim, [data-cv='naosou-sim']")
                if b2.count():
                    b2.first.click()
                pg.wait_for_timeout(300)
            ev("DeoCK.cv.esquecer(); DeoCK.ok.exemplo({pag:'pix'})")
            confirmar("exemplo direto")
            pg.locator(".ok-acoes [data-loja]").click(); pg.wait_for_timeout(500)
            check(ev("DeoCK.gv.estado.comprou") is True, f"[{tag}] 'Voltar à loja' deixou de esvaziar a sacola")

            check(not erros, f"[{tag}] erros no console: {erros}")
            ctx.close()
        b.close()
finally:
    comum.parar(httpd)

print("capturas em", out)
comum.encerrar("qa_nova", ok, falhas)
