#!/usr/bin/env python3
"""Peças em comum dos testes do Checkout Rápido DeoBeauty (Playwright + Chromium).

- Servidor local, só de leitura, que serve a RAIZ do repositório (index.html, css/, js/, img/).
  Nada é escrito na raiz; se um teste precisar de uma página modificada, ela deve ser gerada numa
  pasta temporária fora do repositório e servida com servir(porta, pasta).
- Contexto do Playwright (largura, movimento reduzido, toque, pt-BR, fuso de São Paulo).
- Página nova com coleta de erros do console e das exceções da página.
- Fontes: se DEO_FONTES apontar para uma pasta com gfonts.css + .woff2 (ou se existir
  testes/fontes/gfonts.css com as .woff2 ao lado), o Google Fonts é trocado pelas fontes locais,
  servidas em /_fontes/. Sem isso, as fontes carregam da internet.
- Pasta de saída das capturas: saida-testes/<nome-do-script>/ na raiz (ou o --out de cada script).
"""
import os
import re
import sys
import pathlib
import threading
import functools
import http.server

AQUI = pathlib.Path(__file__).resolve().parent
RAIZ = AQUI.parent
SAIDA = RAIZ / "saida-testes"

# ------------------------------------------------------------------ fontes


def _fontes_da_pasta(pasta):
    """Devolve (pasta, css) se a pasta tem gfonts.css e todas as .woff2 que ele cita; senão (None, motivo)."""
    css_arq = pasta / "gfonts.css"
    if not css_arq.is_file():
        return None, f"{pasta} sem gfonts.css"
    css = css_arq.read_text(encoding="utf8")
    citadas = re.findall(r"url\(\s*['\"]?/_fontes/([^)'\"\s]+)", css)
    faltam = [n for n in citadas if not (pasta / n).is_file()]
    if not citadas or faltam:
        return None, f"{pasta}: faltam as fontes {', '.join(faltam) or '(nenhuma .woff2 citada)'}"
    return pasta, css


def _achar_fontes():
    tentativas = []
    env = os.environ.get("DEO_FONTES")
    if env:
        tentativas.append(pathlib.Path(env).expanduser().resolve())
    tentativas.append(AQUI / "fontes")
    for pasta in tentativas:
        achou, css = _fontes_da_pasta(pasta)
        if achou:
            return achou, css
        if pasta != AQUI / "fontes" or (pasta / "gfonts.css").exists():
            print(f"aviso: fontes locais ignoradas ({css})", file=sys.stderr)
    return None, None


FONTES, GCSS = _achar_fontes()


def descrever_fontes():
    return f"fontes locais em {FONTES}" if FONTES else "fontes da internet (Google Fonts)"


def rotear_fontes(pg):
    """Com fontes locais: Google Fonts vira o gfonts.css local e /_fontes/ serve as .woff2. Sem elas, não mexe."""
    if not FONTES:
        return
    pg.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=GCSS))
    pg.route("**/fonts.gstatic.com/**", lambda r: r.abort())
    pg.route("**/_fontes/**", lambda r: r.fulfill(status=200, content_type="font/woff2",
                                                   body=(FONTES / r.request.url.split("/_fontes/")[1]).read_bytes()))

# ------------------------------------------------------------------ servidor


class _SoLeitura(http.server.SimpleHTTPRequestHandler):
    """GET e HEAD apenas (o SimpleHTTPRequestHandler não grava nada), sem log no terminal."""

    def log_message(self, *a):
        pass


def servir(porta, pasta=None):
    """Sobe um servidor em 127.0.0.1:<porta> servindo a raiz do repositório (ou outra pasta)."""
    h = functools.partial(_SoLeitura, directory=str(pasta or RAIZ))
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", porta), h)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def parar(httpd):
    httpd.shutdown()
    httpd.server_close()


def endereco(porta, ancora=""):
    """Endereço do index.html no servidor local; ancora = '#checkout' para abrir direto no checkout."""
    return f"http://127.0.0.1:{porta}/index.html{ancora}"


# ------------------------------------------------------------------ Playwright


def contexto(b, w, h=None, reduce=False, touch=False, dpr=None, **extra):
    """Contexto com a largura w (altura 812 no celular, 900 a partir de 768), dpr 2 no celular e 1 no computador."""
    mob = w < 768
    return b.new_context(viewport={"width": w, "height": h or (812 if mob else 900)},
                         device_scale_factor=dpr or (2 if mob else 1),
                         reduced_motion="reduce" if reduce else "no-preference", locale="pt-BR",
                         timezone_id="America/Sao_Paulo", has_touch=touch, **extra)


def nova_pagina(ctx):
    """Página nova com a lista de erros (exceções e console.error) e as fontes já roteadas."""
    pg = ctx.new_page()
    erros = []
    pg.on("pageerror", lambda e: erros.append(str(e)))
    pg.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)
    rotear_fontes(pg)
    return pg, erros


def abrir(pg, porta, ancora=""):
    pg.goto(endereco(porta, ancora), wait_until="networkidle")
    pg.evaluate("document.fonts.ready")

# ------------------------------------------------------------------ saída e resultado


def saida(nome, out=None, criar=True):
    """Pasta das capturas: --out, se veio; senão saida-testes/<nome>/ na raiz do repositório."""
    p = pathlib.Path(out) if out else SAIDA / nome
    if criar:
        p.mkdir(parents=True, exist_ok=True)
    return p


def inicio(nome, porta):
    print(f"{nome}: servindo {RAIZ} em http://127.0.0.1:{porta}/ · {descrever_fontes()}")


def encerrar(nome, n_ok, falhas):
    """Imprime o resumo (lido pelo rodar_todos.py) e sai com código 1 se houve falha."""
    print(f"\nRESULTADO {nome}: {n_ok} ok, {len(falhas)} falhas")
    for f in falhas:
        print("  FALHA:", f)
    sys.exit(1 if falhas else 0)
