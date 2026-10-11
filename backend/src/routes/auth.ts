/**
 * ============================================================================
 * AUTHENTICATION ROUTE
 * Login, logout, token refresh
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, AuthResponse, AuthToken } from '../../shared/types';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('auth-route');

// Mock user database (replace with real DB)
const users: Record<string, { email: string; password: string; id: string; role: string }> = {
  'test@example.com': {
    email: 'test@example.com',
    password: 'password123', // In production, use bcrypt
    id: 'user-1',
    role: 'developer',
  },
};

router.post('/login', (req: Request<{}, {}, AuthRequest>, res: Response<AuthResponse>) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required',
    });
  }

  const user = users[email];
  if (!user || user.password !== password) {
    logger.warn('Invalid login attempt', { email });
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password',
    });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET! + '_refresh',
    { expiresIn: '7d' }
  );

  logger.info('User logged in', { userId: user.id, email });

  res.json({
    success: true,
    token: {
      accessToken: token,
      refreshToken,
      expiresIn: 86400,
      tokenType: 'Bearer',
    },
    user: {
      id: user.id,
      email: user.email,
      name: email.split('@')[0],
      role: user.role as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
});

router.post('/logout', (req: Request, res: Response) => {
  logger.info('User logged out');
  res.json({ success: true, message: 'Logged out' });
});

export default router;
