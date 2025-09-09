import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const projections = pgTable("projections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  week: text("week").notNull(),
  season: text("season").notNull(),
  sleeper_id: text("sleeper_id"),
  name: text("name").notNull(),
  team: text("team"),
  pos: text("pos").notNull(),
  proj: real("proj").notNull(),
  opp: text("opp"),
  updated_at: timestamp("updated_at").default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertProjectionSchema = createInsertSchema(projections).omit({
  id: true,
  updated_at: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Projection = typeof projections.$inferSelect;
export type InsertProjection = z.infer<typeof insertProjectionSchema>;
