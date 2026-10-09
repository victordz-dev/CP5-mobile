import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../services/firebaseAdmin';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const match = typeof authHeader === 'string' ? /^Bearer\s+(\S+)$/i.exec(authHeader) : null;
  if (!match) {
    res.status(401).json({ error: 'Token de autenticação ausente ou inválido.' });
    return;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(match[1], true);
    (req as AuthenticatedRequest).user = decodedToken;
    next();
  } catch {
    res.status(401).json({ error: 'A sessão expirou ou foi revogada. Entre novamente.' });
  }
};
