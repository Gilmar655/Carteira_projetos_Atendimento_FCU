"""Gera os arquivos data/*.json do site a partir da planilha Base_Atendimento_ao_Cliente.xlsx.

Uso:
    python scripts/gerar_dados.py caminho/Base_Atendimento_ao_Cliente.xlsx [--sem-dados-pessoais]

- Aba "Sheet1"    -> data/atual.json    (foto mais recente)
- Aba "Planilha1" -> data/anterior.json (foto anterior, usada para o histórico)
Datas 01/01/1900 e 01/01/9999 são marcadores de "sem data" e viram vazio.
A data de referência de cada aba é obtida de Prazo_Final_DELI - "Qtd Dias p/ Venc" (valor mais frequente).
--sem-dados-pessoais remove CLIENTE, Latitude, Longitude e LocalInst antes de publicar.
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ABAS = {"Sheet1": "atual", "Planilha1": "anterior"}
PESSOAIS = ["CLIENTE", "Latitude", "Longitude", "LocalInst"]


def valor(v):
    if v is None or (isinstance(v, float) and pd.isna(v)) or v is pd.NaT:
        return None
    if isinstance(v, (pd.Timestamp, datetime)):
        return None if v.year in (1900, 9999) else v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if hasattr(v, "item"):
        return v.item()
    return v


def referencia(df):
    ok = df["Prazo_Final_DELI"].notna() & df["Qtd Dias p/ Venc"].notna()
    ref = (df.loc[ok, "Prazo_Final_DELI"] - pd.to_timedelta(df.loc[ok, "Qtd Dias p/ Venc"], unit="D")).mode()
    return ref.iloc[0].strftime("%Y-%m-%d") if len(ref) else None


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    origem = Path(sys.argv[1])
    sem_pessoais = "--sem-dados-pessoais" in sys.argv
    destino = Path(__file__).resolve().parent.parent / "data"
    destino.mkdir(exist_ok=True)
    abas = pd.read_excel(origem, sheet_name=None)
    meta = {"arquivo": origem.name, "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "abas": {}}
    for aba, nome in ABAS.items():
        df = abas[aba]
        df = df.loc[:, [c for c in df.columns if not str(c).startswith("Unnamed")]]
        if sem_pessoais:
            df = df.drop(columns=[c for c in PESSOAIS if c in df.columns])
        cols = list(df.columns)
        linhas = [[valor(v) for v in row] for row in df.itertuples(index=False, name=None)]
        (destino / f"{nome}.json").write_text(
            json.dumps({"colunas": cols, "linhas": linhas}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        meta["abas"][nome] = {"aba": aba, "linhas": len(linhas), "referencia": referencia(df)}
    meta["sem_dados_pessoais"] = sem_pessoais
    (destino / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
