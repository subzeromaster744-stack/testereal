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

No projeto, abra **Settings → Variables and Secrets → Add**: nome `ACCESS_KEY`, tipo **Secret**, valor com um código que só os gestores conheçam. Secrets não são apagados pelos deploys. O administrador digita o código uma vez (janela **Entrar → Sou administrador**) e o navegador o guarda. Esse mesmo código também é necessário para criar usuários por seção (próxima seção).

## Usuários por seção (cada chefe só vê e cadastra a sua seção)

O administrador (quem tem o `ACCESS_KEY`) cria usuários que só enxergam e mexem em uma ou mais seções.

**Criar um usuário**
1. Entre como administrador (**Entrar → Sou administrador** e digite o `ACCESS_KEY`).
2. Abra **Cadastro → Usuários de seção → + Novo usuário**.
3. Informe nome, usuário (só letras minúsculas, números, ponto, traço; 3 a 30 caracteres) e marque a(s) seção(ões). Dá para criar uma seção nova digitando o nome.
4. Use a senha sugerida ou digite outra (mínimo de 6 caracteres) e clique em **Salvar**.
5. A tela mostra **usuário e senha uma única vez**: anote e envie ao chefe. A senha não é guardada em texto; depois só dá para trocar.

**Trocar a senha, mudar seções ou remover**: no mesmo cartão, **Editar** ou **Remover**. Ao trocar a senha, a sessão antiga da pessoa termina e ela entra de novo; ao mudar as seções, a tela dela se ajusta sozinha em até 8 segundos.

**O que o usuário de seção vê e faz**

| Pode | Não pode |
| --- | --- |
| Ver só as máquinas da(s) sua(s) seção(ões) e as pessoas treinadas nelas | Ver máquinas, CTs ou pessoas de outras seções |
| Criar, editar e remover máquinas da sua seção e importar CTs (seção de fora é recusada) | Criar máquina em outra seção ou repetir um CT que já existe em outra |
| Cadastrar pessoas e **alocá-las às máquinas da sua seção**, inclusive as pessoas **sem máquina** da sua seção (e as sem seção nenhuma) | Alterar nome, turno ou remover uma pessoa que também trabalha em outra seção (aparece "compartilhada") |
| Remover as pessoas só da sua seção e as sem máquina que são da sua seção | Remover pessoa sem máquina que não tem a seção dele (a pessoa sem seção nenhuma, só se foi ele quem criou) |
| Montar a Escala, a Presença e o Calendário da sua seção | Escalar quem já está escalado em outra seção no mesmo dia (aparece bloqueado, "outra seção") |
| Ver Indicadores só da sua seção | Criar ou ver usuários |

Tudo isso é conferido **no servidor**: mesmo que alguém altere a página, os dados de outras seções nem chegam ao navegador e as gravações fora da seção são descartadas (o site avisa).

**Para saber**
- Uma pessoa **sem máquina** que tem outra seção de origem (veja Importar colaboradores) também não aparece para o chefe; já a pessoa sem máquina e **sem seção** aparece para todos os chefes.
- Uma pessoa treinada **só em máquinas de outra seção** não aparece para o chefe; para alocá-la a uma máquina da sua seção, peça ao administrador.
- Não existe "esqueci a senha" automático: o administrador define uma senha nova em **Editar**.
- Depois de 8 tentativas erradas de senha para o mesmo usuário (ou 30 do mesmo endereço) em 10 minutos, o site pede para aguardar.
- A sessão dura 14 dias. **Sair** (no cabeçalho) apaga do navegador os dados guardados, então outra pessoa pode usar o mesmo computador sem ver nada do chefe anterior.
- Se o `ACCESS_KEY` for apagado depois de criar usuários, **todos** ficam sem acesso até defini-lo de novo.
- Quem já usava o site como administrador continua entrando normalmente, sem refazer nada.

## Cadastrar os CTs (planilha) e filtrar por seção

Cada máquina é um **CT** (centro de trabalho) e pertence a uma **Seção** e a um **Grupo de Máq**. Em **Cadastro → Importar CTs** (o quadro abre com um clique), escolha um arquivo `.xlsx` ou `.csv`, ou cole as linhas do Excel, com estas colunas:

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
- Também dá para cadastrar um CT por vez (**+ Nova máquina**: Seção, CT e Grupo; só o CT é obrigatório; entra com 1 vaga). Para mudar seção, CT, grupo ou vagas, use **Editar** na linha do CT. A máquina **não tem campo Nome**: o nome dela é o próprio CT.
- Os colaboradores também entram por planilha (próxima seção).

## Importar colaboradores (planilha)

Em **Cadastro → Importar colaboradores** (coluna da direita; o quadro abre com um clique), escolha um `.xlsx` ou `.csv`, ou cole as linhas do Excel, com estas colunas:

```
Nome          Turno     Seção      CT
Ana Souza     1         Eixos A    01061031/01061008
Bruno Lima    T2        Eixos A    01061031
Carla Dias    Turno 3   Eixos B
```

- A primeira linha pode ser o cabeçalho; as colunas são achadas pelo título (**Nome** ou Colaborador, **Turno**, **Seção**, **CT** ou Máquina), em qualquer ordem, e outras colunas (como Matrícula) são ignoradas. Sem cabeçalho, vale a ordem Nome, Turno e depois os CTs (a Seção só é lida com cabeçalho).
- **Turno**: 1, 2, 3, T1, "Turno 1" ou "1º turno".
- **Seção** (opcional): a seção de origem da pessoa. Ela vale enquanto a pessoa **não tem máquina**: fica na lista "Sem máquina" daquela seção, e só o chefe dessa seção a vê (o administrador vê todas). Quando a pessoa ganha uma máquina, a seção passa a vir das máquinas dela. Sem Seção, a pessoa sem máquina aparece para todos os chefes. O nome da seção é reconhecido sem diferença de maiúsculas ou acento ("eixos a" vira "Eixos A"); um nome que não existe aparece como **nova** na pré-visualização.
- **CT** (opcional): vários CTs para a mesma pessoa na mesma célula, separados por `/`, `|`, `,` ou `;`; em várias colunas de CT (CT 1, CT 2…); ou repetindo o nome em outras linhas (as máquinas são somadas).
- Quem já existe (mesmo nome, sem diferença de maiúsculas ou espaços) é **atualizado**: o turno muda se vier preenchido (em branco mantém o atual), a seção é trocada se vier preenchida e as máquinas são somadas, sem apagar as que a pessoa já tinha. **O nome identifica a pessoa**: se duas pessoas têm o mesmo nome, diferencie na planilha (por exemplo, com a matrícula entre parênteses).
- CT que está na planilha mas não no cadastro é criado na **Seção da linha** (com o CT como nome, 1 vaga e o grupo escolhido em "Grupo dos CTs novos", que fica em **Mais detalhes**); sem seção na linha, fica sem seção. CT que o Excel gravou sem os zeros à esquerda (1061031) é reconhecido como 01061031.
- **Chefe de seção** importando: só entram as linhas da seção dele; linha de outra seção aparece com "Seção fora do seu acesso" e não é importada. Linha sem Seção entra na seção dele.
- A pré-visualização mostra novos, atualizações (com a mudança de turno e quantas máquinas entram) e erros: nome vazio, turno inválido ou ausente (para quem é novo), mesmo nome com turnos ou seções diferentes, seção fora do acesso. Só as linhas válidas são importadas. No celular, cada pessoa vira um cartão.
- A lista "Sem máquina" do Cadastro mostra 40 pessoas por vez ("Mostrar mais"), com busca pelo nome e filtro por seção. Na **Escala**, quem está sem máquina aparece dentro da seção dele, em "Sem máquina definida" (fechado até você abrir); quem não tem seção fica no fim da página.

## Buscar máquina: seção, grupo ou CT

Em todo lugar onde se escolhe máquina há a mesma **janela de busca**: um campo no alto e, abaixo, a lista em **Seção › Grupo de máquinas › CT**.

- **Buscar**: digite parte do nome da seção, do grupo ou do CT (sem diferenciar maiúsculas e acentos). Várias palavras se combinam ("estria eixos b"). Letras soltas valem pelo começo da palavra, e 3 ou mais letras/números valem em qualquer trecho do CT ("031" acha 01061031). Um nome de seção ou de grupo digitado por inteiro ("eixos c") mostra só ele. A lista mostra até 500 máquinas; refine a busca para ver as demais.
- **Adicionar máquinas a uma pessoa** (Cadastro → Colaboradores sem máquina → **+ Máquinas**, ou **+ adicionar máquinas** na aba Colaboradores): marque uma **seção inteira**, um **grupo inteiro** ou só os **CTs** que quiser; com a busca ativa, marcar uma seção ou grupo escolhe só o que está aparecendo. O que a pessoa já tem aparece como "já tem". A seleção continua ao mudar a busca, e o botão do rodapé confirma ("Adicionar N máquina(s)"). As máquinas novas entram em ordem de seção, grupo e CT, depois das que a pessoa já tinha (a primeira, com ★, é o posto padrão na escala).
- **Novo colaborador**: o botão **+ Máquinas** do formulário abre a mesma janela. O nome e o turno digitados ficam enquanto você escolhe.
- **Na aba Colaboradores**: as máquinas de cada pessoa aparecem agrupadas por seção › grupo, com **remover grupo** para tirar um grupo inteiro de uma vez (pede confirmação).
- **Filtrar as telas**: ao lado do seletor **Seção** (Escala, Calendário, Presença e Colaboradores) há o botão **Buscar máquina…**. Clique em uma seção, em um grupo ou em um CT e a tela mostra só ele (e as pessoas treinadas nele); uma etiqueta "Grupo …" ou "CT …" com **×** limpa o filtro. Com grupo ou CT filtrado, os grupos aparecem abertos (dá para recolher). A escolha fica lembrada no navegador. Trocar a seção no seletor limpa o grupo e o CT.
- **Presença**: quando a pessoa tem máquinas em mais de um grupo, a lista "Máquina" vem agrupada por seção › grupo.
- A janela fecha com **Esc**, com o **×**, em **Cancelar** ou clicando fora. No celular ela sobe como uma folha na parte de baixo da tela.

O seletor **Seção** mostra só as máquinas da seção e as pessoas treinadas nelas, e os contadores passam a valer só para o filtro. A seção da pessoa vem das máquinas em que ela é treinada. **(sem seção)** mostra as máquinas sem seção e as pessoas sem máquina. Se nenhuma máquina tiver seção, o seletor de seção não aparece (a busca por grupo e CT continua).

## Escala: seção › grupo de máquinas › máquinas

No alto, uma **linha de resumo** (escalados, por turno, máquinas com operador e, se houver, conflitos) e o link **Como usar**, que abre 3 linhas de ajuda. A tela de escalar segue 3 níveis, para continuar curta mesmo com 100 CTs ou mais:

1. **Seção** (por exemplo, Eixos D), aberta por padrão, com quantas pessoas estão escaladas.
2. **Grupo de máquinas** (por exemplo, CHOQUE TÉRMICO), dentro da seção. Começa **fechado**; mostra ⚠ se houver conflito dentro dele.
3. **Máquinas**: ao abrir o grupo, aparece um cartão por CT, com as pessoas treinadas nela. Toque na pessoa para escalá-la naquela máquina; toque de novo para tirar. Quem tem mais de uma máquina aparece em todas; tocar em outra troca o posto.

Cada nível aparece **recuado para a direita** do anterior, com uma linha-guia. **Expandir tudo** e **Recolher tudo** (links no alto) abrem e fecham tudo. O que está aberto fica lembrado só no navegador de cada pessoa e é independente do calendário e do Cadastro. O filtro **Seção** e os botões **Todos / T1 / T2 / T3** continuam valendo.

**Nem toda máquina precisa de operador.** Máquina parada fica neutra, com gente escalada fica verde ("Com operador") e só o **conflito** (mais gente que vagas) aparece em vermelho e é contado no resumo.

## Turnos no sábado e no domingo

Sábado e domingo funcionam como qualquer outro dia: podem ter **os três turnos** trabalhando, cada pessoa com o turno do cadastro (T1, T2 ou T3), com os botões Todos / T1 / T2 / T3 e os indicadores por turno.

## Calendário: três jeitos de ver

O Calendário abre no **Mês**, pensado para entender de relance. Os botões **Mês · Semana · Por máquina** trocam a visão (a escolha fica lembrada no navegador), e ◀ ▶ **Hoje** navegam.

- **Mês** (padrão): uma grade de calendário. Cada dia mostra o **número de pessoas escaladas**, os totais por turno (T1, T2, T3; no celular viram bolinhas coloridas) e **⚠** se houver conflito. Dia com gente fica verde, dia com conflito fica vermelho, hoje tem o número destacado. **Toque num dia** e, logo abaixo, aparece o **painel do dia**: quem trabalha em cada turno, em qual CT, presença (✓ presente, ✗ faltou) e o botão **Abrir escala** (ou **Montar escala**, se o dia está vazio).
- **Semana**: sete cartões, um por dia, com os nomes de quem trabalha em cada turno. Toque no título do dia para abrir a escala dele.
- **Por máquina**: a matriz detalhada, para quem quer ver CT por CT. Tem duas colunas fixas (**Seção** e **Grupo de Máq · CT**) que abrem nos mesmos três níveis da Escala (seção › grupo › CT, com ▾/▸), **7 dias** ou **Mês inteiro**, e **Expandir tudo / Recolher tudo**. Verde = tem operador, vermelho = conflito.

O filtro **Seção** e o botão **Buscar máquina…** valem para as três visões. Na impressão, a visão **Por máquina** abre todas as seções e grupos.

## Colaboradores: lista enxuta que abre e fecha

A aba **Colaboradores** mostra só quem **já tem máquina**, em uma linha por pessoa: nome, turno (T1/T2/T3), seção(ões) e quantas máquinas. Tudo começa **fechado**; clique no nome (▸) para abrir e ver/editar:

- **Nome** e **turno** (a linha se atualiza na hora);
- as **máquinas em que a pessoa é treinada**, agrupadas por seção › grupo, com **×** para tirar uma máquina, "remover grupo" e **+ adicionar máquinas** (a mesma busca por seção, grupo ou CT; o ★ é o posto padrão na escala);
- **Remover colaborador**.

No alto da aba: busca por **nome, seção ou CT** (digite um CT e veja quem é treinado nele), botões **Todos / T1 / T2 / T3**, o seletor **Seção** com **Buscar máquina…** e, acima da lista, **Expandir tudo** e **Recolher tudo**. As linhas que você deixou abertas ficam lembradas neste navegador. A lista mostra até 200 pessoas por vez (use a busca para achar as demais); na impressão todas as linhas saem abertas.

**Quem está cadastrado mas ainda sem máquina não vai para esta aba**: continua no **Cadastro**, em "Sem máquina definida" (com **+ Máquinas**), e na **Escala**, no bloco "Sem máquina definida". Assim que a pessoa ganha a primeira máquina ela passa para a aba Colaboradores, e se perder a última volta para o Cadastro (o site avisa).

## Cadastro: máquinas à esquerda, colaboradores à direita

No computador o Cadastro tem **duas colunas**; no celular, uma só.

- **Máquinas**: lista que abre e fecha, **Seção › Grupo › CT**, tudo fechado no começo (cada linha mostra só o nome e a contagem de CTs). Use a **busca** (seção, grupo ou CT; abre sozinha o que encontrar), **Expandir tudo / Recolher tudo**, **Editar** (seção, CT, grupo e vagas; **Pronto** fecha) e **Remover**. **+ Nova máquina** abre um formulário de três campos (Seção, CT, Grupo). O que está aberto fica lembrado neste navegador.
- **Colaboradores**: formulário curto (nome, turno, **+ Máquinas**, Adicionar), um resumo ("N com máquina: veja na aba Colaboradores") e, logo abaixo, **Sem máquina** — quem ainda não tem máquina, com **+ Máquinas** e **Remover**. Os colaboradores que já têm máquina **não ficam em destaque aqui**: estão na aba Colaboradores.
- **Importar CTs** e **Importar colaboradores** ficam **recolhidos**: clique no título para abrir; **Mais detalhes** mostra as colunas aceitas. O Cadastro não usa o filtro de seção das outras telas.

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

**Colaboradores removidos** do cadastro não aparecem nos Indicadores (nem nas tabelas, nem nos totais e gráficos), então os números batem com a Escala e o Calendário. Os registros de presença em si continuam guardados no banco; só deixam de ser mostrados.

## No celular e na impressão

- **Presença** no celular vira uma lista de cartões, com os botões Presente e Faltou grandes e sem rolar para o lado.
- **Imprimir** (Ctrl+P): a tela da Escala sai sem menu e botões, só com as máquinas que têm gente escalada e as pessoas de cada uma. Seções e grupos fechados na tela são abertos sozinhos só para a impressão (o Calendário também). A Presença imprime a tabela do dia, com os botões de check-in como caixas para marcar à mão.
- **Remover** um CT ou uma pessoa do cadastro pede confirmação, porque a mudança vale para todos os gestores.
- No Calendário, abrir ou fechar seções e grupos mantém a posição da rolagem.

## Observações

- **Sem `ACCESS_KEY`**, qualquer pessoa com o link vê e edita a escala, que contém nomes de colaboradores (e não dá para criar usuários por seção).
- **Sem o binding `DB`**, o site abre, mas cada navegador guarda os dados só para si, e o cabeçalho mostra o motivo (veja a tabela abaixo).
- Os dados cadastrados em outras versões (claude.ai, Vercel) não vêm junto: recadastre ou use **Cadastro → Importar em lote**. Se o servidor estiver vazio e o navegador já tiver dados locais, o site os envia na primeira abertura. Se o servidor já tiver dados, eles substituem os do navegador; por isso, abra primeiro no computador cujos dados valem.
- **Dois gestores editando o mesmo dia ao mesmo tempo**: vale a última gravação. O site se atualiza sozinho a cada 8 segundos (e ao voltar para a aba), então o risco é só quando duas pessoas mexem no mesmo dia dentro desse intervalo.
- Para testar no seu computador: `npx wrangler dev --var ACCESS_KEY:meucodigo` (usa um banco local temporário).

## Instalar como aplicativo (PWA)

O site é um **PWA**: dá para instalar no celular ou no computador, com ícone próprio, abrindo em tela cheia, sem a barra do navegador. Nada muda no Cloudflare: o mesmo endereço `https://SEU-SITE.workers.dev` já serve o manifesto (`manifest.json`), os ícones e o service worker (`sw.js`), que ficam em `public/`.

**Como instalar**

- **Android (Chrome)** e **computador (Chrome ou Edge)**: abra o site e clique em **Instalar aplicativo** (aparece no cabeçalho, ao lado de "Atualizar"), ou use o menu do navegador → *Instalar aplicativo* / *Adicionar à tela inicial*.
- **iPhone/iPad (Safari)**: toque em **Compartilhar** → **Adicionar à Tela de Início**. (O botão "Instalar aplicativo" do cabeçalho mostra esse passo a passo.)

Depois de instalado, o ícone também tem **atalhos** (pressione e segure no Android): Escala, Presença e Colaboradores.

**Sem internet**

- O aplicativo **abre mesmo sem conexão**, com a **última cópia dos dados** que o aparelho sincronizou (a cada sincronização o site guarda uma cópia no aparelho). O cabeçalho avisa "Sem sincronização".
- O que você alterar sem conexão fica **guardado no aparelho** e o cabeçalho mostra "N a enviar". Quando a conexão volta (o site tenta de novo sozinho a cada 8 segundos e assim que a internet retorna), as alterações são **enviadas ao servidor automaticamente**, mesmo se você fechar e abrir o aplicativo antes.
- Atenção: o envio funciona como as demais gravações do site, a **última gravação vale**. Se outro gestor mudou o mesmo cadastro (ou o mesmo dia) enquanto você estava sem conexão, o que você enviar depois substitui a versão dele. Para o dia a dia isso é raro; se for editar muito sem internet, avise os outros gestores.
- Os dados nunca ficam no cache do aplicativo: a API (`/api/state`) sempre vai direto ao servidor.

**Atualizações**: com internet, o aplicativo sempre carrega a versão mais nova publicada (a página usa "rede primeiro"); sem internet, usa a última que abriu. Se a rede estiver muito lenta (mais de 4 segundos), ele abre a cópia guardada. Para forçar a atualização de um aplicativo que ficou aberto por dias, feche e abra de novo.

**Para quem mexe no código**: se mudar a lista de arquivos guardados em `sw.js` (constante `SHELL`) troque também o nome do cache (`V`), para os aparelhos apagarem o cache antigo. Os ícones são gerados a partir de `public/icon.svg`.

## O cabeçalho diz se está sincronizando

Logo abaixo do título, o site mostra o estado da conexão com o servidor em uma linha. O link **Atualizar** (ou **Tentar de novo**, quando há erro) força uma nova tentativa.

| Mensagem | O que significa | O que fazer |
| --- | --- | --- |
| ● Sincronizado às HH:MM | Funcionando; os dados são compartilhados entre os gestores. | Nada. |
| ⚠ Sem sincronização: banco de dados não ligado | O Worker roda, mas não encontra o binding `DB`. | Confira o bloco `d1_databases` do `wrangler.jsonc` (binding `DB`, nome e ID do banco), envie o commit e aguarde o deploy. |
| ⚠ Sem sincronização: API não encontrada | O site está no ar, mas o código da API não foi publicado (por exemplo, o projeto é Pages ou falta o `wrangler.jsonc`). | Confira se `wrangler.jsonc` e `src/worker.js` estão na raiz do repositório e se o `name` do arquivo é igual ao do Worker; veja o resultado do build. |
| ⚠ Entre para continuar | O `ACCESS_KEY` está definido e o navegador ainda não entrou, ou a sessão terminou (senha trocada, 14 dias). | Clique em **Entrar** e use usuário e senha (ou **Sou administrador** e o código). |
| ⚠ Muitas tentativas, aguarde | Senha ou código errados várias vezes seguidas. | Espere alguns minutos e tente de novo. |
| ⚠ Sem sincronização: sem conexão | Rede fora do ar ou erro no servidor. Suas alterações ficam salvas no aparelho ("N a enviar") e são enviadas quando a sincronização voltar. | Tente de novo; veja os logs do Worker em **Observability**. |

Você também pode abrir `https://SEU-SITE.workers.dev/api/state` no navegador: `{"error":"storage_not_configured"}` indica binding ausente; `{"error":"unauthorized"}` indica que o banco está ligado e falta só o código; uma página 404 indica que a API não foi publicada.
