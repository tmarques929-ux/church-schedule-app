# Igreja Scheduler

Este projeto é um aplicativo web completo para geração automática de escalas de celebrações de uma igreja. Foi desenvolvido com **Next.js 14**, **TypeScript**, **Tailwind CSS**, **shadcn/ui** e **Supabase** (Postgres + Auth + RLS). A aplicação permite cadastrar ministérios, bandas, membros, famílias, celebrações e disponibilidades, executar um algoritmo de geração de escala em pirâmide (Bandas → Multimídia, Áudio e Iluminação) e publicar as escalas.

## Sumário

1. [Pré‑requisitos](#pré‑requisitos)
2. [Setup local](#setup-local)
3. [Scripts SQL](#scripts-sql)
4. [Ambiente de Desenvolvimento](#ambiente-de-desenvolvimento)
5. [Supabase e RLS](#supabase-e-rls)
6. [API e OpenAPI](#api-e-openapi)
7. [Testes](#testes)
8. [Deploy](#deploy)
9. [Exportação de escalas](#exportação-de-escalas)

## Pré‑requisitos

* Node.js 18 ou superior
* npm ou pnpm
* [Supabase CLI](https://supabase.com/docs/guides/cli) para rodar o Postgres localmente ou acesso a um projeto Supabase

## Setup local

1. Clone este repositório e copie o arquivo `.env.example` para `.env.local`, preenchendo as chaves do seu projeto Supabase:

   ```sh
   cp .env.example .env.local
   # edite .env.local com NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY
   ```

2. Instale as dependências:

   ```sh
   npm install
   ```

3. Configure o banco de dados usando a CLI do Supabase ou via o dashboard. Execute as migrações SQL em `sql/01_schema.sql`, `sql/02_policies.sql`, `sql/03_seeds.sql` e finalize com `sql/04_profiles_username.sql`:

   ```sh
   supabase db push
   psql "$SUPABASE_DB_URL" -f sql/01_schema.sql
   psql "$SUPABASE_DB_URL" -f sql/02_policies.sql
  psql "$SUPABASE_DB_URL" -f sql/03_seeds.sql
  psql "$SUPABASE_DB_URL" -f sql/04_profiles_username.sql
   ```

  Os scripts criam as tabelas, habilitam Row Level Security e adicionam policies seguras. O arquivo `03_seeds.sql` popula o banco com dados de exemplo (bandas, membros, famílias, celebrações e disponibilidades) para fins de demonstração. O script `04_profiles_username.sql` adiciona a coluna `username` nos perfis, garante unicidade e define o usuário administrador `thiagomrib`.

4. Execute a aplicação em ambiente de desenvolvimento:

   ```sh
   npm run dev
   ```

   A aplicação rodará em `http://localhost:3000`.

## Scripts SQL

Os arquivos na pasta `sql/` seguem esta ordem:

* **01_schema.sql** – define a estrutura das tabelas, chaves e constraints.
* **02_policies.sql** – habilita RLS e define policies para ADMIN e MEMBER conforme as regras.
* **03_seeds.sql** — cria dados de exemplo: Bandas A/B, membros (com famílias), ministérios, papéis, celebrações e disponibilidades.
* **04_profiles_username.sql** — adiciona a coluna `username`, gera valores padrão e adiciona constraint de unicidade.

Antes de executar os scripts, certifique‑se de ter criado as extensões necessárias no Supabase (por exemplo, `pgcrypto` para UUIDs) caso use tipos personalizados.

## Ambiente de Desenvolvimento

A aplicação utiliza o **App Router** do Next.js. Os arquivos de UI ficam na pasta `app/`, enquanto os serviços de domínio estão em `lib/`. As rotas de API são implementadas como **Route Handlers** em `app/api/*`.

O Supabase é acessado por meio de `@supabase/auth-helpers-nextjs` para autenticação e `@supabase/supabase-js` para operações em banco. A função de geração de escala em pirâmide está implementada em `lib/scheduleGenerator.ts` e chamada na rota `app/api/schedules/generate/route.ts`.

### Autenticação

O Supabase Auth continua utilizando senha, porém o acesso no app é feito informando o **username** (que é resolvido para o e-mail interno gerado automaticamente) ou, opcionalmente, o e-mail. A tabela `profiles` armazena o username, o papel (`role`) e outras informações do usuário. Os papéis disponíveis são `ADMIN` e `MEMBER`.

### UI/UX

Este projeto utiliza **Tailwind CSS** e componentes **shadcn/ui** para um layout responsivo. Formulários são gerenciados com **React Hook Form** e validados com **Zod**. A interface contém páginas para login/registro, dashboard de admin, cadastro de entidades, marcação de disponibilidades e geração/visualização de escalas.

## Supabase e RLS

Todas as tabelas sensíveis têm RLS habilitado. As policies definem que:

* Usuários com papel `ADMIN` podem ler, inserir, atualizar e deletar qualquer registro.
* Usuários com papel `MEMBER` podem ler escalas publicadas (`schedule_runs.status = 'published'`), ver e editar apenas suas disponibilidades (`availabilities.member_id = auth.uid()`), e visualizar apenas seus próprios assignments.

Consulte `sql/02_policies.sql` para o texto completo das policies.

## API e OpenAPI

A API foi documentada em OpenAPI (YAML) no arquivo `openapi.yaml`. O backend expõe os seguintes endpoints principais:

* `POST /api/celebrations` – cria, atualiza ou deleta celebrações.
* `POST /api/availabilities` – marca ou atualiza disponibilidade do membro logado.
* `POST /api/schedules/generate?month=YYYY-MM` – executa o algoritmo de geração de escala, com opções para regenerar apenas um ministério ou preservar posições bloqueadas.
* `POST /api/schedules/publish` – publica uma escala (altera o status do schedule_run para `published`).
* `GET /api/schedules/:id` – retorna detalhes de uma escala específica.

Os serviços de domínio que acessam a base de dados via Supabase encontram-se em `lib/services/*`. O algoritmo de escala está em `lib/scheduleGenerator.ts`.

## Testes

Os testes estão localizados em `tests/` e utilizam **Vitest** e **React Testing Library**. Um teste básico (`tests/scheduleGenerator.test.ts`) garante que a lógica de geração distribui funções de forma equitativa respeitando disponibilidades e vínculos familiares.

Execute os testes com:

```sh
npm test
```

## Deploy

### Supabase

Crie um projeto no Supabase e carregue os scripts SQL. Configure as variáveis do ambiente (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`) no ambiente de produção (ex.: Vercel). Certifique‑se de ativar as Regras de Linha (RLS) no Supabase.

### Vercel

Você pode implantar a aplicação na Vercel com o seguinte passo a passo:

1. Faça login no Vercel e importe este repositório.
2. Defina as variáveis de ambiente do Supabase na aba “Environment Variables”.
3. Ajuste o comando de build para `npm run build` e o diretório de saída para `.next` (padrão do Next.js).
4. Após o deploy, a aplicação estará disponível no domínio fornecido pela Vercel.

## Exportação de escalas

Após publicar uma escala, você poderá exportá‑la em PDF ou CSV. O endpoint `GET /api/schedules/:id` aceita um parâmetro `format` (`pdf` ou `csv`) para retornar o arquivo no formato desejado. A implementação de exportação baseia‑se na biblioteca [pdf-lib](https://github.com/Hopding/pdf-lib) para gerar PDFs e na API `csv-stringify` para CSV.

---

Este projeto serve como ponto de partida para a automatização das escalas da sua igreja. Sinta‑se à vontade para expandir a lógica de geração, adicionar novos ministérios ou personalizar a interface de acordo com as necessidades da sua comunidade.
