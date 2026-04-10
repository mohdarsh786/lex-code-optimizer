import mongoose from "mongoose";

// Use process.env to access the variable from .env file
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI in environment variables");
}

/* ... rest of the file remains the same ... */

/* ---------------- TYPES ---------------- */

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

/* ------------- GLOBAL DECL ------------- */

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined;
}

/* -------- ENSURE SINGLE INSTANCE -------- */

const cached: MongooseCache =
  global.mongoose ?? (global.mongoose = { conn: null, promise: null });

/* --------------- CONNECT --------------- */

export default async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
