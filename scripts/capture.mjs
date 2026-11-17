import { chromium } from 'playwright';
import { resolve } from 'node:path';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page = await browser.newPage({ viewport:{width:1680,height:960},deviceScaleFactor:1 });
 page.setDefaultTimeout(120000);
 page.on('pageerror',e=>console.log('PAGE ERROR:',e.message));
 page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE:',m.text());});
 await page.route('http://127.0.0.1:4173/',route=>route.fulfill({path:resolve('dist/index.html'),contentType:'text/html'}));
 await page.goto('http://127.0.0.1:4173/');
 await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:120000});
 await page.locator('#motion').click();
 await page.waitForTimeout(1500);
 console.log(await page.evaluate(()=>({plates:window.__sushi.plates.map(p=>p.name),objects:window.__sushi.model.children.length,position:window.__sushi.camera.position.toArray()})));
 await page.screenshot({path:'artifacts/scene-desktop.png',timeout:120000});
} finally {await browser.close();}
