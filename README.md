# Cheepo

Cheepo est une application web pour organiser un barbecue en groupe.

La V1 permet de:

- creer un evenement et generer un code d invitation
- rejoindre un evenement avec un code ou un lien
- declarer ce que chacun prevoit de manger
- declarer ce que chacun apporte
- suivre ce qu il reste a acheter

## Stack

- React 19
- TypeScript
- Vite
- Supabase Auth + Postgres + RPC SQL
- Tailwind CSS v4 pour la couche de base
- theme applicatif dans `src/theme.css`

## Mise en route

1. Cree le schema Supabase en executant le fichier `supabase/migrations/0001_initial.sql` dans le SQL Editor du projet Supabase.
2. Renseigne les variables locales dans `.env.local`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. Installe les dependances:

```bash
npm install
```

4. Lance le projet:

```bash
npm run dev
```

## Verifications utiles

```bash
npm run lint
npm run build
```

## Deploiement

Le workflow GitHub Actions compile l application puis deploie `dist/` sur Hostinger.

Les secrets necessaires cote GitHub sont:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SFTP_SERVER`
- `SFTP_USER`
- `SFTP_PASS`

## Structure Supabase

Le repo versionne desormais le point de depart du backend dans:

- `supabase/migrations/0001_initial.sql`

Le front attend notamment:

- `profiles`
- `events`
- `event_members`
- `catalog_items`
- `eat_selections`
- `bring_items`
- `shopping_additions`
- les fonctions RPC `create_event`, `join_event_by_code`, `get_event_members`, `get_shopping_remaining`
