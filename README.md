# PassVault

PassVault is a password vault with PostgreSQL persistence, a React/Vite frontend, and an Express backend.

Sensitive vault data is encrypted in the browser before it is synced to PostgreSQL. The server stores ciphertext, while the decryption key is derived from the master password after unlock.
Existing legacy vaults are upgraded automatically the first time you unlock them after this change.

## Local development

Install dependencies:

```bash
npm install --prefix backend
npm install --prefix frontend
```

Create a root `.env` file:

```env
DATABASE_URL=postgres://passvault_user:passvault_secret@localhost:5432/passvault
GEMINI_API_KEY=your-gemini-api-key
PORT=3001
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:5173
EMAIL_PROVIDER=smtp
EMAIL_FROM=PassVault <no-reply@example.com>
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-brevo-smtp-login
SMTP_PASSWORD=your-brevo-smtp-key
```

If you want account verification by email, the backend sends a one-time code before creating the vault. For a free setup, Brevo's SMTP relay is a good fit.

Run the local stack:

```bash
npm run dev
```

This starts:
- PostgreSQL in Docker
- the backend on `http://localhost:3001`
- the frontend on `http://localhost:5173`

## GHCR deployment

The repository is configured to build and publish a Docker image to:

```text
ghcr.io/barroso88/passvault:latest
```

The publish workflow runs on pushes to `main` and on version tags.

Build steps:
- GitHub Actions builds the image from [`Dockerfile`](./Dockerfile)
- the frontend is compiled during the image build
- the backend serves the compiled frontend and the API from the same container

## Unraid deployment

Use the GHCR image together with a separate PostgreSQL container.

Recommended environment values:

```env
DATABASE_URL=postgres://passvault_user:passvault_secret@postgres:5432/passvault
GEMINI_API_KEY=your-gemini-api-key
PORT=3001
WEBAUTHN_RP_ID=passvault.barrosoportal.com
WEBAUTHN_ORIGIN=https://passvault.barrosoportal.com
EMAIL_PROVIDER=smtp
EMAIL_FROM=PassVault <no-reply@passvault.barrosoportal.com>
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-brevo-smtp-login
SMTP_PASSWORD=your-brevo-smtp-key
REGISTRATION_CODE_TTL_MINUTES=15
REGISTRATION_MAX_ATTEMPTS=5
```

Vault encryption is handled automatically by the frontend and does not need extra environment variables.
Passkeys/biometrics require a secure origin, so when you use the Cloudflare Tunnel domain set `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` to that public HTTPS hostname.
If you enable email verification, set the SMTP variables above in the Unraid container too.

Recommended compose file:

- [`docker-compose.ghcr.yml`](./docker-compose.ghcr.yml)

What it does:
- pulls `ghcr.io/barroso88/passvault:latest`
- starts PostgreSQL in a separate container
- keeps Postgres data in a persistent volume
- exposes the app on port `3071` on the host, mapped to `3001` inside the container

Optional icon for Unraid:

- `/container-icon.png`
- use it as the container icon URL if your Unraid template allows a custom icon URL/path

## Android APK

The frontend is now wrapped with Capacitor so you can build an Android app without changing the web logic.

Current setup:
- Capacitor project lives in [`frontend/android`](./frontend/android)
- web assets are copied from [`frontend/dist`](./frontend/dist)
- the generated debug APK is at:
  - [`frontend/android/app/build/outputs/apk/debug/app-debug.apk`](./frontend/android/app/build/outputs/apk/debug/app-debug.apk)

To refresh the Android project after web changes:

```bash
cd frontend
npm run build
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=$HOME/Library/Android/sdk \
ANDROID_SDK_ROOT=$HOME/Library/Android/sdk \
PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
npx cap sync android
```

To rebuild the debug APK:

```bash
cd frontend/android
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=$HOME/Library/Android/sdk \
ANDROID_SDK_ROOT=$HOME/Library/Android/sdk \
PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
./gradlew assembleDebug
```

Notes:
- this keeps the web app unchanged
- passkeys/biometrics may behave differently inside Android WebView and may need a follow-up pass
- if you want a Play Store build later, we should switch from debug APK to a signed release build

### Signed release APK

To build a production-signed APK locally, create `frontend/android/keystore.properties` from the example file:

```text
frontend/android/keystore.properties.example
```

The actual `keystore.properties` and `.jks` files are ignored by Git so the signing key stays local.

Then run:

```bash
cd frontend/android
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=$HOME/Library/Android/sdk \
ANDROID_SDK_ROOT=$HOME/Library/Android/sdk \
PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
./gradlew assembleRelease
```

The signed APK is produced at:

```text
frontend/android/app/build/outputs/apk/release/app-release.apk
```

### Automatic GitHub release APKs

You can publish a signed Android APK automatically by pushing a tag that matches `android-apk-*`.

Required GitHub repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

To create the keystore secret payload locally:

```bash
base64 -i frontend/android/passvault-release.jks | pbcopy
```

Then store the copied value in `ANDROID_KEYSTORE_BASE64` and set the other three secrets from your local `frontend/android/keystore.properties` values.

Workflow file:

- [`.github/workflows/publish-android-apk.yml`](./.github/workflows/publish-android-apk.yml)

Tag example:

- `android-apk-1.0.34-signed`

The workflow builds the release APK and uploads it to the GitHub Release for that tag.

## Files of interest

- [`backend/server.js`](./backend/server.js)
- [`frontend/src/App.jsx`](./frontend/src/App.jsx)
- [`Dockerfile`](./Dockerfile)
- [`.github/workflows/publish-ghcr.yml`](./.github/workflows/publish-ghcr.yml)
- [`.github/workflows/publish-android-apk.yml`](./.github/workflows/publish-android-apk.yml)
- [`docker-compose.yml`](./docker-compose.yml)
- [`docker-compose.ghcr.yml`](./docker-compose.ghcr.yml)
