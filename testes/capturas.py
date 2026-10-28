#!/usr/bin/env python3
"""Capturas do protótipo Deo Checkout (Playwright + Chromium).

Uso:
  python3 testes/capturas.py --w 375,1280 [--out pasta] [--name a] \\
      [--modo passos|pagina|janela] [--pre "DeoCK.exemplo(2)"] [--css patch.css] [--js patch.js] \\
      [--full] [--port 8765] [--wait 700] [--h 812] [--reduce]

- Serve a raiz do repositório num servidor local (só leitura) e abre o index.html.
- Fontes: locais com DEO_FONTES ou testes/fontes/gfonts.css (ver testes/README.md); senão, da internet.
- Injeta patch CSS (tag style) e patch JS (depois do app), roda --pre e captura.
- Saída: <out>/<name>-<w>.png (celular em dpr 2, computador em dpr 1); --out padrão: saida-testes/capturas/.
  Imprime os caminhos; avisos (erros do console, rolagem lateral) vão para a saída de erro.
"""
import argparse, sys, pathlib
import comum


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--w", default="375,1280")
    ap.add_argument("--h", type=int, default=0)
    ap.add_argument("--out", default=None)
    ap.add_argument("--name", default="a")
    ap.add_argument("--modo", default="")
    ap.add_argument("--pre", default="")
    ap.add_argument("--css", default="")
    ap.add_argument("--js", default="")
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--wait", type=int, default=700)
    ap.add_argument("--reduce", action="store_true", help="emula prefers-reduced-motion: reduce")
    a = ap.parse_args()

    css = pathlib.Path(a.css).read_text(encoding="utf8") if a.css else ""
    js = pathlib.Path(a.js).read_text(encoding="utf8") if a.js else ""
    out = comum.saida("capturas", a.out)
    print(comum.descrever_fontes(), file=sys.stderr)

    httpd = comum.servir(a.port)
    from playwright.sync_api import sync_playwright
    feitos = []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            for w in [int(x) for x in a.w.split(",") if x]:
                mob = w < 768
                h = a.h or (812 if mob else 900)
                ctx = comum.contexto(b, w, h=h, reduce=a.reduce)
                pg, erros = comum.nova_pagina(ctx)
                comum.abrir(pg, a.port)
                if a.modo:
                    pg.evaluate(f"DeoCK.modo({a.modo!r})")
                if css:
                    pg.add_style_tag(content=css)
                if js:
                    pg.add_script_tag(content=js)
                if a.pre:
                    pg.evaluate(a.pre)
                pg.wait_for_timeout(a.wait)
                larg = pg.evaluate("document.documentElement.scrollWidth")
                if larg > w:
                    erros.append(f"rolagem lateral: scrollWidth {larg} > {w}")
                f = out / f"{a.name}-{w}.png"
                if a.full:
                    # página inteira: estica a janela até a altura do documento, para que barras fixas
                    # no rodapé fiquem no fim da imagem (e não no meio, como no full_page do navegador)
                    alt = pg.evaluate("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)")
                    pg.set_viewport_size({"width": w, "height": max(h, alt)})
                    pg.wait_for_timeout(250)
                    alt2 = pg.evaluate("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)")
                    if alt2 != alt:
                        pg.set_viewport_size({"width": w, "height": max(h, alt2)})
                        pg.wait_for_timeout(150)
                pg.screenshot(path=str(f))
                feitos.append(str(f))
                if erros:
                    print(f"[{w}] AVISOS:", *erros, sep="\n  ", file=sys.stderr)
                ctx.close()
            b.close()
    finally:
        comum.parar(httpd)
    print("\n".join(feitos))


if __name__ == "__main__":
    main()
