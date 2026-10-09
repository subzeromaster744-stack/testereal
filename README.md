# Escala de Hora Extra — Cloudflare Workers + D1

Site para os gestores montarem a escala de hora extra por máquina, registrarem presença e refeição e acompanharem indicadores.

```
public/index.html   o site (HTML, CSS e JavaScript em um arquivo só)
src/worker.js       o Worker: serve o site e a API /api/state, que grava no banco D1
wrangler.jsonc      configuração: nome do Worker, pasta do site e banco D1
```

Os dados ficam no **D1** (banco da Cloudflare) e são compartilhados entre todos os gestores: o site consulta o servidor a cada 8 segundos e só baixa os dados quando algo mudou. O Worker cria a tabela sozinho na primeira chamada, então não há script de banco para rodar.

> Este projeto é um **Worker** (endereço `*.workers.dev`), não um projeto Pages (`*.pages.dev`). A pasta `functions/` do Pages não é usada aqui.

## 1. Enviar para o GitHub

Crie um repositório em https://github.com/new e envie esta pasta (`git push -u origin main`).

## 2. Criar o banco D1

No painel da Cloudflare, abra **Storage & databases → D1 SQL database → Create** e crie um banco, por exemplo `escala-hora-extra`. Não precisa criar tabelas.

Abra o banco e copie o **nome** e o **ID** (um código longo, tipo `a1b2c3d4-…`). Cole os dois em `wrangler.jsonc`, no bloco `d1_databases`:

```jsonc
"d1_databases": [
  { "binding": "DB", "database_name": "escala-hora-extra", "database_id": "COLE-O-ID-AQUI" }
]
```

O `binding` precisa continuar `DB`. O banco precisa estar declarado neste arquivo: o deploy usa o `wrangler.jsonc` como fonte da configuração, e um binding criado só no painel pode ser perdido no deploy seguinte.

## 3. Criar o projeto no Cloudflare

1. **Workers & Pages → Create application → Import a repository** (ou *Connect to Git*), e escolha o repositório.
2. O nome do projeto/Worker precisa ser igual ao campo `name` do `wrangler.jsonc` (aqui, `testereal`). Se for outro, altere o `name` no arquivo.
3. Deixe o comando de deploy padrão (`npx wrangler deploy`), sem comando de build e com a raiz do repositório como diretório.

A cada `git push` no branch `main` o Cloudflare publica de novo.

## 4. Código de acesso

No projeto, abra **Settings → Variables and Secrets → Add**: nome `ACCESS_KEY`, tipo **Secret**, valor com um código que só os gestores conheçam. Secrets não são apagados pelos deploys. Cada gestor digita o código uma vez, na primeira abertura, e o navegador o guarda.

## Cadastrar os CTs (planilha) e filtrar por seção

Cada máquina é um **CT** (centro de trabalho) e pertence a uma **Seção** e a um **Grupo de Máq**. Em **Cadastro → Importar CTs (planilha)**, escolha um arquivo `.xlsx` ou `.csv`, ou cole as linhas do Excel, com estas colunas:

```
Seção     CT          Grupo de Máq
Eixos D   01061031    CHOQUE TÉRMICO
Eixos A   01061008    CHOQUE TÉRMICO
```

- A primeira linha pode ser o cabeçalho; as colunas são achadas pelo título (em qualquer ordem). Sem cabeçalho, vale a ordem Seção, CT, Grupo.
- Os zeros à esquerda do CT são mantidos, inclusive quando o Excel guarda o CT como número com formato `00000000`.
- Antes de importar, a pré-visualização mostra o que é novo, o que será atualizado e as linhas com erro (CT vazio ou repetido na planilha).
- CTs que já existem são **atualizados** (seção e grupo); as vagas que você ajustou ficam. Seção em branco na planilha não apaga a seção já cadastrada. CTs novos entram com 1 vaga.
- Arquivos `.xls` antigos não são lidos: salve como `.xlsx` ou `.csv`.
- Também dá para cadastrar um CT por vez (Seção, CT, Grupo de Máq e Vagas; só o CT é obrigatório), e tudo pode ser editado na tabela. A máquina **não tem campo Nome**: o nome dela é o próprio CT.
- Os colaboradores também entram por planilha (próxima seção).

## Importar colaboradores (planilha)

Em **Cadastro → Importar colaboradores (planilha)** (coluna da direita), escolha um `.xlsx` ou `.csv`, ou cole as linhas do Excel, com estas colunas:

```
Nome          Turno     CT
Ana Souza     1         01061031/01061008
Bruno Lima    T2        01061031
Carla Dias    Turno 3   01061008|01061009
```

- A primeira linha pode ser o cabeçalho; as colunas são achadas pelo título (**Nome** ou Colaborador, **Turno**, **CT** ou Máquina), em qualquer ordem, e outras colunas (como Matrícula) são ignoradas. Sem cabeçalho, vale a ordem Nome, Turno, CT.
- **Turno**: 1, 2, 3, T1, "Turno 1" ou "1º turno".
- **Vários CTs** para a mesma pessoa: na mesma célula, separados por `/`, `|`, `,` ou `;`; em várias colunas de CT (CT 1, CT 2…); ou repetindo o nome em outras linhas (as máquinas são somadas).
- Quem já existe (mesmo nome, sem diferença de maiúsculas ou espaços) é **atualizado**: o turno muda se vier preenchido (em branco mantém o atual) e as máquinas são somadas, sem apagar as que a pessoa já tinha.
- CT que está na planilha mas não no cadastro é criado (com o CT como nome, 1 vaga e o grupo escolhido em "Grupo dos CTs novos"); se não tiver seção, preencha depois ou importe os CTs antes. CT que o Excel gravou sem os zeros à esquerda (1061031) é reconhecido como 01061031.
- A pré-visualização mostra novos, atualizações (com a mudança de turno e quantas máquinas entram) e erros: nome vazio, turno inválido ou ausente (para quem é novo), mesmo nome com turnos diferentes. Só as linhas válidas são importadas. No celular, cada pessoa vira um cartão.

## Buscar máquina: seção, grupo ou CT

Em todo lugar onde se escolhe máquina há a mesma **janela de busca**: um campo no alto e, abaixo, a lista em **Seção › Grupo de máquinas › CT**.

- **Buscar**: digite parte do nome da seção, do grupo ou do CT (sem diferenciar maiúsculas e acentos). Várias palavras se combinam ("estria eixos b"). Letras soltas valem pelo começo da palavra, e 3 ou mais letras/números valem em qualquer trecho do CT ("031" acha 01061031). Um nome de seção ou de grupo digitado por inteiro ("eixos c") mostra só ele. A lista mostra até 500 máquinas; refine a busca para ver as demais.
- **Adicionar máquinas a uma pessoa** (Cadastro → Colaboradores → **+ adicionar máquinas**): marque uma **seção inteira**, um **grupo inteiro** ou só os **CTs** que quiser; com a busca ativa, marcar uma seção ou grupo escolhe só o que está aparecendo. O que a pessoa já tem aparece como "já tem". A seleção continua ao mudar a busca, e o botão do rodapé confirma ("Adicionar N máquina(s)"). As máquinas novas entram em ordem de seção, grupo e CT, depois das que a pessoa já tinha (a primeira, com ★, é o posto padrão na escala).
- **Novo colaborador**: o botão **+ Máquinas (opcional)** do formulário abre a mesma janela. O nome e o turno digitados ficam enquanto você escolhe.
- **Tabela de colaboradores**: as máquinas de cada pessoa aparecem agrupadas por seção › grupo, com **remover grupo** para tirar um grupo inteiro de uma vez (pede confirmação). Cada pessoa ocupa uma linha larga; no celular os campos empilham.
- **Filtrar as telas**: ao lado do seletor **Seção** (Escala, Calendário, Presença, Colaboradores e Cadastro) há o botão **Buscar máquina…**. Clique em uma seção, em um grupo ou em um CT e a tela mostra só ele (e as pessoas treinadas nele); uma etiqueta "Grupo …" ou "CT …" com **×** limpa o filtro. Com grupo ou CT filtrado, os grupos aparecem abertos (dá para recolher). A escolha fica lembrada no navegador. Trocar a seção no seletor limpa o grupo e o CT.
- **Presença**: quando a pessoa tem máquinas em mais de um grupo, a lista "Vai trabalhar em" vem agrupada por seção › grupo.
- A janela fecha com **Esc**, com o **×**, em **Cancelar** ou clicando fora. No celular ela sobe como uma folha na parte de baixo da tela.

O seletor **Seção** mostra só as máquinas da seção e as pessoas treinadas nelas, e os contadores passam a valer só para o filtro. A seção da pessoa vem das máquinas em que ela é treinada. **(sem seção)** mostra as máquinas sem seção e as pessoas sem máquina. Se nenhuma máquina tiver seção, o seletor de seção não aparece (a busca por grupo e CT continua).

## Escala: seção › grupo de máquinas › máquinas

A tela de escalar segue o mesmo desenho do calendário, para continuar curta mesmo com 100 CTs ou mais:

1. **Seção** (por exemplo, Eixos D): uma linha com quantas pessoas estão escaladas e quantas máquinas da seção já têm operador. As seções começam abertas.
2. **Grupo de máquinas** (por exemplo, CHOQUE TÉRMICO), dentro da seção. Começa **fechado**; a linha dele resume os escalados e as máquinas com operador, e mostra ⚠ se houver conflito dentro dele.
3. **Máquinas**: ao abrir o grupo, aparece um cartão por CT, com as pessoas treinadas nela. Clique na pessoa para escalá-la naquela máquina (quem tem mais de uma máquina aparece em todas; clicar em outra troca o posto).

**Expandir tudo** e **Recolher tudo** abrem e fecham tudo de uma vez. O que está aberto fica lembrado só no navegador de cada pessoa e é independente do calendário. O filtro **Seção** e os botões **Todos / T1 / T2 / T3** continuam valendo.

**Nem toda máquina precisa de operador.** Não existe lista de pendências "sem operador": uma máquina parada fica neutra, uma com gente escalada fica verde ("Com operador") e só o **conflito** (mais gente que vagas) aparece em vermelho e é contado no alto da tela. O indicador "Máquinas com operador" mostra quantas têm alguém, sem cobrar as demais.

## Turnos no sábado e no domingo

Sábado e domingo funcionam como qualquer outro dia: podem ter **os três turnos** trabalhando, cada pessoa com o turno do cadastro (T1, T2 ou T3), com os botões Todos / T1 / T2 / T3 e os indicadores por turno.

## Calendário: seção, grupo de máquinas e CTs

O calendário (semana ou mês) tem duas colunas fixas à esquerda: **Seção** e **Grupo de Máq · CT**. A estrutura abre nos mesmos três níveis da Escala:

1. **Seção**: uma linha com o total de pessoas de cada dia e quantas máquinas têm operador. Clique em ▾/▸ para recolher ou abrir. As seções começam abertas; "(sem seção)" fica por último.
2. **Grupo de máquinas**, dentro da seção. Começa fechado. O mesmo grupo em duas seções aparece separado em cada uma.
3. **CT**: ao abrir o grupo, uma linha por CT, com o código em destaque, as vagas e as pessoas escaladas em cada dia, com turno e presença.

**Expandir tudo** abre seções e grupos; **Recolher tudo** deixa só as linhas das seções. Cores: verde = tem operador escalado, vermelho = conflito; máquina sem ninguém fica sem cor. Se nenhuma máquina tiver seção, a coluna Seção não aparece.

## Colaboradores: lista enxuta que abre e fecha

A aba **Colaboradores** mostra só quem **já tem máquina**, em uma linha por pessoa: nome, turno (T1/T2/T3), seção(ões) e quantas máquinas. Tudo começa **fechado**; clique no nome (▸) para abrir e ver/editar:

- **Nome** e **turno** (a linha se atualiza na hora);
- as **máquinas em que a pessoa é treinada**, agrupadas por seção › grupo, com **×** para tirar uma máquina, "remover grupo" e **+ adicionar máquinas** (a mesma busca por seção, grupo ou CT; o ★ é o posto padrão na escala);
- **Remover colaborador**.

No alto da aba: busca por **nome, seção ou CT** (digite um CT e veja quem é treinado nele), botões **Todos / T1 / T2 / T3**, o seletor **Seção** com **Buscar máquina…** e, acima da lista, **Expandir tudo** e **Recolher tudo**. As linhas que você deixou abertas ficam lembradas neste navegador. A lista mostra até 200 pessoas por vez (use a busca para achar as demais); na impressão todas as linhas saem abertas.

**Quem está cadastrado mas ainda sem máquina não vai para esta aba**: continua no **Cadastro**, em "Sem máquina definida" (com **+ adicionar máquinas**), e na **Escala**, no bloco "Sem máquina definida". Assim que a pessoa ganha a primeira máquina ela passa para a aba Colaboradores, e se perder a última volta para o Cadastro (o site avisa).

## Cadastro: máquinas à esquerda, colaboradores à direita

No computador o Cadastro tem **duas colunas**: **Máquinas** (cadastro e importação de CTs) na esquerda e **Colaboradores** (novo colaborador, quem está sem máquina e importação em lote) na direita. Os colaboradores que já têm máquina **não ficam em destaque aqui**: aparece só um resumo com o atalho para a aba Colaboradores. No celular vira **uma coluna** só, com cada máquina e cada colaborador sem máquina em um cartão com os campos legíveis.

## Indicadores

A tela tem o seletor de período (7, 30, 90 dias ou todo o histórico) e, sobre os mesmos dados, indicadores e gráficos feitos no próprio site (sem biblioteca externa, sem depender de internet):

- **Indicadores no alto**: escalados, compareceram, faltas após confirmação, % de comparecimento, pendentes de check-in, refeições reservadas, dias com hora extra e pessoas diferentes.
- **Escalados por dia**: uma coluna por dia, empilhada em presentes (verde), faltas (vermelho) e pendentes de check-in (cinza); sábados e domingos com a data em destaque. Passe o mouse (ou toque) na coluna para ver os números. Com mais de 120 dias, o gráfico mostra os últimos 120 e a tabela abaixo tem todos.
- **Comparecimento por dia**: linha do % (presentes ÷ presentes + faltas) dia a dia.
- **Por turno** e **Situação no período**: duas roscas e barras por turno.
- **Por seção** (se houver seções) e **Por grupo de máquinas**: barras com presentes, faltas e pendentes, ordenadas pelas que mais escalaram. A máquina de cada pessoa é a que estava escolhida na escala do dia.
- **Por dia da semana**: média de pessoas escaladas por segunda, terça… domingo, nos dias com hora extra.
- **Mais faltas**: as 10 pessoas com mais faltas no período.
- As tabelas **Histórico por colaborador** (com "Ausência recorrente" a partir de 2 faltas) e **Histórico por dia** (agora com refeições) continuam abaixo.

Os gráficos se ajustam à largura da tela e, no celular, ficam em uma coluna.

## No celular e na impressão

- **Presença e refeição** no celular vira uma lista de cartões, com os botões Presente e Faltou grandes e sem rolar para o lado.
- **Imprimir** (Ctrl+P): a tela da Escala sai sem menu e botões, só com as máquinas que têm gente escalada e as pessoas de cada uma. Seções e grupos fechados na tela são abertos sozinhos só para a impressão (o Calendário também). A Presença imprime a tabela do dia, com os botões de check-in como caixas para marcar à mão.
- **Remover** um CT ou uma pessoa do cadastro pede confirmação, porque a mudança vale para todos os gestores.
- No Calendário, abrir ou fechar seções e grupos mantém a posição da rolagem.

## Observações

- **Sem `ACCESS_KEY`**, qualquer pessoa com o link vê e edita a escala, que contém nomes de colaboradores.
- **Sem o binding `DB`**, o site abre, mas cada navegador guarda os dados só para si, e o cabeçalho mostra o motivo (veja a tabela abaixo).
- Os dados cadastrados em outras versões (claude.ai, Vercel) não vêm junto: recadastre ou use **Cadastro → Importar em lote**. Se o servidor estiver vazio e o navegador já tiver dados locais, o site os envia na primeira abertura. Se o servidor já tiver dados, eles substituem os do navegador; por isso, abra primeiro no computador cujos dados valem.
- **Dois gestores editando o mesmo dia ao mesmo tempo**: vale a última gravação. O site se atualiza sozinho a cada 8 segundos (e ao voltar para a aba), então o risco é só quando duas pessoas mexem no mesmo dia dentro desse intervalo.
- Para testar no seu computador: `npx wrangler dev --var ACCESS_KEY:meucodigo` (usa um banco local temporário).

## O cabeçalho diz se está sincronizando

Logo abaixo do título, o site mostra o estado da conexão com o servidor. O botão **Sincronizar agora** força uma nova tentativa.

| Mensagem | O que significa | O que fazer |
| --- | --- | --- |
| ● Dados compartilhados entre os gestores · sincronizado às HH:MM:SS | Funcionando. | Nada. |
| ⚠ o banco D1 não está ligado ao Worker | O Worker roda, mas não encontra o binding `DB`. | Confira o bloco `d1_databases` do `wrangler.jsonc` (binding `DB`, nome e ID do banco), envie o commit e aguarde o deploy. |
| ⚠ a API /api/state não foi encontrada | O site está no ar, mas o código da API não foi publicado (por exemplo, o projeto é Pages ou falta o `wrangler.jsonc`). | Confira se `wrangler.jsonc` e `src/worker.js` estão na raiz do repositório e se o `name` do arquivo é igual ao do Worker; veja o resultado do build. |
| ⚠ código de acesso não informado ou incorreto | O `ACCESS_KEY` está definido e o navegador não tem o código certo. | Clique em **Sincronizar agora** e digite o código. |
| ⚠ sem conexão com o servidor | Rede fora do ar ou erro no servidor. | Tente de novo; veja os logs do Worker em **Observability**. |

Você também pode abrir `https://SEU-SITE.workers.dev/api/state` no navegador: `{"error":"storage_not_configured"}` indica binding ausente; `{"error":"unauthorized"}` indica que o banco está ligado e falta só o código; uma página 404 indica que a API não foi publicada.
