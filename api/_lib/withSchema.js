const { ensureSchema } = require('./db');

module.exports = (handler) => async (req, res) => {
  try { res.setHeader('Content-Type', 'application/json; charset=utf-8'); } catch(e){}
  try { await ensureSchema(); }
  catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok:false, error: e.message })); }
  return handler(req, res);
};
