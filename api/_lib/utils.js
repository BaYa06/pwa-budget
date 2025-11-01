function toISODate(dt = new Date()) { return dt.toISOString().slice(0,10); }
function startOfMonth(d=new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d=new Date()) { return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function startOfWeek(d=new Date(), weekStartsOn=1) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  const diff = (day - (weekStartsOn-1) + 7) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0,0,0,0);
  return date;
}
function endOfWeek(d=new Date(), weekStartsOn=1) {
  const start = startOfWeek(d, weekStartsOn);
  const end = new Date(start); end.setDate(start.getDate()+6);
  return end;
}
module.exports = { toISODate, startOfMonth, endOfMonth, startOfWeek, endOfWeek };
