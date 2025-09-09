import { type User, type InsertUser, type Projection, type InsertProjection } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getProjections(week: string, season: string): Promise<Projection[]>;
  getProjectionByPlayer(week: string, season: string, sleeperId?: string, name?: string, team?: string, pos?: string): Promise<Projection | undefined>;
  createProjection(projection: InsertProjection): Promise<Projection>;
  updateProjection(id: string, projection: Partial<InsertProjection>): Promise<Projection | undefined>;
  deleteProjection(id: string): Promise<boolean>;
  bulkCreateProjections(projections: InsertProjection[]): Promise<Projection[]>;
  clearProjections(week: string, season: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projections: Map<string, Projection>;

  constructor() {
    this.users = new Map();
    this.projections = new Map();
    
    // Initialize with some default projections for demo
    this.initializeDefaultProjections();
  }

  private initializeDefaultProjections() {
    const defaultProjections: InsertProjection[] = [
      { week: "15", season: "2025", sleeper_id: "4034", name: "Josh Allen", team: "BUF", pos: "QB", proj: 22.4, opp: "@DET" },
      { week: "15", season: "2025", sleeper_id: "4881", name: "Lamar Jackson", team: "BAL", pos: "QB", proj: 25.1, opp: "vs NYG" },
      { week: "15", season: "2025", sleeper_id: "6787", name: "Christian McCaffrey", team: "SF", pos: "RB", proj: 18.9, opp: "@LA" },
      { week: "15", season: "2025", sleeper_id: "7526", name: "Saquon Barkley", team: "PHI", pos: "RB", proj: 16.7, opp: "vs WAS" },
      { week: "15", season: "2025", sleeper_id: "5870", name: "Aaron Jones", team: "MIN", pos: "RB", proj: 17.8, opp: "vs CHI" },
      { week: "15", season: "2025", sleeper_id: "6794", name: "Tyreek Hill", team: "MIA", pos: "WR", proj: 17.2, opp: "vs HOU" },
      { week: "15", season: "2025", sleeper_id: "6786", name: "CeeDee Lamb", team: "DAL", pos: "WR", proj: 0.0, opp: "BYE" },
      { week: "15", season: "2025", sleeper_id: "6792", name: "Ja'Marr Chase", team: "CIN", pos: "WR", proj: 19.6, opp: "vs TEN" },
      { week: "15", season: "2025", sleeper_id: "4046", name: "Travis Kelce", team: "KC", pos: "TE", proj: 12.8, opp: "vs CLE" },
      { week: "15", season: "2025", sleeper_id: "6797", name: "DeAndre Hopkins", team: "TEN", pos: "WR", proj: 13.5, opp: "@CIN" },
    ];
    
    defaultProjections.forEach(proj => {
      this.createProjection(proj);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getProjections(week: string, season: string): Promise<Projection[]> {
    return Array.from(this.projections.values()).filter(
      p => p.week === week && p.season === season
    );
  }

  async getProjectionByPlayer(
    week: string, 
    season: string, 
    sleeperId?: string, 
    name?: string, 
    team?: string, 
    pos?: string
  ): Promise<Projection | undefined> {
    const projections = await this.getProjections(week, season);
    
    if (sleeperId) {
      const found = projections.find(p => p.sleeper_id === sleeperId);
      if (found) return found;
    }
    
    if (name && team && pos) {
      return projections.find(p => 
        p.name.toLowerCase() === name.toLowerCase() &&
        p.team === team &&
        p.pos === pos
      );
    }
    
    return undefined;
  }

  async createProjection(projection: InsertProjection): Promise<Projection> {
    const id = randomUUID();
    const proj: Projection = { 
      ...projection, 
      id, 
      updated_at: new Date() 
    };
    this.projections.set(id, proj);
    return proj;
  }

  async updateProjection(id: string, projection: Partial<InsertProjection>): Promise<Projection | undefined> {
    const existing = this.projections.get(id);
    if (!existing) return undefined;
    
    const updated: Projection = { 
      ...existing, 
      ...projection, 
      updated_at: new Date() 
    };
    this.projections.set(id, updated);
    return updated;
  }

  async deleteProjection(id: string): Promise<boolean> {
    return this.projections.delete(id);
  }

  async bulkCreateProjections(projections: InsertProjection[]): Promise<Projection[]> {
    const results: Projection[] = [];
    for (const proj of projections) {
      results.push(await this.createProjection(proj));
    }
    return results;
  }

  async clearProjections(week: string, season: string): Promise<void> {
    const toDelete = Array.from(this.projections.entries())
      .filter(([_, proj]) => proj.week === week && proj.season === season)
      .map(([id, _]) => id);
    
    toDelete.forEach(id => this.projections.delete(id));
  }
}

export const storage = new MemStorage();
