# Prompt de elaboração — Atendimento ao Cliente · Carteira FCU (MBO e NOT MBO)

Registro da especificação para refazer ou atualizar o site com novas planilhas.

## 1. Objetivo
Atualizar o site `https://gilmar655.github.io/Carteira_projetos_Atendimento_FCU/` usando **somente** a planilha atual
"FCU – Ferramenta de Controle (geral atendimento)", com **filtros conforme o painel em PowerPoint** (Spotfire "GERAL – ATENDIMENTO"),
**localização dos projetos pelas coordenadas da planilha**, no mesmo padrão dos sites
Projetos_FCU_Sigeo_executados, Sigeo_parceiras_projetos_executados, FCU_projetos_execu-o_claude e FCU_Projetos_Execu-o,
para acompanhar os projetos **MBO e NOT MBO**, mantendo o **histórico por projeto e por nota** do site anterior.

## 2. Entrada
Planilha com 51 colunas: Projeto, nota, Status_Nota, Tipo_Obj_Nota, Tipo_Projeto, Status_Projeto, Ups_Plan, Ups_Exec_Projeto, contrato,
Empreiteira_Contratos, Area Real, Circuito, Polo, Nível_Tensão, AUX_AGING_VENC_Tabela, KPI MBO, Tipo_Prazo, Dias_Prazo, qtde_dias, dataAPRO,
dataAUTO, dataOLLI, Prazo_Final_DELI, Qtd Dias p/ Venc, dataDELI, STATUS_PRAZO, KPI Nota, KPI Projeto, Simulação Compensação REN1000, camada,
Nível_Projeto, AUX_RESP_NOTA, Data_Max_Prog, Status_Execução_Nota, Data_Max_Prog_nota, Qtde_Programacoes, WL, data_nota, CLIENTE,
Tipo de Cliente, NEC_UPS, AUX_TRATAR_NOTA, Inicio_prev, Fim_prev, custo_total_cto, custo_total_clientes, dataDELIPJ, Longitude, Latitude, bairro, municipio.
Uma linha por projeto; a nota pode ter vários projetos.

## 3. Estrutura
Cabeçalho (logo, relógio, menu Painel · MBO × NOT MBO · Aging e prazos · Status e demanda · Mapa · Base, botão Todos/MBO/NOT MBO,
Importar, Exportar) · filtros na lateral direita (grupos Dados da Nota, Executante, Projeto, Cliente, Localização) · indicadores à esquerda
(como no PowerPoint) · gráficos · mapa · base · detalhe com histórico.

## 4. Histórico
Cada atualização gera uma "foto". A foto atual fica em `data/base.js`; as anteriores em `data/historico.js`. O detalhe do projeto e da nota
mostra os campos acompanhados lado a lado em todas as fotos (status, KPIs, programações, datas, executante, contrato, UPS, prazo, DELI,
KPI MBO, camada), destacando mudanças. "Qtd Dias p/ Venc" e "Aging" mudam sozinhos com a data e não contam como mudança.
Filtro "Mudança desde a foto anterior": Novo na base · Entregue (DELI) no período · Programação alterada · Status alterado · Outros campos alterados · Sem mudança.

## 5. Tecnologia
HTML/CSS/JS estático, bibliotecas locais em `vendor/`. Paleta: MBO #0b4fa8, NOT MBO #eb6834, no prazo #0ca30c, vencida #d03b3b, concluída #7b8794.

## Histórico de versões
- **20/11/2026** — versão anterior: carteira de atendimento com fotos 19/10 × 16/11.
- **25/11/2026** — nova versão: base FCU de 25/11/2026, filtros do painel PowerPoint, MBO × NOT MBO, aging, mapa com coordenadas, histórico por projeto e nota em todas as fotos, importação/exportação.
