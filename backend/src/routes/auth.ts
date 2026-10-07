// backend/src/routes/auth.ts — POST /auth/login [D-05]. 8 h JWT.
import { Router } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { config } from '../config.js';
import { ApiError } from '../middleware/errors.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  '/login',
  rateLimit('login', 10, 15 * 60 * 1000),
  async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const { rows } = await query(
        `SELECT id, email, password_hash, display_name, role, council_id
         FROM users WHERE lower(email) = lower($1) AND is_active`,
        [email],
      );
      const user = rows[0];
      // Verify against a dummy hash too, so unknown emails cost the same.
      const hash = user?.password_hash ?? '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      const ok = await argon2.verify(hash, password).catch(() => false);
      if (!user || !ok) throw new ApiError(401, 'bad_credentials', 'invalid email or password');

      const token = jwt.sign(
        { role: user.role, council_id: user.council_id, name: user.display_name },
        config.jwtSecret,
        { subject: user.id, expiresIn: `${config.jwtTtlHours}h` },
      );
      res.json({
        token,
        user: { id: user.id, display_name: user.display_name, role: user.role, council_id: user.council_id },
      });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
