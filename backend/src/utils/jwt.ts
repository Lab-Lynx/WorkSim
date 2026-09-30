import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  id: string;
  role: string;
}

export interface RefreshTokenPayload {
  id: string;
}

export const generateAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessTokenPayload;

export const generateRefreshToken = (payload: RefreshTokenPayload): string =>
  jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    jwtid: randomUUID(),
  });

export const verifyRefreshToken = (token: string): RefreshTokenPayload =>
  jwt.verify(token, env.REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
