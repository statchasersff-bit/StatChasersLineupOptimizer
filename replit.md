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
- Detailed league cards showing:
  - Current vs optimal lineups side-by-side
  - Projected points and optimal improvements
  - Recommended roster changes
  - Opponent analysis with win probability
  - Player risk indicators (injury status, bye weeks)
  - Export to CSV functionality

### Matchups Table View (/:username/matchups)
A streamlined table-based view for quick summary analysis across all leagues. Features include:
- Automatic data loading on page load (no analyze button needed)
- Sortable columns: League, Record, Opt-Act, Projected Result, QUES?, BYE/OUT?
- Visual indicators: green border for projected wins, red for losses
- Expandable rows showing:
  - Current starters vs optimal starters comparison
  - Lineup recommendations with point improvements
  - Opponent card with projected points
  - Warning badges for risky starters
- "Back to Home" button for easy navigation
- Best Ball leagues automatically filtered out

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

### Matchup Analysis System
The matchups analysis component calculates key metrics for quick league assessment:
- **Opt-Act**: Difference between optimal and actual projected points
- **Projected Result (W/L)**: Win or loss prediction based on optimal lineup vs opponent's optimal lineup
- **QUES Starters**: Count of questionable/doubtful starters in current lineup
- **BYE/OUT Starters**: Count of players on bye week or ruled out in current lineup
- **Margin**: Point differential between user's optimal and opponent's optimal lineup
These metrics enable quick identification of leagues needing attention and strategic decisions.

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