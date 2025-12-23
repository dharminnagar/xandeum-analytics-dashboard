# Xandeum Analytics Dashboard

A production-ready Next.js analytics dashboard for monitoring Xandeum network pods and system metrics with historical data persistence.

## Features

- Real-time monitoring of Xandeum network pods and system statistics
- Historical data storage with PostgreSQL
- Time-series data tracking with 90-day retention
- Automated data collection via cron jobs
- Modern UI built with React and Tailwind CSS
- Deployed on Vercel with production-ready setup

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Type Safety**: TypeScript
- **Code Quality**: ESLint, Prettier, Husky

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── pods/              # Pods endpoints
│   │   │   ├── route.ts       # GET current pods
│   │   │   ├── snapshot/      # POST save pods snapshot
│   │   │   └── history/       # GET historical pods data
│   │   ├── system/
│   │   │   └── stats/         # System stats endpoints
│   │   │       ├── route.ts   # GET current stats
│   │   │       ├── snapshot/  # POST save stats snapshot
│   │   │       └── history/   # GET historical stats
│   │   └── cleanup/           # Data retention cleanup
│   ├── layout.tsx
│   └── page.tsx
├── components/                 # React components
├── lib/
│   ├── db/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── queries/           # Database query functions
│   ├── sendRequest.ts
│   └── utils.ts
├── prisma/
│   └── schema.prisma          # Database schema
├── types/                      # TypeScript type definitions
├── docker-compose.yml         # Local PostgreSQL setup
├── .env                       # Environment variables
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for local PostgreSQL)
- npm or yarn

### 1. Clone and Install

```bash
git clone <repository-url>
cd xandeum-analytics-dashboard
npm install
```

### 2. Setup Database

#### Option A: Local Development (Docker)

```bash
# Start PostgreSQL container
docker-compose up -d

# Run migrations
npm run db:migrate

# Generate Prisma Client
npx prisma generate
```

For detailed Docker setup, see [DOCKER_SETUP.md](./DOCKER_SETUP.md)

#### Option B: Vercel Postgres

1. Create a Postgres database in Vercel
2. Copy the connection string
3. Update `.env` with your connection string

### 3. Configure Environment Variables

Create `.env` file (or copy from `.env.example`):

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/xandeum_analytics"
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API Endpoints

### Real-time Data

- `POST /api/pods` - Get current pods from Xandeum network
- `POST /api/system/stats` - Get current system stats

### Individual Pod Data

- `GET /api/pods/[address]` - Get specific pod details with metrics history
  - Supports both address and pubkey as the parameter
  - Returns pod info, live data (if available), and historical metrics

### Snapshots (Save to DB)

- `POST /api/pods/snapshot` - Fetch and save pods data
- `POST /api/system/stats/snapshot` - Fetch and save system stats

### Historical Data

- `GET /api/pods/history?pubkey=xxx&from=...&to=...` - Get pod metrics history
- `GET /api/system/stats/history?from=...&to=...` - Get system stats history

### Maintenance

- `POST /api/cleanup` - Delete data older than 90 days

For complete API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## Database Management

```bash
# Run migrations
npm run db:migrate

# Push schema changes without migration
npm run db:push

# Open Prisma Studio (visual database editor)
npm run db:studio

# Generate Prisma Client
npx prisma generate
```

## Data Collection Setup

To collect historical data, set up automated cron jobs to call the snapshot endpoints every minute.

See [CRON_SETUP.md](./CRON_SETUP.md) for detailed instructions on:

- Vercel Cron setup
- External cron services (free alternatives)
- Local cron setup
- PM2 setup for self-hosted

## Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Important**:

1. Add `DATABASE_URL` to Vercel environment variables
2. Set up Vercel Postgres or use external PostgreSQL
3. Configure cron jobs for data collection (see [CRON_SETUP.md](./CRON_SETUP.md))

### Environment Variables (Vercel)

Add these in Vercel Project Settings → Environment Variables:

- `DATABASE_URL` - PostgreSQL connection string

## Code Quality

```bash
# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npx prettier --write .
```

## Development Workflow

1. **Feature Development**:
   - Create feature branch
   - Make changes
   - Test locally with Docker PostgreSQL

2. **Database Changes**:
   - Update `prisma/schema.prisma`
   - Run `npm run db:migrate`
   - Commit migration files

3. **Testing**:
   - Test API endpoints manually or with Postman
   - Verify data in Prisma Studio
   - Check frontend integration

4. **Deploy**:
   - Push to main branch
   - Vercel auto-deploys
   - Verify production database connection

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
npx prisma db push

# Reset database (⚠️ deletes all data)
npx prisma migrate reset
```

### Prisma Client Not Found

```bash
npx prisma generate
```

### Port 5432 Already in Use

See [DOCKER_SETUP.md](./DOCKER_SETUP.md#troubleshooting)

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is private and proprietary.

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
