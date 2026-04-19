# Native mobile deployment checklist (App Store + Google Play)

Use this when you are ready to ship **Capacitor** builds of Whacked alongside the web app. The web app deploys from **Vercel**; store apps are built and uploaded from **Android Studio** and **Xcode** (or CI with the right runners).

**Prerequisites in this repo**

- [Capacitor config](../capacitor.config.ts): `appId` (`app.whacked.game`), `appName`, `webDir: dist`.
- [README – Mobile (Capacitor)](../README.md) for day-to-day `build:cap` and IDE commands.

---

## Shared (before either store)

- [ ] **Decide final bundle IDs** — `app.whacked.game` (or your real IDs) must match what you register in Apple Developer + Google Play. Changing later is painful; update `capacitor.config.ts` and regenerate native projects if you change after `cap add`.
- [ ] **Supabase production** — same project/keys as web; `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be present in the shell (or `.env.production`) when you run `npm run build:cap` so they are baked into the bundle.
- [ ] **Legal / product** — privacy policy URL, support email, age rating, data collection (for store forms). Align with what Supabase and your API actually collect.
- [ ] **Smoke test a release build on device** — after `npm run build:cap`, install a debug/release build and run: auth, lobby, game, profile, API calls (same-origin rules: app talks to Supabase + your hosted API as configured in the bundle).

---

## Google Play (Android)

### Accounts and console

- [ ] **Google Play Developer account** — one-time registration fee.
- [ ] **Create the app** in [Play Console](https://play.google.com/console) — package name must **exactly match** the Android application id (see `android/app/build.gradle` / manifest; derived from Capacitor `appId`).

### Signing

- [ ] **Upload key** — use Play App Signing (recommended). Create an **upload keystore** (.jks or .keystore) and store passwords securely (password manager). **Losing the upload key** blocks updates until you go through Play support.
- [ ] **Signing config in Android Studio** — Build → Generate Signed App Bundle / APK; prefer **Android App Bundle (AAB)** for Play.

### Build and upload

- [ ] **On machine with Android Studio** — `git pull`, install deps `npm ci`, set env vars, run `npm run build:cap`.
- [ ] **Open Android** — `npm run cap:open:android` (or open `android/` folder).
- [ ] **Release build** — e.g. Build Variants `release`, minify if configured, build **signed AAB**.
- [ ] **Play Console** — Production or **Internal / Closed testing** first: create release, upload AAB, fill release notes.
- [ ] **Store listing** — title, short/full description, screenshots (phone + 7" tablet if required), feature graphic, icon.
- [ ] **Data safety form** — declare data types (account, device IDs, etc.) consistently with the app.
- [ ] **Review** — submit for review; fix policy rejections if any.

### Ongoing

- [ ] **Version bumps** — increment `versionCode` / `versionName` in `android/app/build.gradle` (or via tooling) each store upload.
- [ ] **After web changes** — always `npm run build:cap` before a new AAB so the WebView ships fresh `dist/`.

---

## Apple App Store (iOS)

### Machine and tooling

- [ ] **Mac with Xcode** (current stable, matching Capacitor 7 docs).
- [ ] **Apple Developer Program** — paid membership.
- [ ] **CocoaPods** — install per [Capacitor iOS environment](https://capacitorjs.com/docs/getting-started/environment-setup#ios-requirements).
- [ ] **Add iOS platform** (if not in repo yet) — from repo root: `npx cap add ios` then `npm run build:cap`.

### Identifiers and signing

- [ ] **App ID** in [Apple Developer](https://developer.apple.com/account) — bundle ID matches Xcode / Capacitor (e.g. `app.whacked.game`).
- [ ] **Certificates & provisioning** — Xcode “Automatically manage signing” with your team, or manual profiles for release.
- [ ] **App Store Connect** — create app record, bundle ID, SKU, primary language.

### Build and upload

- [ ] **On Mac** — `git pull`, `npm ci`, env vars set, `npm run build:cap`.
- [ ] **Open iOS** — `npm run cap:open:ios` (opens `.xcworkspace` if CocoaPods is used).
- [ ] **Archive** — Product → Archive; when done, **Distribute App** → App Store Connect.
- [ ] **App Store Connect** — upload build, wait for processing; select build in the version you want to release.
- [ ] **Listing** — screenshots (required device sizes), description, keywords, privacy policy URL, **App Privacy** questionnaire.
- [ ] **Compliance** — export rules, encryption, ATT if you add tracking ads later, etc.
- [ ] **Submit for review** — then release manually or automatically after approval.

### Ongoing

- [ ] **Version / build** — bump in Xcode (Marketing version + Build) each submission.
- [ ] **Same as Android** — rebuild web + `cap sync` whenever shipping new web logic.

---

## Optional next phases

- [ ] **CI** — GitHub Actions: job builds `npm run build:cap`, caches Gradle/Pods; separate **Mac** runner for iOS archive/sign (secrets: certs, App Store Connect API key).
- [ ] **Deep links / OAuth** — if you add Google/Apple sign-in, configure **universal links** + Supabase redirect URLs for the native app scheme.
- [ ] **@capacitor/splash-screen / status-bar** — polish for first paint and safe areas.
- [ ] **Beta distribution** — Play internal testing + TestFlight before production.

---

## Quick command reference

```bash
# From repo root, with VITE_* set in environment:
npm run build:cap      # web build + copy to android/ (and ios/ if present)
npm run cap:open:android
npm run cap:open:ios   # macOS only, after `npx cap add ios`
```

---

## Web vs native (mental model)

| What | Where it deploys |
|------|------------------|
| `git push` + Vercel | **Website** |
| Signed **AAB** + Play Console | **Android app** |
| **Archive** + App Store Connect | **iOS app** |

All three can point at the **same** Supabase project and backend; only the **client bundle** and **store metadata** differ per channel.
