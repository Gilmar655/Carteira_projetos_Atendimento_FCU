# Atendimento ao Cliente — Carteira FCU · MBO e NOT MBO

Site estático (GitHub Pages) para acompanhar as notas e projetos de **Atendimento ao Cliente** da planilha
**FCU – Ferramenta de Controle (geral atendimento)**, separando **MBO** e **NOT MBO** — Enel Brasil Grids · Gestão de Programação.

**Endereço:** https://gilmar655.github.io/Carteira_projetos_Atendimento_FCU/

## O que o site mostra
- Cabeçalho com logomarca Enel Brasil, relógio e data on-line (horário de Brasília) e botão rápido **Todos / MBO / NOT MBO**.
- **Filtros laterais** no modelo do painel Spotfire (anexo PowerPoint), com contagem de notas por valor e busca nas listas longas:
  - *Dados da Nota*: Projeto, Nota, KPI Nota, KPI MBO, Prazo final (DELI), Data DELI (com "incluir vazios"), Responsável nota, Nível projeto, Nível de tensão, Status nota, Situação da nota, Situação do prazo, Aging, Tipo de prazo, Demanda RCO (camada), NEC | UPS, KPI Projeto, Mês de entrada e **Mudança desde a foto anterior**.
  - *Executante*: Polo, KPI Execução, Executante, Contrato, Área.
  - *Projeto*: Tipo de projeto, Tipo objeto da nota, Status do projeto.
  - *Cliente*: Tipo de cliente, Cliente.
  - *Localização*: Município, Bairro, Circuito, Com/sem coordenada.
- **Indicadores** (notas e projetos): Notas, Obras concluídas, Obras paralisadas, Carteira de obras, Backlog (carteira vencida), Carteira no prazo, Georreferenciados — clique para filtrar.
- **MBO × NOT MBO**: cartões comparativos (carteira, vencidas, concluídas, paralisadas, % no prazo, novas e entregues desde a foto anterior), card **MBO a vencer** (7/15/30/60/90 dias), notas por polo e carteira por executante.
- **Aging e prazos**: aging (Vencida, ≤10, 11–15, 16–30, 31–60, 61–90, 91–120, >120 dias) e prazo de vencimento por mês (MBO × NOT MBO).
- **Status e demanda**: status de execução, demanda RCO, NEC | UPS, KPI Nota, tipo de projeto e tipo de cliente. Gráficos clicáveis.
- **Mapa** (Google Maps ruas/híbrido/satélite + OpenStreetMap) com as coordenadas Latitude/Longitude da FCU, agrupamento, cor por KPI MBO, situação do prazo ou status de execução e links **Google Maps, Waze e Street View**.
- **Base**: lista de **Notas** (agregada) e de **Projetos**, com busca, ordenação, paginação e exportação Excel.
- **Histórico por projeto e por nota** (clique no código): contador de prazo ao vivo, linha do tempo de todas as datas, mini-mapa, comparação campo a campo entre **todas as fotos da FCU** (19/10, 16/11, 25/11…) com as mudanças destacadas, projetos que entraram/saíram da nota, evolução das programações e exportação do histórico em Excel. Link direto: `#projeto=CODIGO` ou `#nota=NUMERO`.

## Regras dos indicadores
| Indicador | Notas | Projetos |
|---|---|---|
| Notas | notas distintas (coluna `nota`) | linhas (coluna `Projeto`) |
| Obras concluídas | `AUX_TRATAR_NOTA` = CONCLUÍDO | `KPI Projeto` = Concluído |
| Obras paralisadas | `Status_Execução_Nota` = Paralisado | idem |
| Carteira de obras | `AUX_TRATAR_NOTA` = CARTEIRA | idem |
| Backlog | carteira com `STATUS_PRAZO` = FORA DO PRAZO | idem |
| Carteira no prazo | carteira com `STATUS_PRAZO` = NO PRAZO | idem |

Conferência com o painel do PowerPoint (KPI Nota = Execução, KPI MBO = MBO, Responsável e Nível = Aéreo, Polo = Norte): **178 notas / 258 projetos, backlog 43, concluídas 0, paralisadas 0**.

## Dados
- `data/base.js` — foto **atual** (todos os indicadores, gráficos, mapa e listas usam somente esta foto).
- `data/historico.js` — fotos **anteriores**, usadas apenas no histórico por projeto e por nota (e no filtro "Mudança desde…").
- Datas 01/01/1900 e 01/01/9999 = "sem data". Data de referência da foto = `Prazo_Final_DELI − Qtd Dias p/ Venc`.

## Atualizar a base
```bash
pip install pandas openpyxl
python tools/build_data.py "FCU - Ferramenta de Controle (geral atendimento).xlsx"
git add data && git commit -m "Atualiza base FCU" && git push
```
O script grava a nova foto em `data/base.js` e move a foto anterior para `data/historico.js` automaticamente (até 12 fotos).

Sem Python: no site, **Importar Excel** → escolha a planilha → **Exportar → base.js e historico.js** → substitua os dois arquivos em `data/`.

## Base atual (25/11/2026)
- FCU – Ferramenta de Controle (geral atendimento): 7.527 projetos · 4.147 notas · 5.576 projetos MBO (3.515 notas) · 1.951 NOT MBO (632 notas) · 6.716 projetos com coordenada.
- Histórico: fotos de 19/10/2026 (7.080 projetos) e 16/11/2026 (7.433 projetos), da versão anterior do site.

Especificação completa: [PROMPT_ELABORACAO.md](PROMPT_ELABORACAO.md).
Bibliotecas em `vendor/` (sem CDN): Chart.js 4.4.4 · Leaflet 1.9.4 + MarkerCluster · SheetJS 0.18.5.
