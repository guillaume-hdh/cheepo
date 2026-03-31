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

Un exemple minimal est fourni dans `.env.example`.

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

Le workflow GitHub Actions lint, compile l application puis deploie `dist/` sur Hostinger.

Les secrets necessaires cote GitHub sont:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SFTP_SERVER`
- `SFTP_USER`
- `SFTP_PASS`

Ne mets pas `SUPABASE_SERVICE_ROLE_KEY` dans GitHub Actions: cette cle reste locale / admin.

### Mise en ligne

1. Dans GitHub, ouvre `Settings > Secrets and variables > Actions`.
2. Cree ou mets a jour les 5 secrets ci-dessus.
3. Verifie dans Hostinger que le dossier cible du sous-domaine `app.cheepo.fr` est bien `app/`.
4. Pousse sur `main`.
5. Dans GitHub, ouvre l onglet `Actions` et attends le workflow `Build & Deploy to Hostinger`.
6. Quand le job est vert, recharge `https://app.cheepo.fr/` en navigation privee.

## Structure Supabase

Le repo versionne desormais le point de depart du backend dans:

- `supabase/migrations/0001_initial.sql`
- `supabase/migrations/0002_roles_and_activity.sql`
- `supabase/migrations/0003_fix_activity_trigger.sql`
- `supabase/migrations/0004_event_management_and_invitations.sql`

Le front attend notamment:

- `profiles`
- `events`
- `event_members`
- `catalog_items`
- `eat_selections`
- `bring_items`
- `shopping_additions`
- les fonctions RPC `create_event`, `join_event_by_code`, `get_event_members`, `get_shopping_remaining`

## V2

La V2 ajoute:

- un role `Super-Admin` via la table `public.platform_admins`
- un journal des modifications via `public.event_activity_log`
- des permissions etendues pour l hote sur son evenement
- des invitations suivies par email dans `public.event_invitations`
- l archivage, la duplication et le transfert d hote

### Activation SQL V2

1. Execute `supabase/migrations/0002_roles_and_activity.sql`, `supabase/migrations/0003_fix_activity_trigger.sql` puis `supabase/migrations/0004_event_management_and_invitations.sql` dans le SQL Editor du projet Supabase.
2. Donne-toi le role Super-Admin avec ton email:

```sql
insert into public.platform_admins (user_id)
select id
from public.profiles
where email = 'ton-email@exemple.com'
on conflict do nothing;
```

3. Reconnecte-toi a l application pour recharger tes permissions.

### V2.1

La V2.1 ajoute:

- un onglet `Gestion` pour l hote / le super-admin
- l envoi d invitations via le client mail local (`mailto:`) avec suivi d etat
- l archivage / reactivation d un evenement
- la duplication d un evenement avec reprise de la liste de courses manuelle
- le transfert du role d hote a un autre membre
- une meilleure localisation du journal des modifications
