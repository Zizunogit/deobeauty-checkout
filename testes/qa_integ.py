#!/usr/bin/env python3
"""Fumaça com todos os módulos: loja → checkout → Pix → loja → checkout (Pix reabre)
→ Pix aprovado → confirmação → "Voltar à loja" (sacola vazia).
Uso: python3 testes/qa_integ.py [--port 8984] [--out pasta]   (capturas integ-* em saida-testes/qa_integ/)"""
import argparse
from playwright.sync_api import sync_playwright
import comum

ap = argparse.ArgumentParser(); ap.add_argument("--port", type=int, default=8984); ap.add_argument("--out", default=None)
a = ap.parse_args()
porta = a.port
out = comum.saida("qa_integ", a.out)
comum.inicio("qa_integ", porta)
falhas, oks = [], []
def ok(c, m):
    print(("ok    " if c else "FALHA ") + m)
    (oks if c else falhas).append(m)
httpd = comum.servir(porta)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w in [375, 1280]:
            ctx = comum.contexto(b, w)
            pg, erros = comum.nova_pagina(ctx)
            pg.add_init_script("try{localStorage.clear()}catch(e){}")
            comum.abrir(pg, porta)
            pg.wait_for_timeout(300)
            tela = lambda: pg.evaluate("document.documentElement.getAttribute('data-tela')")
            t = f"[{w}]"
            ok(tela() == "loja" and pg.is_visible("#gv-sacola"), f"{t} abre na loja com a sacola")
            pg.screenshot(path=str(out / f"integ-1-loja-{w}.png"))
            pg.click('[data-gv="adicionar"][data-id="sweet-petals-hidratante"]'); pg.wait_for_timeout(500)
            pg.click('[data-gv="finalizar"]'); pg.wait_for_timeout(400)
            ok(tela() == "checkout" and pg.evaluate("document.activeElement.id") == "t1", f"{t} Finalizar → etapa 1 com foco no título")
            ok(pg.evaluate("document.querySelectorAll('#itens .item').length") == 3, f"{t} resumo com 3 itens")
            pg.screenshot(path=str(out / f"integ-2-etapa1-{w}.png"))
            # paga com Pix
            pg.evaluate("DeoCK.pagarExemplo({pag:'pix'})"); pg.wait_for_timeout(1500)
            ok(tela() == "pix", f"{t} Pix aberto ({tela()})")
            pg.click(".topo a[data-loja]"); pg.wait_for_timeout(500)
            ok(tela() == "loja" and pg.is_visible("#gv-sacola"), f"{t} logo no Pix → loja com a sacola aberta")
            pg.click('[data-gv="finalizar"]'); pg.wait_for_timeout(500)
            ok(tela() == "pix", f"{t} Finalizar com Pix em aberto → Pix reabre (pagamento) ({tela()})")
            # aprova o Pix
            pg.evaluate("DeoCK.px.aprovar()"); pg.wait_for_timeout(1500)
            ok(tela() == "confirmacao", f"{t} confirmação ({tela()})")
            pg.screenshot(path=str(out / f"integ-3-confirmacao-{w}.png"))
            link = pg.query_selector("#ok [data-loja]")
            ok(link is not None, f"{t} confirmação tem link [data-loja]")
            if link:
                link.click(); pg.wait_for_timeout(500)
                ok(tela() == "loja" and pg.is_visible("#gv-vazia"), f"{t} 'Voltar à loja' da confirmação → loja, sacola vazia")
                ok(len(ctx.pages) == 1, f"{t} nada abriu em outra aba")
                pg.screenshot(path=str(out / f"integ-4-volta-vazia-{w}.png"))
            larg = pg.evaluate("document.documentElement.scrollWidth"); ok(larg <= w, f"{t} sem rolagem lateral ({larg})")
            ok(not erros, f"{t} sem erros de console {erros}")
            ctx.close()
        b.close()
finally:
    comum.parar(httpd)
print("TUDO OK" if not falhas else f"{len(falhas)} FALHA(S)")
print("capturas em", out)
comum.encerrar("qa_integ", len(oks), falhas)
