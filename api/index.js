// Simple central router for Vercel to keep functions count low (Hobby limit)
const url = require('url');
const { ensureSchema } = require('./_lib/db');

const routes = {
  '/api/health': require('./routes/health'),
  '/api/settings': require('./routes/settings'),
  '/api/groups': require('./routes/groups'),
  '/api/transactions': require('./routes/transactions'),
  '/api/budgets': require('./routes/budgets'),
  '/api/planned': require('./routes/planned'),
  '/api/metrics': require('./routes/metrics'),
};

module.exports = async (req, res) => {
  try {
    await ensureSchema();
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok:false, error: 'schema', details: e.message }));
  }

  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const matchKey = Object.keys(routes).find(p => pathname.startsWith(p));
  if (!matchKey) {
    res.statusCode = 404;
    return res.end(JSON.stringify({ ok:false, error:'not_found' }));
  }
  req.query = parsed.query || {};
  req.pathname = pathname;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return routes[matchKey](req, res);
};
