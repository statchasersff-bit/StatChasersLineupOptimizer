# StatChasers Lineup Checker

## Overview

StatChasers Lineup Checker is a fantasy football web application that helps users optimize their fantasy lineups by comparing current rosters against projections data. The application integrates with the Sleeper API to fetch user leagues, rosters, and player data, then uses uploaded CSV projections to calculate optimal lineups and identify potential improvements. It provides two complementary views: a detailed home page with comprehensive league cards and a streamlined matchups table for quick summary analysis across all leagues. Features include projected point deltas, win/loss predictions, risky starters identification, sortable columns, and expandable rows for detailed analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## User Interface

### Home Page (/)
The main page provides a detailed view of all leagues with comprehensive lineup analysis. Features include:
- Sleeper username input for fetching user leagues
- Season and week selectors for projections data
- CSV file upload for custom projections
- **Consider Free Agents toggle** (updated Oct 3, 2025): When enabled (default), integrates trending free agents from Sleeper API into optimal lineup calculation
- Detailed league cards showing:
  - Current vs optimal lineups side-by-side with availability badges (OUT, BYE, QUES)
  - Projected points and optimal improvements
  - Recommended roster changes with "Add FA" labels for free agent pickups
  - Opponent analysis with win probability
  - Player risk indicators (injury status, bye weeks)
  - Export to CSV functionality

### Matchups Table View (/:username/matchups)
A streamlined table-based view for quick summary analysis across all leagues. Features include:
- Automatic data loading on page load (no analyze button needed)
- Redraft filter toggle with localStorage persistence to show only non-dynasty leagues
- Sortable columns: League, Record, Opt-Act, Proj Result, QUES?, OUT/BYE/EMPTY?
- Visual indicators: 
  - Green border for projected wins, red for losses
  - Green checkmark in Opt-Act column when lineup is already optimal
  - Color-coded deltas (+/- with green/red) for non-optimal lineups
- Expandable rows showing:
  - Current starters vs optimal starters comparison
  - Lineup recommendations showing only bench → starter promotions (excludes starter reshuffles)
  - Point improvement deltas for each recommendation
  - Opponent card with projected points
  - **Player Availability Warnings** (updated Oct 3, 2025): Specific classification with player names
    - OUT/BYE/EMPTY warnings (red/gray): Players who will score 0 points unless changed
    - QUES warnings (orange): Questionable/Doubtful/Suspended players
    - Each warning shows affected player names with their status tags
  - Waiver Watchlist with free agent pickup suggestions
- "Back to Home" button for easy navigation
- Best Ball leagues automatically filtered out
- League count display showing filtered vs total leagues

## System Architecture

### Frontend Architecture
The application uses a modern React-based frontend built with Vite and TypeScript. The UI is constructed using shadcn/ui components with Radix UI primitives, providing a consistent and accessible design system. TailwindCSS handles styling with a custom configuration supporting dark mode and CSS variables for theming. The frontend follows a component-based architecture with clear separation between pages, components, and utility functions.

### Backend Architecture
The backend is built on Express.js with TypeScript, implementing a RESTful API pattern. The server uses middleware for request logging and error handling, with routes organized modularly for maintainability. The application includes both development and production build configurations, with Vite handling development server setup and static file serving.

### Data Storage Solutions
The application uses a hybrid storage approach. It integrates with Drizzle ORM configured for PostgreSQL as the primary database solution, with schemas defined for users and projections data. For development and testing, an in-memory storage implementation provides default projection data. The database schema includes proper indexing and constraints for data integrity.

### State Management and Data Fetching
Client-side state is managed through React Query (TanStack Query) for server state synchronization and caching. The application implements custom query functions with proper error handling and retry logic. Local component state is handled through React hooks, with form state managed via React Hook Form where applicable.

### Authentication and Authorization
The application currently implements a basic user system with username/password authentication, though the primary functionality focuses on public Sleeper API integration. Session management is prepared but not fully implemented in the current codebase.

### External Service Integrations
The application heavily integrates with the Sleeper Fantasy Football API for fetching user data, leagues, rosters, and player information. All Sleeper API calls are made client-side using public endpoints that require no authentication. The app processes CSV files for projections data using Papa Parse for robust CSV parsing and validation.

### Optimization Engine
The core lineup optimization logic implements a sophisticated algorithm that respects fantasy football roster construction rules including FLEX, SUPER_FLEX, and other specialty positions. The optimizer handles player eligibility across multiple positions, calculates optimal lineups based on projected points, and identifies risky starters based on injury status, bye weeks, and other factors. The system uses matchup.starters from Sleeper's matchups endpoint rather than roster.starters to accurately reflect in-week lineup changes and automatic substitutions.

**Free Agent Integration** (updated Oct 3, 2025): When "Consider Free Agents" toggle is enabled:
- Scans ALL available free agents from projections data (not limited to trending players)
- Scores FAs using league-specific scoring settings
- Selects top 10 FAs per position by projection (DESC) with stable tiebreaker
- Merges FAs into the candidate pool for optimal lineup calculation
- Optimizer naturally selects best available players (roster or FA)
- Filters out locked players (games already started), BYE weeks, and OUT/IR status
- Enables identification of lineup improvements via free agent pickups
- Uses same comprehensive approach as waiver watchlist for consistency

### Matchup Analysis System
The matchups analysis component calculates key metrics for quick league assessment:
- **Opt-Act**: Difference between optimal and actual projected points
- **Proj Result (W/L)**: Win or loss prediction based on optimal lineup vs opponent's optimal lineup
- **QUES Starters**: Count of questionable/doubtful starters in current lineup
- **BYE/OUT Starters**: Count of players on bye week or ruled out in current lineup
- **Margin**: Point differential between user's optimal and opponent's optimal lineup
These metrics enable quick identification of leagues needing attention and strategic decisions.

### Recommendations Engine
The lineup recommendations system uses a greedy pairing algorithm to identify only meaningful bench → starter promotions:
- Identifies bench players entering the optimal starting lineup (promotions)
- Identifies current starters being benched in the optimal lineup (demotions)
- Pairs promotions with demotions by highest point gain
- Filters out starter → starter reshuffles (position swaps with no bench involvement)
- Each recommendation shows the outgoing player, incoming player, target slot, and projected point improvement
- **Free Agent Detection** (updated Oct 3, 2025): Recommendations distinguish between roster moves and FA pickups:
  - "Put [player] into [slot]" for roster moves (bench to starter)
  - "Add FA [player] into [slot]" for free agent additions (shown in yellow/amber text)
  - FA drops show "drop [player]" instead of "bench [player]"
This approach focuses user attention on actionable roster changes rather than internal lineup rearrangements.

### League Filtering
The application provides intelligent filtering capabilities:
- **Best Ball Filter**: Automatically excludes Best Ball leagues from all analysis (always active)
- **Dynasty/Keeper Filter**: Available on both home page ("Filter Dynasty Leagues") and matchups page ("Redraft only" toggle)
  - **Enhanced Detection** (updated Oct 3, 2025): Detects dynasty/keeper leagues using multiple authoritative indicators:
    - `previous_league_id` - Official league continuation link from prior season
    - `metadata.copy_from_league_id` - League copied from another league
    - `metadata.league_history` - League has historical data
    - `metadata.auto_continue` - League set to auto-continue year-to-year
    - `settings.keeper_count` or `settings.keepers` > 0 - Has keeper roster spots configured
    - `settings.type` - Explicit dynasty/keeper type designation
    - Name/description keyword matching - Case-insensitive detection of "dynasty" or "keeper" in league name or description
  - Filter preference persists in localStorage across sessions (matchups page)
  - Shows filtered count vs total leagues when active

### Waiver Watchlist System
The waiver watchlist analyzes free agent availability and suggests optimal pickups for each league:
- Fetches trending free agents from Sleeper API (up to 300 players)
- Calculates league-adjusted projections using StatChasers data
- **Slot-Aware Analysis** (updated Oct 3, 2025): Only evaluates roster slots that exist in each league's configuration
  - Extracts active roster positions from league's `roster_positions` field
  - Calculates upgrade floors only for slots the league actually uses (QB, RB, WR, TE, K, DEF, FLEX, SUPER_FLEX)
  - Prevents invalid suggestions (e.g., QB for WR in non-superflex leagues)
  - Respects position eligibility rules for each slot type
- Suggests top 5 free agent upgrades with minimum +1.5 point improvement threshold
- Automatically excludes players on BYE weeks or OUT/IR status
- Each suggestion includes:
  - Player to add with position and target slot
  - Projected point improvement delta
  - Current starter being replaced with their projection
  - Direct link to player page on Sleeper for easy pickup
- Displays "No obvious waiver upgrades" message when no qualifying suggestions found

### Build and Deployment
The application uses a monorepo structure with shared types and schemas between client and server. Build process includes TypeScript compilation, Vite bundling for the frontend, and esbuild for the backend. The application is configured for easy deployment with proper environment variable handling and production optimizations.

## External Dependencies

### Core Framework Dependencies
- **React 18** with TypeScript for the frontend application framework
- **Express.js** for the backend API server
- **Vite** as the build tool and development server
- **Node.js** runtime environment

### Database and ORM
- **Drizzle ORM** for database operations and schema management
- **PostgreSQL** as the target database (configured via Drizzle)
- **@neondatabase/serverless** for serverless PostgreSQL connections

### UI and Styling
- **shadcn/ui component library** built on Radix UI primitives
- **Radix UI** for accessible component primitives
- **TailwindCSS** for utility-first styling
- **Lucide React** for consistent iconography
- **class-variance-authority** for component variant management

### State Management and API
- **TanStack React Query** for server state management and caching
- **React Hook Form** with Zod resolvers for form management
- **Zod** for runtime type validation and schema definition
- **wouter** for client-side routing

### File Processing and Utilities
- **Papa Parse** for CSV file parsing and processing
- **date-fns** for date manipulation and formatting
- **clsx** and **tailwind-merge** for conditional class name handling

### External APIs
- **Sleeper Fantasy Football API** for user data, leagues, rosters, and player information (public API, no authentication required)

### Development and Build Tools
- **TypeScript** for type safety and development experience
- **ESBuild** for fast server-side bundling
- **PostCSS** with Autoprefixer for CSS processing
- **Replit development tools** for enhanced development experience in Replit environment