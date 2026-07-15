# Projects Dashboard — deployment guide

This is your to-do dashboard, packaged as a normal web app so it lives outside
Claude with its own URL, and syncs across every device you sign into.

Two free accounts needed: **Supabase** (database) and **Netlify** (hosting).
Total time: about 15 minutes.

---

## 1. Create the database (Supabase)

1. Go to https://supabase.com → sign up (free) → **New project**.
2. Pick any project name and password (you won't need the password day to day).
3. Wait ~1 minute for the project to finish setting up.
4. In the left sidebar, click **SQL Editor** → **New query**.
5. Open `supabase_schema.sql` (included in this folder), copy all of it, paste it
   into the editor, click **Run**. This creates the table that stores your data
   and locks it so only you can read your own rows.
6. In the left sidebar, click **Project Settings** → **API**.
7. Copy two values, you'll need them in step 3:
   - **Project URL**
   - **anon public** key

## 2. Turn on email sign-in

1. Still in Supabase: **Authentication** → **Providers** → make sure **Email** is enabled (it is by default).
2. **Authentication** → **URL Configuration** → set **Site URL** to the Netlify URL
   you'll get in step 4 (you can come back and fill this in after deploying).

## 3. Add your keys to the project

1. In this folder, create a new file named exactly `.env`
2. Paste this in, replacing with your real values from step 1.6:

   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. Save the file. (This file is already excluded from git via `.gitignore`, so
   your key won't accidentally get published if you push this to GitHub.)

## 4. Deploy (Netlify)

**Recommended path — connect to GitHub (auto-updates on every future change):**

1. Push this folder to a new GitHub repository (Netlify can also walk you
   through creating one if you don't have it set up yet).
2. Go to https://netlify.com → sign up (free) → **Add new site** → **Import an existing project**.
3. Choose **GitHub** and select your repo.
4. Netlify will detect it's a Vite project. Confirm these build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Before clicking Deploy, click **Add environment variables** and add the same
   two from step 3: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
6. Click **Deploy site**. In about a minute you'll get a live URL like
   `random-name-123.netlify.app` (you can rename it in **Site settings** → **Change site name**).
7. Go back to Supabase → **Authentication** → **URL Configuration** → set
   **Site URL** to that Netlify URL.

From now on, any time you push a change to that GitHub repo, Netlify rebuilds
and redeploys automatically — no manual steps needed.

**Simpler path — drag and drop (no GitHub, but manual redeploys):**

This needs Node.js installed on your computer first (https://nodejs.org — grab
the LTS version, it's a normal installer).

1. Open a terminal in this folder and run:
   ```bash
   npm install
   npm run build
   ```
   This creates a `dist` folder — that's your finished, deployable app.
2. Go to https://app.netlify.com/drop
3. Drag the `dist` folder onto the page. Netlify gives you a live URL immediately.
4. Go to **Site settings** → **Environment variables**, add the same two keys
   from step 3, then **Deploys** → **Trigger deploy** so the app picks them up.
5. Go back to Supabase → **Authentication** → **URL Configuration** → set
   **Site URL** to that Netlify URL.

With this path, every future update means repeating steps 1–3 by hand — the
GitHub path above is worth it if you plan to keep iterating.

## 5. Sign in and add it to your phone

1. Open your new URL on your phone and on your computer.
2. Type your email, tap **Send sign-in link**, open the email, tap the link —
   you're in. No password to remember.
3. **On iPhone (Safari):** tap Share → **Add to Home Screen**.
   **On Android (Chrome):** tap the ⋮ menu → **Add to Home screen** / **Install app**.
4. You now have an app icon that opens straight to your dashboard — same data,
   any device, as long as you're signed into the same email.

---

## Updating the app later

If you want changes later, come back to Claude, ask for the update, download
the new file, and redeploy. If you're connected to GitHub, just push the
change and Netlify redeploys automatically. If you used the drag-and-drop
path, repeat `npm install && npm run build` and drag the new `dist` folder to
https://app.netlify.com/drop again.

## Costs

Both Supabase and Netlify free tiers are generous for a personal tool like this
— you're extremely unlikely to hit any limits with normal day-to-day use.
