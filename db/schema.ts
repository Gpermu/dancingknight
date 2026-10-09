import { integer, sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";
export const sessions = sqliteTable("sessions", {id:text("id").primaryKey(),name:text("name").notNull(),createdAt:integer("created_at").notNull()});
export const rooms=sqliteTable("rooms",{code:text("code").primaryKey(),state:text("state").notNull(),version:integer("version").notNull().default(0),createdAt:integer("created_at").notNull(),updatedAt:integer("updated_at").notNull()});
export const members=sqliteTable("members",{room:text("room").notNull().references(()=>rooms.code),session:text("session").notNull().references(()=>sessions.id)},t=>[primaryKey({columns:[t.room,t.session]})]);
export const messages=sqliteTable("messages",{id:text("id").primaryKey(),room:text("room").notNull().references(()=>rooms.code),session:text("session").notNull(),name:text("name").notNull(),body:text("body").notNull(),createdAt:integer("created_at").notNull()},t=>[index("idx_messages_room_time").on(t.room,t.createdAt)]);
export const matchQueue=sqliteTable('match_queue',{
 session:text('session').primaryKey().references(()=>sessions.id),ticket:text('ticket').notNull(),name:text('name').notNull(),variant:text('variant').notNull(),control:text('control').notNull(),room:text('room').references(()=>rooms.code),expiresAt:integer('expires_at').notNull(),createdAt:integer('created_at').notNull()
},t=>[index('idx_match_queue_search').on(t.variant,t.control,t.room,t.expiresAt)]);
