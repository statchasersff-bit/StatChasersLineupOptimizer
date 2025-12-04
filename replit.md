# StatChasers Lineup Checker

## Overview
StatChasers Lineup Checker is a fantasy football web application designed to optimize user lineups by comparing current rosters against projection data. It integrates with the Sleeper API to fetch league, roster, and player information, processes uploaded CSV projections, and calculates optimal lineups. The application provides detailed league analysis on a home page and a streamlined matchups table for quick overviews. Key capabilities include projected point deltas, win/loss predictions, identification of risky starters, and free agent integration for lineup improvements and waiver watchlist suggestions, aiming to give users a competitive edge in their fantasy leagues.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is a modern React application built with Vite and TypeScript, utilizing `shadcn/ui` components based on Radix UI for a consistent and accessible design system. TailwindCSS handles styling, supporting dark mode and custom theming. Both the home page and matchups page now use a unified table-based layout (not stacked cards) that works consistently across all screen sizes with horizontal scrolling on mobile. Table columns include: League name/avatar, W-L record, +Δ (optimization delta), Result (projected win/loss), and status indicators (🟡 questionable, 🔴 out/bye/empty). Visual indicators like color-coded deltas, win/loss badges, and player availability badges enhance user understanding.

### Technical Implementations
The application follows a component-based architecture for the frontend and a RESTful API pattern for the Express.js (TypeScript) backend. Client-side state is managed with React Query for server state synchronization and caching, while local state uses React hooks. Form management is handled by React Hook Form with Zod for validation. The core includes a sophisticated lineup optimization engine that respects fantasy football roster rules (e.g., FLEX, SUPER_FLEX), integrates free agents, and identifies risky starters. A greedy pairing algorithm powers the recommendations engine, focusing on actionable bench-to-starter promotions and distinguishing between roster moves and free agent pickups. Advanced league filtering detects dynasty/keeper leagues and persists preferences. A waiver watchlist system suggests optimal free agent pickups, considering league-specific roster slots, excluding kickers, and applying blocklist filters. Special scoring rules apply: kickers (K) and defenses (DEF/DST) use direct "proj" values, while offensive positions (QB, RB, WR, TE) use league-specific scoring settings. The system automatically detects the current week by scanning projection files from week 18 down to 1.

### Feature Specifications
- **Auto-Detection of Latest Projections**: Automatically loads the latest week's projections from `public/projections/2025/` without manual configuration.
- **Last Update Timestamp**: Displays the timestamp of the last projection update on both home and matchups pages.
- **Home Page**: Provides detailed league cards with projected point totals, Sleeper username input, season/week selectors, CSV projection upload, "Consider Free Agents" toggle, "Opp Optimal" toggle, player availability badges, current vs. optimal lineups, recommended roster changes (including "Add FA"), opponent analysis, and a waiver watchlist.
- **Matchups Table View**: Offers a streamlined view with automatic data loading, opponent analysis toggle, redraft filter, responsive layouts, visual win/loss indicators, expandable rows showing lineup comparisons, recommendations, point improvement deltas, player availability warnings, and a waiver watchlist.
- **Lineup Optimization**: Calculates optimal lineups considering all roster rules and player eligibility.
- **Opponent Analysis Toggle**: Allows users to compare their optimal lineup against the opponent's optimal or current lineup, with preference persistence.
- **Free Agent Integration**: When enabled, scans and scores available free agents, integrating them into optimal lineup calculations and waiver suggestions (excluding kickers and locked/unavailable players).
- **Matchup Analysis**: Provides metrics like Opt-Act, Proj Result (W/L), QUES Starters, BYE/OUT Starters, and Margin.
- **Recommendations Engine**: Identifies meaningful bench-to-starter promotions and free agent pickups, enforcing position eligibility and displaying clear, enriched recommendation formats (e.g., "Start {Player} → {Slot} (+{delta})", "Benches {displaced player}" or "Fills EMPTY starter"), including cascade moves.
- **League Filtering**: Automatically excludes Best Ball leagues, incomplete rosters, and provides robust, persistent filtering for Dynasty/Keeper leagues.
- **Waiver Watchlist System**: Analyzes free agent availability, suggests top upgrades based on projections, considering roster slots and filtering low-impact players.
- **Auto-Subs Intelligence**: Detects uniform auto-sub settings across leagues, showing a global banner when consistent or per-league chips when settings differ, auto-subs are OFF, or the league is at capacity.
- **Compact League Header Design**: Mobile-optimized grid layout for league headers ensures readability and reduces visual clutter.

### System Design Choices
The project uses a monorepo structure with shared types. The build process uses Vite for the frontend and esbuild for the backend. Data storage combines Drizzle ORM with PostgreSQL for primary data and in-memory storage for development. Authentication is basic, focusing on Sleeper API integration.

## External Dependencies

### Core Frameworks
- React 18
- Express.js
- Vite
- Node.js

### Database & ORM
- Drizzle ORM (with PostgreSQL)
- @neondatabase/serverless

### UI & Styling
- shadcn/ui
- Radix UI
- TailwindCSS
- Lucide React
- class-variance-authority

### State Management & API
- TanStack React Query
- React Hook Form
- Zod
- wouter

### File Processing & Utilities
- Papa Parse
- date-fns
- clsx
- tailwind-merge

### External APIs
- Sleeper Fantasy Football API

### Development Tools
- TypeScript
- ESBuild
- PostCSS