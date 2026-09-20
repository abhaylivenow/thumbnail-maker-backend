// Populated by auth middleware later.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export {};
