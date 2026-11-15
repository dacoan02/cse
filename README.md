# Consiliul Școlar al Elevilor – aplicație de management

Aplicație web (Next.js 16 + Supabase) pentru conducerea și Adunarea Generală a unui Consiliu Școlar al Elevilor: ședințe, prezență și cvorum automat, voturi, „Vocea reprezentanților”, proiecte, calendar, anunțuri, documente, statistici/rapoarte, jurnal de audit și măsuri administrative.

Interfața este în limba română. Rolurile (Președinte, Secretar executiv, Vicepreședinți, Elev reprezentant) se atribuie doar prin invitație.

## 1. Configurare Supabase

1. Creează un proiect pe https://supabase.com.
2. În **SQL Editor** rulează, în ordine, fișierele din `supabase/migrations/`:
   `001_schema.sql`, `002_functions.sql`, `003_rls.sql`, `004_announcement_files.sql`.
   (Bucket-ul privat `documents` este creat de `003_rls.sql`.)
3. **Authentication → URL Configuration**: setează *Site URL* la adresa aplicației și adaugă `…/auth/callback` la *Redirect URLs*.
4. **Authentication → SMTP**: configurează un server de e-mail propriu pentru invitații și recuperarea parolei (serverul implicit Supabase are limite foarte mici).
5. Dacă folosești Realtime, activează-l pentru tabelele folosite (implicit sunt incluse în migrații acolo unde e nevoie).

## 2. Variabile de mediu

Copiază `.env.example` în `.env.local` și completează:

| Variabilă | Rol |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | conectare client (publice; protecția vine din RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | doar pe server: invitații și configurarea inițială. **Nu o expune în browser.** |
| `NEXT_PUBLIC_SITE_URL` | adresa publică (linkuri din invitații) |
| `SETUP_TOKEN` | opțional: cod cerut la prima configurare |
| `CRON_SECRET` | secret pentru `/api/cron` |

## 3. Pornire

```bash
npm install --legacy-peer-deps
npm run dev          # dezvoltare
npm run build && npm start   # producție
```

La prima rulare deschide **/setup**: se creează instituția și contul Președintelui. După aceea, toate conturile se creează prin invitații din *Adunarea Generală* și *Setări*.

## 4. Mementouri automate (cron)

Mementourile de ședință și alte sarcini programate rulează prin `run_scheduled_jobs`. Programează un apel la fiecare 5–15 minute:

```
GET https://<domeniu>/api/cron
Authorization: Bearer <CRON_SECRET>
```

(Vercel Cron, GitHub Actions sau orice serviciu de cron). Paginile aplicației apelează și ele aceeași funcție, deci notificările nu rămân blocate dacă cron-ul lipsește temporar.

## 5. Teste

Regulile din baza de date (cvorum, vot secret, RLS, ciclul de viață al ședințelor etc.) sunt testate pe Postgres local (PGlite), fără cont Supabase:

```bash
node supabase/tests/db.test.mjs
```

## 6. Note de funcționare

- **Cvorum** = ⌊număr reprezentanți activi / 2⌋ + 1. Doar „Prezent” contează; cine nu răspunde nu e prezent. Starea apare ca text („CVORUM ÎNTRUNIT / NEÎNTRUNIT”), nu doar ca culoare, și se păstrează la închiderea ședinței.
- **Vot secret**: nu există nicio legătură între votant și opțiune; se reține doar faptul că persoana a votat.
- **Măsurile administrative** (mustrare, avertisment, demitere) sunt doar o evidență; nu înlocuiesc procedura oficială. Documentele aferente sunt vizibile doar Președintelui și celui care le-a încărcat.
- **Date demo** sunt marcate și pot fi șterse din *Setări*.
- **Anul școlar nou** se pornește din *Setări* fără pierderea istoricului.
- Rapoartele (PDF, Excel, CSV) cer permisiunea „statistici”.

## 7. Ce nu a fost verificat

Aplicația a fost verificată prin compilare, build, teste de bază de date și rularea paginii de login. Fluxurile complete (invitații pe e-mail, încărcări de fișiere în Storage, Realtime) necesită un proiect Supabase real și trebuie parcurse o dată manual pentru fiecare rol după configurare.
