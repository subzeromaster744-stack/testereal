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
