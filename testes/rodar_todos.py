#!/usr/bin/env python3
"""Roda todos os testes em sequência, cada um na sua porta, e imprime um resumo.

Uso: python3 testes/rodar_todos.py [--so qa_v3,qa_nova] [--porta 8901]
Sai com código 1 se algum script tiver falha (ou não terminar direito).
As capturas ficam em saida-testes/<nome-do-script>/ na raiz do repositório.
"""
import argparse, re, subprocess, sys, pathlib

AQUI = pathlib.Path(__file__).resolve().parent
SCRIPTS = ["qa_v3", "qa_pagamento", "qa_volta", "qa_sacola", "qa_integ", "qa_nova"]
RESULTADO = re.compile(r"^RESULTADO \S+: (\d+) ok, (\d+) falhas")

ap = argparse.ArgumentParser()
ap.add_argument("--so", default="", help="roda só estes scripts (separados por vírgula)")
ap.add_argument("--porta", type=int, default=8901, help="porta do primeiro script; os seguintes usam as próximas")
a = ap.parse_args()
lista = [s for s in SCRIPTS if not a.so or s in a.so.split(",")]

resumo, algo_falhou = [], False
for i, nome in enumerate(lista):
    porta = a.porta + i
    print(f"\n######## {nome} (porta {porta})", flush=True)
    proc = subprocess.Popen([sys.executable, str(AQUI / f"{nome}.py"), "--port", str(porta)], cwd=str(AQUI.parent),
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf8")
    achou = None
    for linha in proc.stdout:
        print(linha, end="", flush=True)
        m = RESULTADO.match(linha)
        if m:
            achou = (int(m.group(1)), int(m.group(2)))
    codigo = proc.wait()
    if achou is None:
        resumo.append(f"{nome}: não terminou (código {codigo})")
        algo_falhou = True
    else:
        n_ok, n_falhas = achou
        extra = f" (código {codigo})" if codigo and not n_falhas else ""
        resumo.append(f"{nome}: {n_ok} ok, {n_falhas} falhas{extra}")
        algo_falhou = algo_falhou or n_falhas > 0 or codigo != 0

print("\n======== resumo")
for r in resumo:
    print(r)
sys.exit(1 if algo_falhou else 0)
