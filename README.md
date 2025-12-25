# Xandeum pNode Analytics Dashboard

> 🏆 Built for the [Xandeum pNode Analytics Platform Bounty](https://earn.superteam.fun/listing/build-analytics-platform-for-xandeum-pnodes)

A comprehensive, production-ready analytics platform for monitoring and analyzing Xandeum network pNodes. Features real-time data visualization, historical tracking, geolocation mapping, advanced performance metrics, and predictive analytics.

![Xandeum Analytics Dashboard](https://img.shields.io/badge/Status-Production%20Ready-success)
![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Latest-blue)

## Bounty Requirements Checklist

- ✅ Real-time pod monitoring and statistics
- ✅ Historical data tracking and persistence (90-day retention)
- ✅ Automated data collection system (Telegram bot)
- ✅ Network-wide statistics and comparisons
- ✅ Interactive data visualizations (4+ chart types)
- ✅ Individual node analytics pages with deep insights
- ✅ Geolocation mapping with 3D globe
- ✅ Performance metrics and predictive analytics
- ✅ Pod comparison tools (up to 3 nodes)
- ✅ Responsive UI with modern design
- ✅ Type-safe codebase with TypeScript
- ✅ Comprehensive documentation
- ✅ Advanced filtering and search capabilities
- ✅ Multiple time period views (24h/7d/30d)

## Key Features

### Real-Time Network Analytics

- **Live Monitoring**: 7-second polling interval with connection status indicator
- **Network Summary**: Total pods, storage capacity, active connections, and version distribution
- **Historical Trends**: Track network growth and utilization over time (24h/7d/30d views)
- **Top Performers**: Rankings by storage capacity, uptime, and version adoption

### Advanced Node Analytics

Individual node pages provide deep insights with:

#### Performance & Health Graphs

- **Storage Utilization Timeline**: Real-time % utilization with color-coded health status
- **Uptime Timeline**: Up/down status visualization showing node availability
- **Storage Growth Rate**: GB/day growth tracking with capacity predictions
- **Data Collection Quality**: Gap detection in monitoring data

#### Predictive Metrics

- **Days Until Capacity**: Forecasts when storage will be full based on growth trends
- **Storage Growth Velocity**: Rate of storage increase over time
- **Uptime Consistency Score**: Reliability percentage based on statistical analysis
- **Capacity Planning**: Automated alerts for nodes nearing capacity

#### Network Position Analysis

- **Percentile Rankings**: Compare node performance against network (Top X%)
- **Comparative Analytics**: % above/below network averages
- **Storage Rankings**: Position in network by storage capacity
- **Uptime Rankings**: Reliability comparison with network average

### Enhanced Location Intelligence

- **Aggregated Metrics**: Storage totals, utilization %, version distribution per location
- **Public/Private Split**: Network visibility breakdown
- **Average Uptime**: Location-based reliability metrics
- **ISP Analysis**: Provider distribution across locations
- **Multi-Node Locations**: Support for multiple pods per geographic area

### Pod Comparison Tools

- **Multi-Select**: Compare up to 3 pods simultaneously
- **Searchable List**: Quick pod discovery with real-time filtering
- **Multiple Metrics**: Compare by storage used, committed, utilization %, or uptime
- **Visual Color Coding**: Distinct chart colors for easy differentiation
- **Dynamic Charts**: Side-by-side performance visualization

### Data Collection System

Automated data collection via companion cron bot:

- **[Xandeum Telegram Cron Bot](https://github.com/dharminnagar/xandeum-cron-bot)**: Minute-by-minute snapshots
- **Telegram Integration**: Automated monitoring and notifications
- **Reliable Scheduling**: Ensures consistent data collection
- **Error Handling**: Robust retry mechanisms
- **Status Updates**: Real-time notifications of collection status

## Tech Stack

### Frontend

- **Next.js 16** (App Router) - React framework with server components
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Data visualization library
- **Three.js** - 3D globe rendering
- **@react-three/fiber** & **@react-three/drei** - React Three.js integration
- **camera-controls** - Smooth camera animations

### Backend & Database

- **PostgreSQL** - Production database with Prisma ORM
- **Prisma** - Type-safe database client and migrations
- **Next.js API Routes** - RESTful API endpoints

### DevOps & Tooling

- **Vercel** - Production deployment platform
- **ESLint** & **Prettier** - Code quality and formatting
- **Husky** - Git hooks for pre-commit checks

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── health/            # Health check endpoint
│   │   ├── nodes/             # Nodes data API
│   │   ├── stats/             # Network stats API
│   │   └── node/[id]/         # Individual node data & geolocation
│   ├── node/[id]/
│   │   └── page.tsx           # Node detail page with analytics
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Main dashboard
├── components/
│   └── ui/
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── table.tsx
│       └── world-map.tsx      # 3D Globe component
├── lib/
│   ├── db/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── queries/           # Database query functions
│   │       ├── pods.ts        # Pod-related queries
│   │       ├── stats.ts       # Statistics queries
│   │       └── system-metrics.ts
│   ├── colors.ts              # Color utility functions
│   ├── sendRequest.ts
│   └── utils.ts
├── prisma/
│   └── schema.prisma          # Database schema
├── types/
│   ├── nodes.ts               # Pod type definitions
│   ├── stats.ts               # Statistics types
│   └── geolocation.ts         # Location types
└── config/
    └── endpoints.ts           # API endpoint configuration
```

## Database Schema

### Core Tables

**Pod**

- Stores pod identity information (pubkey, addresses, version, etc.)
- Tracks public/private status and RPC ports

**PodMetricsHistory**

- Time-series data for storage and uptime metrics
- 5-minute interval snapshots
- Automatically cleaned up after 90 days

**IpGeolocation**

- Geographic location data for IP addresses
- ISP and organization information
- Coordinates for map visualization

**SystemMetrics**

- Network-wide statistics
- CPU, RAM, and packet metrics
- Active streams and file system data

## API Endpoints

### Network Statistics

- `GET /api/stats` - Current network summary and pod list
- `GET /api/health` - API health check

### Node Data

- `GET /api/nodes` - All nodes with latest metrics
- `GET /api/node/[id]?period=24h|7d|30d` - Individual node data with historical metrics
- `GET /api/node/[id]/geolocation` - Node location information

## Key Components

### Dashboard (`app/page.tsx`)

- Network summary cards
- Historical trends chart
- Top pods table
- Location cards with aggregated metrics
- Pod comparison tool
- Interactive globe

### Node Detail Page (`app/node/[id]/page.tsx`)

- Performance & health graphs (4 charts)
- Network position analysis
- Historical metrics chart
- Identity and addresses
- Geographic distribution

### 3D Globe (`components/ui/world-map.tsx`)

- Three.js-based globe with country borders
- Interactive camera controls
- Node markers with selection
- Smooth animations

## Important Metrics Calculations

### Storage Utilization

Calculates the percentage of committed storage currently used:

```typescript
utilization = (storageUsed / storageCommitted) * 100;
```

### Storage Growth Rate

Measures storage increase over time:

```typescript
growthRate = (latestStorage - oldestStorage) / timeSpanDays;
```

### Uptime Consistency

Statistical measure of reliability using standard deviation:

```typescript
consistency = 100 - (standardDeviation / mean) * 100;
```

### Days Until Capacity

Predictive metric based on growth trend:

```typescript
daysRemaining = remainingCapacity / dailyGrowthRate;
```

### Data Collection Rate

Measures monitoring completeness:

```typescript
rate = (actualDataPoints / expectedDataPoints) * 100;
```

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database
- Git

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/xandeum-analytics-dashboard.git
cd xandeum-analytics-dashboard
```

2. **Install dependencies**

```bash
npm install
# or
bun install
```

3. **Set up environment variables**

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/xandeum_analytics"

# API Endpoints
NEXT_PUBLIC_API_URL="https://api.xandeum.com"
```

4. **Set up the database**

```bash
# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

5. **Start the development server**

```bash
npm run dev
# or
bun dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Database Setup with Docker (Optional)

```bash
# Start PostgreSQL with Docker Compose
docker-compose up -d

# The database will be available at:
# postgresql://postgres:postgres@localhost:5432/xandeum_analytics
```

## Available Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run db:push      # Push schema changes
npm run db:studio    # Open Prisma Studio
npm run db:migrate   # Run migrations

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
npm run format       # Format with Prettier
npm run type-check   # Run TypeScript checks
```

## Security & Best Practices

- ✅ Type-safe database queries with Prisma
- ✅ Input validation on API endpoints
- ✅ SQL injection prevention via ORM
- ✅ Environment variable protection
- ✅ CORS configuration for production
- ✅ Rate limiting considerations
- ✅ Secure data handling

## Deployment

### Vercel (Recommended)

1. **Connect your repository**
   - Import project in Vercel dashboard
   - Connect to your Git repository

2. **Configure environment variables**
   - Add `DATABASE_URL` in Vercel settings
   - Add any other required environment variables

3. **Deploy**
   - Vercel will automatically build and deploy
   - Database migrations run automatically

### Manual Deployment

```bash
# Build the project
npm run build

# Start production server
npm start
```

## Data Collection Setup

To enable automated data collection:

1. **Deploy the [Xandeum Telegram Cron Bot](https://github.com/dharminnagar/xandeum-cron-bot)**
2. **Configure bot with your dashboard API**
3. **Set up Telegram bot for monitoring**
4. **Bot will collect snapshots every minute**

### Bot Features

- ✅ Automatic Snapshots: Calls snapshot endpoint every minute
- ✅ Quarterly Cleanup: Runs cleanup job once per quarter (Jan 1, Apr 1, Jul 1, Oct 1 at midnight UTC)
- ✅ Telegram Notifications: Sends status updates and error alerts
- ✅ Health Checks: `/health` command to check bot status
- ✅ Error Handling: Catches and reports failures via Telegram

### Prerequisites

- [Bun](https://bun.sh/) runtime installed
- A Telegram bot token from [@BotFather](https://t.me/botfather)
- Xandeum Analytics Dashboard running with snapshot and cleanup endpoints

### Installation

1. Clone the repository:

```bash
git clone https://github.com/dharminnagar/xandeum-cron-bot.git
cd xandeum-cron-bot
```

2. Install dependencies:

```bash
bun install
```

3. Create `.env` file:

```bash
cp .env.example .env
```

4. Configure environment variables:

```env
# Get your bot token from @BotFather on Telegram
BOT_TOKEN=your_telegram_bot_token_here

# Your Telegram chat ID for admin notifications
ADMIN_CHAT_ID=your_chat_id

# Dashboard API endpoints
SNAPSHOT_URL=https://your-dashboard.vercel.app/api/pods/snapshot
CLEANUP_URL=https://your-dashboard.vercel.app/api/pods/cleanup

# Optional: API authorization secret
CRON_SECRET=your_secret_here
```

### Getting Your Chat ID

1. Send a message to your bot on Telegram
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Look for the `chat.id` field in the response

### Usage

Start the bot:

```bash
bun run start
```

Or for development with auto-reload:

```bash
bun run dev
```

### Telegram Commands

- `/health` - Check bot status, last runs, and uptime

### How It Works

1. **Snapshot Job**: Runs every 1 minute, calls `POST /api/pods/snapshot` endpoint
2. **Cleanup Job**: Checks every hour, executes on Jan 1, Apr 1, Jul 1, Oct 1 at midnight UTC
3. **Status Updates**: Sends Telegram message with HTTP status code and timestamp
4. **Error Handling**: Catches and reports any failures via Telegram

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is built for the Xandeum pNode Analytics Platform bounty.

## Acknowledgments

- **Xandeum Team** - For providing the API and network infrastructure
- **Superteam** - For hosting the bounty
- **Three.js Community** - For excellent 3D visualization tools
- **Recharts** - For powerful charting capabilities
- **Prisma Team** - For the amazing ORM

## Contact

For questions or support regarding this project:

- GitHub Issues: [Create an issue](https://github.com/yourusername/xandeum-analytics-dashboard/issues)

---

**Built with ❤️ for the Xandeum community**
