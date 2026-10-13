import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { HttpError, badRequest } from '../lib/errors.js';
import type { AccountService } from '../services/account.js';
import type { User } from '../store/models.js';

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join('.')} : ` : '';
    throw badRequest(`${path}${issue?.message ?? 'Données invalides'}`, 'validation_error');
  }
  return result.data;
}

export function bearerToken(req: Request): string | undefined {
  const header = req.header('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

export function requireAuth(accounts: AccountService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = accounts.userForToken(bearerToken(req));
    if (!user) throw new HttpError(401, 'Connexion requise', 'unauthorized');
    res.locals.user = user;
    next();
  };
}

export const currentUser = (res: Response): User => res.locals.user as User;
