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
- CTs que já existem são **atualizados** (seção e grupo); o nome e as vagas que você ajustou ficam. Seção em branco na planilha não apaga a seção já cadastrada. CTs novos entram com 1 vaga e com o CT como nome.
- Arquivos `.xls` antigos não são lidos: salve como `.xlsx` ou `.csv`.
- Também dá para cadastrar um CT por vez, e a seção, o CT, o nome e o grupo podem ser editados na tabela.
- Na importação de colaboradores em lote, as máquinas podem ser indicadas pelo CT ou pelo nome.

O seletor **Seção** (nas telas Escala, Calendário, Presença e Cadastro) mostra só as máquinas da seção e as pessoas treinadas nelas, e os contadores passam a valer só para a seção. A seção da pessoa vem das máquinas em que ela é treinada. A escolha fica lembrada no navegador. **(sem seção)** mostra as máquinas sem seção e as pessoas sem máquina. Se nenhuma máquina tiver seção, o seletor não aparece.

## Calendário: seção, grupo de máquinas e CTs

O calendário (semana ou mês) tem duas colunas fixas à esquerda: **Seção** e **Grupo de Máq · CT**. A estrutura abre em três níveis:

1. **Seção** (por exemplo, Eixos D): uma linha com o total de pessoas de cada dia e quantas máquinas estão cobertas. Clique em ▾/▸ para recolher ou abrir a seção. As seções começam abertas; "(sem seção)" fica por último.
2. **Grupo de máquinas** (por exemplo, CHOQUE TÉRMICO), dentro da seção. Começa fechado. O mesmo grupo em duas seções aparece separado em cada uma.
3. **CT**: ao abrir o grupo, aparece uma linha por CT, com o código em destaque, o nome (se for diferente), as vagas e as pessoas escaladas em cada dia, com turno e presença.

**Expandir tudo** abre seções e grupos e mostra todos os CTs; **Recolher tudo** deixa só as linhas das seções. O filtro **Seção** da barra continua valendo. Se nenhuma máquina tiver seção, a coluna Seção não aparece. O que está aberto fica lembrado só no navegador de cada pessoa.

## Turnos: sábado e domingo são turno único

Cada pessoa tem o turno dela no cadastro (T1, T2 ou T3), e esse turno continua aparecendo ao lado do nome. Mas na Escala, **no sábado e no domingo só um turno trabalha**, então nesses dias aparecem juntas, em cada máquina, as pessoas de todos os turnos (em ordem de T1, T2, T3). Os botões T1/T2/T3 e os indicadores por turno somem, e uma vaga conta para qualquer turno: duas pessoas de turnos diferentes na mesma máquina de 1 vaga dão conflito.

- Em dias úteis nada muda: continuam os botões **Todos / T1 / T2 / T3** para filtrar.
- A chave **Turno único** (dia útil) e **Filtrar por turno** (sábado/domingo) muda o modo só naquele dia, por exemplo para um feriado. A escolha é gravada junto com a escala do dia e vale para todos os gestores.

## Observações

- **Sem `ACCESS_KEY`**, qualquer pessoa com o link vê e edita a escala, que contém nomes de colaboradores.
- **Sem o binding `DB`**, o site abre, mas cada navegador guarda os dados só para si, e o cabeçalho mostra o motivo (veja a tabela abaixo).
- Os dados cadastrados em outras versões (claude.ai, Vercel) não vêm junto: recadastre ou use **Cadastro → Importar em lote**. Se o servidor estiver vazio e o navegador já tiver dados locais, o site os envia na primeira abertura. Se o servidor já tiver dados, eles substituem os do navegador; por isso, abra primeiro no computador cujos dados valem.
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
