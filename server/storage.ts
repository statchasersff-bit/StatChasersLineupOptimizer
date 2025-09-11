import { type User, type InsertUser, type Projection, type InsertProjection } from "@shared/schema";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

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
  private snapshotPath: string;

  constructor() {
    this.users = new Map();
    this.projections = new Map();
    
    // Set up dev persistence snapshot
    this.snapshotPath = path.resolve(process.cwd(), "server", ".dev_data", "projections.json");
    this.ensureSnapshotDir();
    
    // Load from snapshot first, then initialize defaults if empty
    this.loadSnapshot();
    if (this.projections.size === 0) {
      this.initializeDefaultProjections();
    }
  }

  private ensureSnapshotDir() {
    const dir = path.dirname(this.snapshotPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadSnapshot() {
    try {
      if (fs.existsSync(this.snapshotPath)) {
        const data = fs.readFileSync(this.snapshotPath, 'utf-8');
        const projections: Projection[] = JSON.parse(data);
        
        // Validate and load projections
        projections.forEach(proj => {
          if (proj.id && proj.week && proj.season && typeof proj.proj === 'number') {
            this.projections.set(proj.id, proj);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load projections snapshot:', error);
    }
  }

  private saveSnapshot() {
    try {
      const projections = Array.from(this.projections.values());
      fs.writeFileSync(this.snapshotPath, JSON.stringify(projections, null, 2));
    } catch (error) {
      console.warn('Failed to save projections snapshot:', error);
    }
  }

  private initializeDefaultProjections() {
    const defaultProjections: InsertProjection[] = [
      { week: "2", season: "2025", sleeper_id: "6794", name: "Josh Allen", team: "BUF", pos: "QB", proj: 24.5, stats: {"pass_yds": 275, "pass_tds": 2, "rush_yds": 45, "rush_tds": 0.5} },
      { week: "2", season: "2025", sleeper_id: "4881", name: "Lamar Jackson", team: "BAL", pos: "QB", proj: 23.8, stats: {"pass_yds": 260, "pass_tds": 2, "rush_yds": 65, "rush_tds": 0.4} },
      { week: "2", season: "2025", sleeper_id: "4037", name: "Christian McCaffrey", team: "SF", pos: "RB", proj: 19.2, stats: {"rush_yds": 95, "rush_tds": 1, "rec_yds": 45, "rec": 4} },
      { week: "2", season: "2025", sleeper_id: "4046", name: "Derrick Henry", team: "BAL", pos: "RB", proj: 16.8, stats: {"rush_yds": 85, "rush_tds": 1.2, "rec_yds": 15, "rec": 1.5} },
      { week: "2", season: "2025", sleeper_id: "4983", name: "Saquon Barkley", team: "PHI", pos: "RB", proj: 18.5, stats: {"rush_yds": 88, "rush_tds": 1.1, "rec_yds": 35, "rec": 3} },
      { week: "2", season: "2025", sleeper_id: "5917", name: "CeeDee Lamb", team: "DAL", pos: "WR", proj: 16.5, stats: {"rec_yds": 85, "rec": 6, "rec_tds": 0.8} },
      { week: "2", season: "2025", sleeper_id: "4866", name: "Tyreek Hill", team: "MIA", pos: "WR", proj: 15.8, stats: {"rec_yds": 80, "rec": 5.5, "rec_tds": 0.7} },
      { week: "2", season: "2025", sleeper_id: "7047", name: "Justin Jefferson", team: "MIN", pos: "WR", proj: 17.1, stats: {"rec_yds": 88, "rec": 6.2, "rec_tds": 0.8} },
      { week: "2", season: "2025", sleeper_id: "6806", name: "Travis Kelce", team: "KC", pos: "TE", proj: 14.2, stats: {"rec_yds": 65, "rec": 5, "rec_tds": 0.6} },
      { week: "2", season: "2025", sleeper_id: "5974", name: "Mark Andrews", team: "BAL", pos: "TE", proj: 12.8, stats: {"rec_yds": 55, "rec": 4.5, "rec_tds": 0.5} },
      { week: "2", season: "2025", sleeper_id: "3163", name: "Justin Tucker", team: "BAL", pos: "K", proj: 9.2, stats: {"fg_made": 1.8, "xp_made": 2.5} },
      { week: "2", season: "2025", sleeper_id: "3977", name: "Pittsburgh", team: "PIT", pos: "DEF", proj: 8.5, stats: {"def_int": 1, "def_sack": 2.5, "def_td": 0.2} },
    ];
    
    defaultProjections.forEach(proj => {
      this.createProjection(proj);
    });
    this.saveSnapshot(); // Save after initialization
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
      sleeper_id: projection.sleeper_id ?? null,
      team: projection.team ?? null, 
      opp: projection.opp ?? null,
      stats: projection.stats ?? null,
      id, 
      updated_at: new Date() 
    };
    this.projections.set(id, proj);
    this.saveSnapshot();
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
    this.saveSnapshot();
    return updated;
  }

  async deleteProjection(id: string): Promise<boolean> {
    const result = this.projections.delete(id);
    if (result) this.saveSnapshot();
    return result;
  }

  async bulkCreateProjections(projections: InsertProjection[]): Promise<Projection[]> {
    const results: Projection[] = [];
    for (const proj of projections) {
      const id = randomUUID();
      const projection: Projection = { 
        ...proj,
        sleeper_id: proj.sleeper_id ?? null,
        team: proj.team ?? null, 
        opp: proj.opp ?? null,
        stats: proj.stats ?? null,
        id, 
        updated_at: new Date() 
      };
      this.projections.set(id, projection);
      results.push(projection);
    }
    this.saveSnapshot();
    return results;
  }

  async clearProjections(week: string, season: string): Promise<void> {
    const toDelete = Array.from(this.projections.entries())
      .filter(([_, proj]) => proj.week === week && proj.season === season)
      .map(([id, _]) => id);
    
    toDelete.forEach(id => this.projections.delete(id));
    if (toDelete.length > 0) this.saveSnapshot();
  }
}

export const storage = new MemStorage();
