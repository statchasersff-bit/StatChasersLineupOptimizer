import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectionSchema } from "@shared/schema";
import { z } from "zod";

// In-memory cache for game schedules (5-minute TTL)
interface GameScheduleCache {
  data: Record<string, { start: number; state: 'pre' | 'in' | 'post' }>;
  expiry: number;
}

const scheduleCache = new Map<string, GameScheduleCache>();

// ESPN team abbreviation mapping to standardize team names
const ESPN_TEAM_MAP: Record<string, string> = {
  'ARI': 'ARI', 'ATL': 'ATL', 'BAL': 'BAL', 'BUF': 'BUF', 'CAR': 'CAR', 'CHI': 'CHI',
  'CIN': 'CIN', 'CLE': 'CLE', 'DAL': 'DAL', 'DEN': 'DEN', 'DET': 'DET', 'GB': 'GB',
  'HOU': 'HOU', 'IND': 'IND', 'JAX': 'JAX', 'KC': 'KC', 'LV': 'LV', 'LAC': 'LAC',
  'LAR': 'LAR', 'MIA': 'MIA', 'MIN': 'MIN', 'NE': 'NE', 'NO': 'NO', 'NYG': 'NYG',
  'NYJ': 'NYJ', 'PHI': 'PHI', 'PIT': 'PIT', 'SF': 'SF', 'SEA': 'SEA', 'TB': 'TB',
  'TEN': 'TEN', 'WAS': 'WAS', 'WSH': 'WAS'
};

async function fetchESPNSchedule(season: string, week: string): Promise<Record<string, { start: number; state: 'pre' | 'in' | 'post' }>> {
  const cacheKey = `${season}-${week}`;
  const cached = scheduleCache.get(cacheKey);
  
  // Return cached data if still valid
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  try {
    // Use NFL scoreboard API which has current data
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`ESPN API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check what week ESPN is actually returning
    const espnWeek = data.week?.number;
    const espnSeason = data.season?.year;
    const requestedWeek = parseInt(week, 10);
    const requestedSeason = parseInt(season, 10);
    
    // If the requested week is in the future compared to ESPN's current data,
    // return an empty schedule (no games locked, all players available)
    if (espnWeek && espnSeason) {
      if (requestedSeason > espnSeason || (requestedSeason === espnSeason && requestedWeek > espnWeek)) {
        console.log(`Requested week ${requestedWeek} is in the future (ESPN shows week ${espnWeek}), returning empty schedule`);
        const emptySchedule = {};
        scheduleCache.set(cacheKey, {
          data: emptySchedule,
          expiry: Date.now() + 5 * 60 * 1000
        });
        return emptySchedule;
      }
    }
    
    const schedule: Record<string, { start: number; state: 'pre' | 'in' | 'post' }> = {};
    
    // Parse ESPN scoreboard data
    if (data.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        if (event.competitions && event.competitions[0]) {
          const competition = event.competitions[0];
          const status = competition.status;
          const startDate = new Date(competition.date).getTime();
          
          // Map ESPN status to our states
          let state: 'pre' | 'in' | 'post' = 'pre';
          if (status.type.state === 'in') {
            state = 'in';
          } else if (status.type.state === 'post') {
            state = 'post';
          }
          
          // Add both teams to schedule
          if (competition.competitors) {
            for (const competitor of competition.competitors) {
              const teamAbbrev = competitor.team?.abbreviation;
              if (teamAbbrev && ESPN_TEAM_MAP[teamAbbrev]) {
                schedule[ESPN_TEAM_MAP[teamAbbrev]] = {
                  start: startDate,
                  state: state
                };
              }
            }
          }
        }
      }
    }
    
    // Cache for 5 minutes
    scheduleCache.set(cacheKey, {
      data: schedule,
      expiry: Date.now() + 5 * 60 * 1000
    });
    
    return schedule;
  } catch (error) {
    console.error('Failed to fetch ESPN schedule:', error);
    
    // Return cached data even if expired as fallback
    if (cached) {
      return cached.data;
    }
    
    // Return empty schedule as last resort
    return {};
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get game schedule and status for a specific week/season
  app.get("/api/schedule", async (req, res) => {
    try {
      const { season, week } = req.query;
      
      // Validate parameters
      if (!season || !week) {
        return res.status(400).json({ message: "Season and week parameters are required" });
      }
      
      const seasonNum = parseInt(season as string, 10);
      const weekNum = parseInt(week as string, 10);
      
      if (isNaN(seasonNum) || isNaN(weekNum) || seasonNum < 2020 || seasonNum > 2030 || weekNum < 1 || weekNum > 18) {
        return res.status(400).json({ message: "Invalid season or week parameter" });
      }
      
      const schedule = await fetchESPNSchedule(season as string, week as string);
      res.json(schedule);
    } catch (error) {
      console.error('Schedule API error:', error);
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });
  
  // Get projections for a specific week/season
  app.get("/api/projections/:season/:week", async (req, res) => {
    try {
      const { season, week } = req.params;
      const projections = await storage.getProjections(week, season);
      res.json(projections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projections" });
    }
  });

  // Create a new projection
  app.post("/api/projections", async (req, res) => {
    try {
      const validatedData = insertProjectionSchema.parse(req.body);
      const projection = await storage.createProjection(validatedData);
      res.json(projection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid projection data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create projection" });
      }
    }
  });

  // Update a projection
  app.patch("/api/projections/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertProjectionSchema.partial().parse(req.body);
      const projection = await storage.updateProjection(id, validatedData);
      
      if (!projection) {
        return res.status(404).json({ message: "Projection not found" });
      }
      
      res.json(projection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid projection data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update projection" });
      }
    }
  });

  // Delete a projection
  app.delete("/api/projections/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteProjection(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Projection not found" });
      }
      
      res.json({ message: "Projection deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete projection" });
    }
  });

  // Bulk upload projections (replaces existing for week/season)
  app.post("/api/projections/bulk", async (req, res) => {
    try {
      const { week, season, projections } = req.body;
      
      if (!week || !season || !Array.isArray(projections)) {
        return res.status(400).json({ message: "Week, season, and projections array are required" });
      }

      // Clear existing projections for this week/season
      await storage.clearProjections(week, season);
      
      // Validate and create new projections
      const validatedProjections = projections.map(p => 
        insertProjectionSchema.parse({ ...p, week, season })
      );
      
      const created = await storage.bulkCreateProjections(validatedProjections);
      res.json({ message: `Successfully uploaded ${created.length} projections`, projections: created });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid projection data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to bulk upload projections" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
