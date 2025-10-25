# StatChasers Lineup Checker

## Overview
StatChasers Lineup Checker is a fantasy football web application designed to optimize user lineups by comparing current rosters against projection data. It integrates with the Sleeper API to fetch league, roster, and player information, then processes uploaded CSV projections to calculate optimal lineups. The application offers a detailed home page with comprehensive league analysis and a streamlined matchups table for quick summary views. Key features include projected point deltas, win/loss predictions, identification of risky starters, and free agent integration for lineup improvements and waiver watchlist suggestions. The ultimate goal is to provide users with actionable insights to gain a competitive edge in their fantasy football leagues.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is a modern React application built with Vite and TypeScript, utilizing `shadcn/ui` components based on Radix UI for a consistent and accessible design system. TailwindCSS handles styling, supporting dark mode and custom theming. The UI provides two main views: a detailed home page with league cards and a streamlined matchups table. Responsive design ensures optimal viewing across devices, with card-based layouts for mobile and table views for desktop. Visual indicators like color-coded deltas, win/loss badges, and player availability badges enhance user understanding.

### Technical Implementations
The application follows a component-based architecture for the frontend and a RESTful API pattern for the Express.js (TypeScript) backend. Client-side state is managed with React Query for server state synchronization and caching, while local state uses React hooks. Form management is handled by React Hook Form with Zod for validation. The core logic includes a sophisticated lineup optimization engine that respects fantasy football roster rules (e.g., FLEX, SUPER_FLEX), integrates free agents, and identifies risky starters. A greedy pairing algorithm powers the recommendations engine, focusing on actionable bench-to-starter promotions and distinguishing between roster moves and free agent pickups. Advanced league filtering detects dynasty/keeper leagues using multiple criteria and persists preferences. A waiver watchlist system suggests optimal free agent pickups, considering league-specific roster slots, excluding kickers, and applying blocklist filters.

### Feature Specifications
- **Auto-Detection of Latest Projections**: Automatically detects and loads the latest uploaded week's projections (probes weeks 18 down to 1, verifying CSV content). No manual code changes needed when uploading new projections - simply add the new weekXX.csv file to `public/projections/2025/` and the app will automatically use it.
- **Home Page**: Displays detailed league cards, Sleeper username input, season/week selectors, CSV projection upload, "Consider Free Agents" toggle, player availability badges (OUT, BYE, QUES), total potential points, current vs. optimal lineups, recommended roster changes (including "Add FA"), opponent analysis, and a waiver watchlist.
- **Matchups Table View**: Provides a streamlined view with automatic data loading, opponent analysis toggle (optimal vs current lineup), redraft filter, responsive layouts (cards on mobile, table on desktop), visual win/loss indicators, expandable rows showing lineup comparisons, recommendations, point improvement deltas, player availability warnings, and a waiver watchlist. Removed redundant OUT/BYE/EMPTY and QUES badges from league names since dedicated columns display this information.
- **Lineup Optimization**: Calculates optimal lineups considering all roster rules and player eligibility.
- **Opponent Analysis Toggle**: Users can choose to compare their optimal lineup against the opponent's optimal lineup (default) or current lineup. This toggle is persisted in localStorage and triggers automatic recalculation of projected results and margins.
- **Free Agent Integration**: When enabled, scans available free agents, scores them using league-specific settings, and integrates them into optimal lineup calculations and waiver suggestions, excluding kickers and locked/unavailable players.
- **Matchup Analysis**: Calculates Opt-Act, Proj Result (W/L), QUES Starters, BYE/OUT Starters, and Margin for quick assessment. Projected results compare user's optimal lineup against opponent's lineup (optimal or current, based on toggle).
- **Recommendations Engine**: Identifies meaningful bench → starter promotions and free agent pickups, filtering out internal lineup reshuffles.
- **League Filtering**: Automatically excludes Best Ball leagues and provides robust filtering for Dynasty/Keeper leagues with persistence.
- **Waiver Watchlist System**: Analyzes free agent availability, suggests top upgrades based on projections, considers roster slots, and filters problematic or low-impact players (like kickers).

### System Design Choices
A monorepo structure with shared types facilitates development. The build process uses Vite for the frontend and esbuild for the backend. A hybrid storage approach integrates Drizzle ORM with PostgreSQL for primary data, and in-memory storage for development. Authentication is basic, focusing on Sleeper API integration without requiring user credentials for core functionality.

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
- Sleeper Fantasy Football API (public, no authentication)

### Development Tools
- TypeScript
- ESBuild
- PostCSS
- Replit development tools