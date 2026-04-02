# Premura Performance Dashboard

> Real-time business intelligence dashboard for tracking outbound call center performance across clients, agents, and campaigns.

## Status

**sandbox** · _in-progress_

## Description

A multi-view performance tracking dashboard for Premura, built with React, TypeScript, Tailwind CSS, and Supabase. Features real-time data updates, achievement tracking, leaderboards, and historical analysis with a premium dark-themed UI.

### Views

1. **Overview** - Summary of all campaigns with key metrics
2. **Client Campaign View** - Expandable table showing client health, seat usage, and achievement rates
3. **Agent Performance View** - Individual agent metrics grouped by client campaign
4. **Leaderboard** - Gamified ranked view of top clients and agents
5. **Historical Analysis** - Week-by-week and month-by-month performance heatmap with drill-down panels
6. **Settings** - Manage client seat allocations and cycle dates

### Key Features

- Real-time Supabase subscriptions for live data updates
- Achievement tier color coding (Blue >100%, Green 85-100%, Yellow 60-84%, Red <60%)
- Working week calendar (Friday-Thursday)
- Auto-hiding inactive agents (no activity in 14 days)
- Responsive layout with collapsible sidebar
- Glassmorphism top bar with live connection indicator

## Setup Instructions

```bash
# 1. Install dependencies
npm install

# 2. Configure Supabase credentials
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# 3. Run the SQL schema in your Supabase SQL editor
# See schema.sql for the full setup script

# 4. Start development server
npm run dev
```

## Tech Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- Supabase (database + real-time subscriptions)
- Recharts (data visualization)
- Lucide React (icons)
- date-fns (date utilities)

## Notes

- The `appointments` table is expected to already exist in Supabase with the fields documented in the schema.
- The `client_seats` table must be created using the provided `schema.sql`.
- All KPI calculations follow a Friday-Thursday working week cadence.
- Target KPI: 5 appointments per seat per working week.
