const { query } = require('../_lib/db');
async function getSettings(){ return (await query(`select * from settings order by id asc limit 1;`)).rows[0]; }
module.exports = async (req, res) => {
  if (req.method === 'GET'){ const s = await getSettings(); return res.end(JSON.stringify({ ok:true, data:s })); }
  if (req.method === 'PUT' || req.method === 'POST'){
    let body=''; req.on('data', ch=> body+=ch);
    req.on('end', async ()=>{
      try{
        const data = JSON.parse(body||'{}'); const curr = await getSettings();
        const fields = ['initial_balance','currency','period_mode','week_starts_on','pin_enabled'];
        const values = fields.map(k => data[k] !== undefined ? data[k] : curr[k]);
        await query(`update settings set initial_balance=$1,currency=$2,period_mode=$3,week_starts_on=$4,pin_enabled=$5 where id=$6`,[...values, curr.id]);
        const updated = await getSettings(); res.end(JSON.stringify({ ok:true, data: updated }));
      }catch(e){ res.statusCode=400; res.end(JSON.stringify({ ok:false, error:e.message })); }
    }); return;
  }
  res.statusCode=405; res.end(JSON.stringify({ ok:false, error:'method_not_allowed'}));
};