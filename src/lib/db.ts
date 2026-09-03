import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cache = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cache;

export async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en las variables de entorno.");
  }
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
  });
  cache.conn = await cache.promise;
  return cache.conn;
}
