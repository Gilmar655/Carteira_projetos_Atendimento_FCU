"""Gera os dados do painel Atendimento ao Cliente — FCU (MBO e NOT MBO).

Uso:
    python tools/build_data.py "FCU - Ferramenta de Controle (geral atendimento).xlsx"

O que faz:
- Lê a aba da planilha que tenha as colunas "Projeto", "nota" e "KPI MBO" (51 colunas da FCU).
- Grava data/base.js  -> foto ATUAL (todos os indicadores, gráficos, mapa e listas usam só esta foto).
- Se já existir um data/base.js com outra data de referência, ele é movido para data/historico.js
  (fotos anteriores, usadas apenas no histórico por projeto e por nota). Máximo: 12 fotos.
- Datas 01/01/1900 e 01/01/9999 são marcadores de "sem data" e viram vazio.
- Data de referência da foto = Prazo_Final_DELI - "Qtd Dias p/ Venc" (valor mais frequente).
- Formato colunar: texto e datas viram dicionário + índices; números ficam como estão.
"""
import sys, json, os, re, datetime as dt
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, 'data', 'base.js')
HIST = os.path.join(ROOT, 'data', 'historico.js')
MAX_HIST = 12


def clean(v):
    if v is None or v is pd.NaT or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, (pd.Timestamp, dt.datetime, dt.date)):
        return None if v.year < 1950 or v.year >= 9999 else v.strftime('%Y-%m-%d')
    if isinstance(v, float):
        return int(v) if v.is_integer() else round(v, 6)
    if hasattr(v, 'item'):
        v = v.item()
    if isinstance(v, str):
        v = ' '.join(v.split())
        if re.fullmatch(r'(1900|9999)-01-01( 00:00:00)?', v):
            return None
        return v or None
    return v


def encode(df):
    cols = []
    for c in df.columns:
        vals = [clean(v) for v in df[c].tolist()]
        if all(v is None or isinstance(v, (int, float)) for v in vals):
            cols.append({'n': str(c), 'v': vals})
            continue
        d, idx, enc = [], {}, []
        for v in vals:
            if v is None:
                enc.append(-1); continue
            v = str(v)
            if v not in idx:
                idx[v] = len(d); d.append(v)
            enc.append(idx[v])
        cols.append({'n': str(c), 'd': d, 'v': enc})
    return cols


def referencia(df):
    ok = df['Prazo_Final_DELI'].notna() & df['Qtd Dias p/ Venc'].notna()
    ref = (pd.to_datetime(df.loc[ok, 'Prazo_Final_DELI']) - pd.to_timedelta(df.loc[ok, 'Qtd Dias p/ Venc'], unit='D')).mode()
    return ref.iloc[0].strftime('%Y-%m-%d') if len(ref) else None


def read_js(path, var):
    if not os.path.exists(path):
        return None
    txt = open(path, encoding='utf-8').read().strip()
    return json.loads(txt[len(f'window.{var}='):].rstrip(';\n'))


def write_js(path, var, obj):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(f'window.{var}=')
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    book = pd.read_excel(src, sheet_name=None)
    sheet, df = next((n, d) for n, d in book.items() if {'Projeto', 'nota', 'KPI MBO'} <= set(map(str, d.columns)))
    df = df.loc[:, [c for c in df.columns if not str(c).startswith('Unnamed')]]
    df = df[df['Projeto'].notna()].reset_index(drop=True)
    meta = {'arquivo': os.path.basename(src), 'aba': sheet, 'linhas': int(len(df)), 'notas': int(df['nota'].nunique()),
            'referencia': referencia(df),
            'gerado': dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).strftime('%Y-%m-%dT%H:%M')}
    novo = {'meta': meta, 'cols': encode(df)}

    hist = read_js(HIST, 'FCU_HIST') or []
    old = read_js(BASE, 'FCU_ATD')
    if old and old['meta'].get('referencia') != meta['referencia']:
        hist = [h for h in hist if h['meta'].get('referencia') != old['meta'].get('referencia')] + [old]
    hist = [h for h in hist if h['meta'].get('referencia') != meta['referencia']]
    hist = sorted(hist, key=lambda h: h['meta'].get('referencia') or '')[-MAX_HIST:]

    os.makedirs(os.path.dirname(BASE), exist_ok=True)
    write_js(BASE, 'FCU_ATD', novo)
    write_js(HIST, 'FCU_HIST', hist)
    print(json.dumps(meta, ensure_ascii=False, indent=2))
    print('Histórico:', [h['meta']['referencia'] for h in hist])


if __name__ == '__main__':
    main()
