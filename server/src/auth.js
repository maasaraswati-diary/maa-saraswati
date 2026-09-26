import jwt from 'jsonwebtoken';

const JWT_SECRET =
  process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
const TOKEN_TTL = '12h';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function readBearer(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Rejects the request with 401 unless a valid admin token is present. */
export function requireAdmin(req, res, next) {
  const token = readBearer(req);
  if (!token) {
    return res.status(401).json({ error: 'Please log in to continue.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    req.user = payload;
    return next();
  } catch {
    return res
      .status(401)
      .json({ error: 'Your session has expired. Please log in again.' });
  }
}
