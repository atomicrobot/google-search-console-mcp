declare namespace Express {
  interface Request {
    user?: {
      email: string;
      domain: string;
    };
    log: import("./lib/logger").RequestLogger;
    auth?: import("@modelcontextprotocol/sdk/server/auth/types.js").AuthInfo;
  }
}
