# StatChasers Lineup Checker

## Overview
StatChasers Lineup Checker is a fantasy football web application designed to optimize fantasy lineups by comparing current rosters against projection data. It integrates with the Sleeper API to fetch league, roster, and player information, then uses user-uploaded CSV projections to calculate optimal lineups. The application offers a detailed home page with comprehensive league cards and a streamlined matchups table for quick analysis. Key features include projected point differentials, win/loss predictions, identification of risky starters, and dynamic recommendations for roster changes, including free agent pickups. The project aims to provide fantasy football players with actionable insights to improve their team's performance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is a modern React-based application built with Vite and TypeScript, utilizing `shadcn/ui` components based on Radix UI for a consistent and accessible design system. TailwindCSS is used for styling, supporting dark mode and custom theming via CSS variables. The application features a responsive design, optimized for mobile devices with adaptive layouts, scalable typography, and touch-friendly interactive elements, ensuring no horizontal overflow and adhering to WCAG AAA guidelines for touch targets.

- **Home Page**: Detailed league cards, Sleeper username input, season/week selectors, CSV projection upload, "Consider Free Agents" toggle, player availability badges (OUT/BYE/EMPTY, QUES), total potential points indicator, side-by-side current vs. optimal lineups, recommended roster changes (including "Add FA"), opponent analysis, and a waiver watchlist.
- **Matchups Table View**: Streamlined table for quick summary across leagues, automatic data loading, redraft filter, sortable columns (League, Record, Opt-Act, Proj Result, QUES?, OUT/BYE/EMPTY?), visual win/loss indicators, expandable rows showing current vs. optimal starters, player availability warnings, and waiver watchlist.
- **League Filtering**: Intelligent filtering for Best Ball leagues (always active) and Dynasty/Keeper leagues (with enhanced detection methods and localStorage persistence).

### Technical Implementations
- **Frontend**: React with Vite and TypeScript, `shadcn/ui`, Radix UI, TailwindCSS, TanStack React Query for server state management, React Hook Form with Zod for form handling, and wouter for routing.
- **Backend**: Express.js with TypeScript, implementing a RESTful API with modular routes, middleware for logging and error handling.
- **Data Storage**: Drizzle ORM for PostgreSQL as the primary database, with an in-memory solution for development.
- **Optimization Engine**: Sophisticated algorithm respecting fantasy football roster rules (FLEX, SUPER_FLEX), calculates optimal lineups, identifies risky starters. Includes comprehensive free agent integration, scanning all available free agents, scoring them by league-specific settings, selecting top players (excluding kickers), and merging them into the candidate pool for optimal lineup calculation.
- **Matchup Analysis**: Calculates Opt-Act (optimal vs. actual points), Proj Result (W/L), QUES Starters, BYE/OUT Starters, and Margin for quick league assessment.
- **Recommendations Engine**: Uses a greedy pairing algorithm to identify actionable bench-to-starter promotions, distinguishing between roster moves and free agent pickups. Filters out starter-to-starter reshuffles and includes free agent detection for "Add FA" recommendations.
- **Waiver Watchlist System**: Analyzes free agent availability from Sleeper API, calculates league-adjusted projections, filters out blocklisted players, excludes kickers, and provides slot-aware suggestions based on league roster configurations and position eligibility. Identifies top free agent upgrades with a minimum point improvement threshold, excluding players on BYE/OUT/IR status and enhancing QUES detection.

### System Design Choices
- **Monorepo Structure**: Shared types and schemas between client and server.
- **Build Process**: TypeScript compilation, Vite for frontend, esbuild for backend.
- **Authentication**: Basic username/password authentication implemented, though primary functionality relies on public API integration.

## External Dependencies

### Core Frameworks
- React, Express.js, Vite, Node.js

### Database & ORM
- Drizzle ORM, PostgreSQL, `@neondatabase/serverless`

### UI & Styling
- `shadcn/ui`, Radix UI, TailwindCSS, Lucide React, `class-variance-authority`

### State Management & API
- TanStack React Query, React Hook Form, Zod, wouter

### File Processing & Utilities
- Papa Parse, `date-fns`, `clsx`, `tailwind-merge`

### External APIs
- Sleeper Fantasy Football API (public API for user data, leagues, rosters, player info)