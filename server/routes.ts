import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
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
