# PassVault

PassVault is a password vault with PostgreSQL persistence, a React/Vite frontend, and an Express backend.

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
```

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
```

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

## Files of interest

- [`backend/server.js`](./backend/server.js)
- [`frontend/src/App.jsx`](./frontend/src/App.jsx)
- [`Dockerfile`](./Dockerfile)
- [`.github/workflows/publish-ghcr.yml`](./.github/workflows/publish-ghcr.yml)
- [`docker-compose.yml`](./docker-compose.yml)
- [`docker-compose.ghcr.yml`](./docker-compose.ghcr.yml)
