// /api/[[...slug]].js
const { parse } = require('url');
const withSchema = require('./_lib/withSchema');

// подключаем реальные обработчики
const routes = {
  '/api/health':      require('./routes/health'),
  '/api/settings':    require('./routes/settings'),
  '/api/groups':      require('./routes/groups'),
  '/api/transactions':require('./routes/transactions'),
  '/api/budgets':     require('./routes/budgets'),
  '/api/planned':     require('./routes/planned'),
  '/api/metrics':     require('./routes/metrics'),
};

module.exports = withSchema(async (req, res) => {
  const { pathname, query } = parse(req.url, true);
  req.query = query || {};

  // ищем самый длинный совпадающий префикс
  const match = Object.keys(routes)
    .sort((a,b)=> b.length - a.length)
    .find(p => pathname === p || pathname.startsWith(p + '/'));

  if (!match) {
    res.statusCode = 404;
    return res.end(JSON.stringify({ ok:false, error:'not_found' }));
  }

  return routes[match](req, res);
});
