import mongoose from "mongoose";

// One shared connection per running instance. On a long-running server
// (e.g. local development) this connects once at startup. On Vercel, where instances start on
// demand, the first request connects and later requests reuse it.
let connectionPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (!connectionPromise) {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not set.");
    }

    connectionPromise = mongoose
      .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 })
      .then((instance) => {
        console.log("MONGODB CONNECTED ");
        return instance.connection;
      })
      .catch((error) => {
        // Let the next request try again instead of caching the failure.
        connectionPromise = null;
        console.error("MongoDB Connection Error : ", error);
        throw error;
      });
  }

  return connectionPromise;
};

export default connectDB;
