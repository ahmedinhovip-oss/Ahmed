// Records the 20 s film frame by frame: node film/record.cjs <absolute path to page.html> <frames dir>
const fs=require('fs');
// the machine's own Playwright first (its browser is installed); the teardown skill's copy otherwise
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(require('path').resolve(__dirname, '../../../../.claude/skills/teardown/node_modules/playwright')); }
const {chromium} = pw;
const page=process.argv[2], dir=process.argv[3], mode='render', FPS=30, N=20*FPS;
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1600,height:900}});
 p.on('pageerror',e=>console.log('PAGEERR',e.message));
 await p.goto('file://'+page+'#film');
 await p.waitForTimeout(1000);
 if(mode==='check') await p.evaluate(()=>SIM.st.renderer.setPixelRatio(0.05));
 const t0=Date.now();
 for(let f=0;f<N;f++){
   await p.evaluate((dt)=>SIM.advance(dt),1/FPS);
   if(mode==='render'){ await p.screenshot({path:`${dir}/f${String(f).padStart(4,'0')}.png`}); if(f%60===0) console.log('frame',f,((Date.now()-t0)/1000).toFixed(0)+'s'); }
   else if(f%15===0) console.log((f/FPS).toFixed(1), await p.evaluate(()=>{const s=SIM.s;return [s.seq,'ch',s.ch.toFixed(0),'al',s.al.toFixed(1),'t',s.mass.toFixed(2),'door',s.door.pos.toFixed(2),'tilt',s.tilt.pos.toFixed(2),'ladle',s.tilt.ladle.toFixed(2),'pump',s.pump.flow.toFixed(2),'fire',s.fire.map(x=>x.toFixed(2)),'al#',s.alarms.map(a=>a.code).join('/'),'log',s.log.map(l=>l.text).join('|')].join(' ')}));
 }
 await b.close();
})();
