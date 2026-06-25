# AnimeWorld

Anime streaming platform with PostgreSQL backend.

## Deploy to Railway

1. Create a new project on Railway
2. Add PostgreSQL plugin
3. Deploy this repository
4. Set environment variable `JWT_SECRET` (optional, for production security)

The `DATABASE_URL` will be automatically provided by Railway's PostgreSQL plugin.

## Local Development

```bash
# Install dependencies
npm install

# Start frontend dev server
npm run dev

# Start backend dev server (in another terminal)
npm run dev:server
```

For local development, create a `.env` file:
```
DATABASE_URL=postgres://user:password@localhost:5432/animeworld
JWT_SECRET=your-secret-key
```

## Features

- User registration/login
- Admin panel for user "Morfin"
- Upload anime with poster and video
- Comments with likes
- Rating system
- Search functionality

## Tech Stack

- Frontend: React 19, Tailwind CSS 4, React Router
- Backend: Express 5, PostgreSQL, JWT auth
- Deployment: Railway with Nixpacks
