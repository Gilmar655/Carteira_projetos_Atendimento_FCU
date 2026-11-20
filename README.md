# Carteira de Projetos — Atendimento FCU

Site estático (HTML, CSS e JavaScript, sem dependências) para consultar a carteira de projetos de atendimento ao cliente da planilha `Base_Atendimento_ao_Cliente.xlsx`.

## O que o site mostra

- Relógio e data em tempo real no horário de Brasília (`America/Sao_Paulo`).
- Indicadores: projetos na base, notas em carteira (sem `dataDELI`), notas vencidas hoje e projetos com programação futura.
- Card **MBO — projetos a vencer** em relação à data de hoje (janela de 7, 15, 30, 60 ou 90 dias), com a lista dos mais próximos e os MBO já vencidos.
- Pesquisa livre (projeto, nota, cliente, circuito, local de instalação, bairro) e **filtros suspensos** de seleção múltipla: situação do prazo, KPI MBO, polo, área, empreiteira, tipo de projeto, tipo da nota, execução, status da nota e do projeto, KPIs, tipo de cliente, município, bairro, camada, nível do projeto e de tensão, tipo de prazo, NEC/UPS e mudança desde a foto anterior.
- Gráficos clicáveis: situação do prazo hoje e projetos em carteira por polo.
- Lista de **Projetos** e de **Notas**, com ordenação, paginação e contador de prazo ao vivo.
- **Clique no projeto**: contador de prazo, linha do tempo de todas as datas, histórico de programação (aba anterior × aba atual), alertas e todos os campos da planilha, com os que mudaram destacados.
- **Clique na nota**: contador de prazo da nota, comparação entre as duas fotos, todos os projetos da nota com a evolução das programações e os dados comuns da nota.

## Regras usadas (nada é inventado)

- `data/atual.json` vem da aba **Sheet1** e `data/anterior.json` da aba **Planilha1**.
- A data de referência de cada aba é calculada por `Prazo_Final_DELI − Qtd Dias p/ Venc`.
- Datas `01/01/1900` e `01/01/9999` são marcadores de "sem data" e aparecem vazias.
- A planilha não traz cada programação individual: traz `Qtde_Programacoes`, `Data_Max_Prog` (projeto) e `Data_Max_Prog_nota` (nota). O histórico de programação é a comparação entre as duas abas.
- Contador: tempo até 00:00 (Brasília) do dia de `Prazo_Final_DELI`, o mesmo critério da coluna `Qtd Dias p/ Venc`. Notas com `dataDELI` mostram a data de entrega.

## Atualizar os dados

```bash
pip install pandas openpyxl
python scripts/gerar_dados.py caminho/Base_Atendimento_ao_Cliente.xlsx
# para publicar sem nome de cliente, coordenadas e local de instalação:
python scripts/gerar_dados.py caminho/Base_Atendimento_ao_Cliente.xlsx --sem-dados-pessoais
git add data && git commit -m "Atualiza base" && git push
```

## Logomarca

Coloque o arquivo oficial da marca em `assets/img/logo-enel.png`. Enquanto o arquivo não existir, o topo mostra o nome "Enel Brasil" em texto.

## Publicar no GitHub Pages

Settings → Pages → *Build and deployment* → Source: **Deploy from a branch** → Branch: **main** / **(root)** → Save.
O site fica em `https://gilmar655.github.io/Carteira_projetos_Atendimento_FCU/`.

## Ver no computador

Os dados são carregados por `fetch`, então abra por um servidor local:

```bash
python -m http.server 8000
# acesse http://localhost:8000
```
