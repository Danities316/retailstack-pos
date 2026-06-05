import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: { userId: string; tenantId: string; role: string; name: string; };
}

// ── Simple in-memory cache ────────────────────────────────────────────────────
// Avoids a DB hit on every request. Entry expires after 5 minutes.
// If a user is deactivated, they can make requests for at most 5 more minutes —
// acceptable for an MVP. Reduce TTL if you need tighter control.
const userCache = new Map<string, { isActive: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function isUserActive(userId: string): Promise<boolean> {
  const now = Date.now();

  // Return cached result if still fresh
  const cached = userCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.isActive;
  }

  // Cache miss or expired — hit the DB
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });

  const isActive = !!user?.isActive;

  // Cache the result (cache both active and inactive — inactive gets evicted
  // naturally, and a deactivated user is blocked until their cache entry expires)
  userCache.set(userId, { isActive, expiresAt: now + CACHE_TTL_MS });

  return isActive;
}

// ── Exported helper to invalidate cache when a user is deactivated ────────────
// Call this from any route that deactivates or deletes a user so the
// cache doesn't keep them active for up to 5 minutes.
export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const bearer = req.headers.authorization;

  if (!bearer || !bearer.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided.' });
    return;
  }

  const [, token] = bearer.split(' ');

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Invalid token format.' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Confirm user still exists and is active in the DB
    const active = await isUserActive(payload.userId);
    if (!active) {
      res.status(401).json({ error: 'Unauthorized: Account is inactive or no longer exists.' });
      return;
    }

    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    return;
  }
};



// import { Request, Response, NextFunction } from 'express';
// import jwt from 'jsonwebtoken';

// export interface AuthRequest extends Request {
//   user?: { userId: string; tenantId: string; role: string; name: string; };
// }

// export const protect = (req: AuthRequest, res: Response, next: NextFunction): void => {
//   const bearer = req.headers.authorization;


//   if (!bearer || !bearer.startsWith('Bearer ')) {
//     res.status(401).json({ error: 'Unauthorized: No token provided.' });
//     return;
//   }

//   const [, token] = bearer.split(' ');

//   if (!token) {
//     res.status(401).json({ error: 'Unauthorized: Invalid token format.' });
//     return;
//   }

//   try {
//     const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
//     req.user = payload;
//     next();
//   } catch (error) {
//     res.status(401).json({ error: 'Unauthorized: Invalid token.' });
//     return;
//   }
// };