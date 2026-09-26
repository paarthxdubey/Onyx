/**
 * MongoDB/Mongoose connection singleton for Next.js.
 * Caches the connection on `global` in development to avoid hot-reload storms.
 */

import mongoose from "mongoose"

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
}

if (!global.mongooseCache) {
  global.mongooseCache = cached
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI

  if (!uri) {
    throw new Error("MONGODB_URI is not set")
  }

  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri)
  }

  cached.conn = await cached.promise
  return cached.conn
}
