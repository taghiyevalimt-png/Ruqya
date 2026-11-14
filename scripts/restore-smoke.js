// Smoke test of a restored copy: open the app (a copy made by tools/configure.py that points at the restored stack),
// sign in as the temporary admin, check that the calendar loads with no console errors, page errors or CSP violations,
// and that the number of appointments the app itself loads for that admin (the Excel export loads every appointment)
// equals count(*) of public.appts in the restored database.
// Prints counts and pass/fail only: never names, phones or other row contents, no screenshots.
// env: SITE_URL, TEST_EMAIL, TEST_PASSWORD, EXPECTED_APPTS
//      MOCK_LIB=<path to a supabase-js mock> only for testing this script against the demo mock (no database).
const {chromium}=require('playwright');const fs=require('fs');
const env=k=>{const v=process.env[k];if(!v){console.error('missing env '+k);process.exit(2)}return v};
const SITE=env('SITE_URL'),MAIL=env('TEST_EMAIL'),PASS=env('TEST_PASSWORD');
// console texts can quote data (URLs with filters, error details): keep only their shape
const clean=t=>String(t).replace(/\?[^\s"')]*/g,'?…').replace(/"[^"]*"/g,'"…"').replace(/'[^']*'/g,"'…'").slice(0,240);
(async()=>{
  const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:900}});const p=await ctx.newPage();
  const errs=[],cons=[],bad=[];
  p.on('pageerror',e=>errs.push(clean(e.message)));
  p.on('console',m=>{if(m.type()==='error')cons.push(clean(m.text()))});
  p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.request().method()+' '+clean(r.url()))});
  if(process.env.MOCK_LIB){
    await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
    await p.route('**/supabase*.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(process.env.MOCK_LIB,'utf8')}));
    if(process.env.MOCK_SEED)await p.addInitScript({content:fs.readFileSync(process.env.MOCK_SEED,'utf8')});
  }
  await p.addInitScript(()=>{window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+String(e.blockedURI).replace(/\?.*/,'')))});
  const fail=async m=>{console.log('FAIL '+m);console.log(JSON.stringify({pageErrors:errs,consoleErrors:cons,httpErrors:bad,csp:await p.evaluate(()=>window.__csp).catch(()=>[])},null,1));await b.close();process.exit(1)};
  await p.goto(SITE,{waitUntil:'load'});
  await p.waitForSelector('#l-mail',{timeout:30000}).catch(()=>fail('sign-in form did not appear'));
  await p.fill('#l-mail',MAIL);await p.fill('#l-pass',PASS);await p.click('[data-act=login]');
  await p.waitForSelector('#cal',{timeout:30000}).catch(()=>fail('calendar did not load after sign-in'));
  await p.waitForTimeout(3000);   // initial loads, realtime subscription, settings check
  const alerts=await p.$$eval('#main [role=alert], #main .err',x=>x.filter(e=>!e.hidden&&e.offsetParent!==null).length);
  if(alerts)await fail('the calendar shows '+alerts+' error message(s)');
  // what the app loads for this admin: the Excel export fetches every appointment through the app's own client
  await p.click('[data-tab=stats]');
  await p.waitForSelector('[data-act=xls]',{timeout:20000}).catch(()=>fail('no Excel button: the test user is not seen as admin'));
  await p.click('[data-act=xls]');
  const re=/Fayl hazırdır: (\d+) vərəq, (\d+) qəbul|Файл готов: (\d+) .*?, (\d+)/;
  await p.waitForFunction(r=>{const s=document.querySelector('#sheet');return s&&(new RegExp(r).test(s.textContent)||/Faylı hazırlamaq olmadı/.test(s.textContent))},re.source,{timeout:60000}).catch(()=>fail('Excel export did not finish'));
  const m=(await p.textContent('#sheet')).match(re);if(!m)await fail('Excel export failed in the app');
  const seen=+(m[2]||m[4]);
  const expected=process.env.MOCK_LIB&&process.env.EXPECTED_APPTS==='mock'?await p.evaluate(()=>window.__T.appts.length):+env('EXPECTED_APPTS');
  const csp=await p.evaluate(()=>window.__csp);
  console.log(JSON.stringify({appointmentsSeenByApp:seen,appointmentsInDatabase:expected,consoleErrors:cons.length,pageErrors:errs.length,cspViolations:csp.length,httpErrors:bad.length}));
  if(errs.length||cons.length||csp.length)await fail('errors in the page');
  if(seen!==expected)await fail('the app sees '+seen+' appointments, the database has '+expected);
  console.log('PASS restored copy: calendar loads without errors and the admin sees all '+seen+' appointments');
  await b.close();
})().catch(e=>{console.log('FAIL '+clean(e.message));process.exit(1)});
