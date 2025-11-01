module.exports = async (req, res) => {
  res.end(JSON.stringify({ ok:true, ts: Date.now() }));
};
