# Escala de Hora Extra — Cloudflare Pages + D1

Site para os gestores montarem a escala de hora extra por máquina, registrarem presença e refeição e acompanharem indicadores.

```
public/index.html        o site (HTML, CSS e JavaScript em um arquivo só)
functions/api/state.js   a API que guarda os dados no banco D1
```

Os dados ficam no **D1** (banco da Cloudflare) e são compartilhados entre todos os gestores: o site consulta o servidor a cada 8 segundos e só baixa os dados quando algo mudou. A função cria a tabela sozinha na primeira chamada, então não há script de banco para rodar.

## 1. Enviar para o GitHub

Crie um repositório **vazio** em https://github.com/new (sem README, sem .gitignore; pode ser privado) e, dentro desta pasta, rode:

```bash
git remote add origin https://github.com/SEU-USUARIO/escala-hora-extra.git
git push -u origin main
```

## 2. Criar o banco D1

No painel da Cloudflare, abra a área de **D1** e crie um banco, por exemplo `escala-hora-extra`. Não precisa criar tabelas.

## 3. Criar o projeto no Cloudflare Pages

1. **Workers & Pages → Create application → Pages → Import an existing Git repository**.
2. Autorize o acesso ao GitHub e escolha o repositório (se for privado, libere-o na tela de autorização).
3. Em **Set up builds and deployments**:
   - **Production branch:** `main`
   - **Build command:** `exit 0` (não há etapa de build; isso mantém as Functions ativas)
   - **Build output directory:** `public`
4. Clique em **Save and Deploy**.

A pasta `functions/` fica na raiz do repositório (fora de `public/`); a Cloudflare a publica em `/api/state` automaticamente.

## 4. Ligar o banco e definir o código de acesso

No projeto, abra **Settings**:

1. **Bindings → Add → D1 database**: em *Variable name* use exatamente `DB` e escolha o banco criado no passo 2.
2. **Variables and Secrets → Add**: nome `ACCESS_KEY`, marque como **Secret** e informe um código que só os gestores conheçam.
3. Faça um novo deploy (**Deployments →** os três pontos do último deploy **→ Retry deployment**, ou envie qualquer commit). O binding só vale a partir do próximo deploy.

Cada gestor digita o código uma vez, na primeira abertura, e o navegador o guarda.

## Observações

- **Sem `ACCESS_KEY`**, qualquer pessoa com o link vê e edita a escala, que contém nomes de colaboradores.
- **Sem o binding `DB`**, o site abre, mas cada navegador guarda os dados só para si (o cabeçalho mostra "Dados salvos apenas neste navegador").
- Os dados cadastrados em outras versões (claude.ai, Vercel) não vêm junto: recadastre ou use **Cadastro → Importar em lote**. Se o servidor estiver vazio e o navegador já tiver dados locais, o site os envia na primeira abertura.
- Para testar no seu computador: `npx wrangler pages dev public --d1=DB` (cria um banco local temporário).
