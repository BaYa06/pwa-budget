const { ensureSchema } = require('./db');

module.exports = (handler) => async (req, res) => {
  try { res.setHeader('Content-Type','application/json; charset=utf-8'); } catch(e){}
  try {
    await ensureSchema();
  } catch (e) {
    console.error('[API ensureSchema error]', e);   // ← лог в консоль
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok:false, error: e.message }));
  }
  try {
    return await handler(req, res);
  } catch (e) {
    console.error('[API handler error]', e);        // ← лог в консоль
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok:false, error: e.message }));
  }
};
