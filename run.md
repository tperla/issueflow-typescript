# IssueFlow – Running the Project

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop (for PostgreSQL)

## 1. Install dependencies

```bash
npm install
```

## 2. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with:
- Database: `issueflow`
- Username: `issueflow`
- Password: `issueflow`

## 3. Run the application

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`.

On first boot, a default admin user is seeded automatically:
- Username: `admin`
- Password: `admin123`

## 4. Run unit tests

```bash
npm run test
```

## 5. Run E2E tests

Make sure the database is running (`docker compose up -d`) before running E2E tests.

```bash
npm run test:e2e
```

## 6. Build for production

```bash
npm run build
npm run start:prod
```
