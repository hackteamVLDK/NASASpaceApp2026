import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paintSoilDetail, planSoilRocks, soilPalette, soilProfile, SOIL_ZONES } from '../src/render/soil-detail.js';
import { buildSoil, SOIL } from '../src/render/world.js';
import { WORLD } from '../src/data/base-layout.js';

// Same deterministic hash used by the world; fixtures operate on actual RGBA buffers.
const hash = (a,b) => { let h=(a*374761393+b*668265263)|0;h=(h^(h>>>13))*1274126177;return ((h^(h>>>16))>>>0)/4294967296; };
function fixture(w=480,h=1000,corrupt=false) {
  const data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
    const p=(y*w+x)*4;
    data.set(corrupt&&y>=29 ? [240,10,210,255] : [156,78,51,y<20?0:255],p);
  }
  const ctx={getImageData:()=>({data}),putImageData:img=>assert.equal(img.data,data)};
  return {data,ctx,w,h};
}
const pixel=(f,x,y)=>Array.from(f.data.slice((y*f.w+x)*4,(y*f.w+x)*4+4));
const options=f=>({w:f.w,h:f.h,groundPx:20,hash,avoid:[],ice:[]});

test('soil geometry is continuous across the whole width, including every former tile seam',()=>{
  const p=soilProfile(2350,hash);
  for(let x=1;x<2350;x++)for(const boundary of [p.wave,p.erosionAt,p.basaltAt]) {
    assert.ok(Math.abs(boundary(x)-boundary(x-1))<0.25,`jump at ${x}`);
  }
  assert.deepEqual(p.deltaAt(0).strength,0);
  assert.deepEqual(p.deltaAt(2349).strength,0);
  const visible=Array.from({length:2350},(_,x)=>p.deltaAt(x).strength>0);
  assert.equal(visible.filter((v,i)=>v&&!visible[i-1]).length,1,'only one delta region');
  assert.ok(visible.filter(Boolean).length<2350/3);
});

test('whole rocks avoid rooms, ice and each other; deeper stones have larger radii',()=>{
  const o={w:2350,h:1105,groundPx:20,hash,avoid:[{x:900,y:100,w:500,h:520}],ice:[{x:600,y:800}]};
  const rocks=planSoilRocks(o);
  assert.deepEqual(rocks,planSoilRocks(o));
  assert.ok(rocks.length>60&&rocks.length<110,'sparse compared with the old 600 rocks');
  assert.equal(rocks.filter(r=>r.meteorite).length,2);
  for(const [i,r] of rocks.entries()) {
    assert.ok(Number.isInteger(r.x)&&Number.isInteger(r.y)&&Number.isInteger(r.r));
    assert.ok(r.x-r.r>=0&&r.x+r.r<o.w&&r.y-r.r>20&&r.y+r.r<o.h);
    for(const a of o.avoid)assert.ok(r.x+r.r<a.x||r.x-r.r>a.x+a.w||r.y+r.r<a.y||r.y-r.r>a.y+a.h);
    assert.ok(Math.abs(r.x-600)>r.r+21||Math.abs(r.y-800)>r.r+8);
    for(const other of rocks.slice(0,i))assert.ok(Math.hypot(r.x-other.x,r.y-other.y)>=r.r+other.r+12);
  }
  const mean=list=>list.reduce((s,r)=>s+r.r,0)/list.length;
  assert.ok(mean(rocks.filter(r=>r.y>750))>mean(rocks.filter(r=>r.y<350)));
});

test('painting replaces underlying tile patterns everywhere, including behind rooms',()=>{
  const a=fixture(),b=fixture(480,1000,true),o={...options(a),avoid:[{x:180,y:170,w:100,h:260}]};
  assert.equal(paintSoilDetail(a.ctx,o),true);
  assert.equal(paintSoilDetail(b.ctx,o),true);
  assert.deepEqual(a.data,b.data,'no original texture or rectangular mask leaks through');
  const copy=fixture();paintSoilDetail(copy.ctx,o);assert.deepEqual(copy.data,a.data,'repeatable RGBA output');
  for(let y=180;y<420;y++) {
    const left=pixel(a,179,y),inside=pixel(a,180,y),right=pixel(a,281,y),near=pixel(a,280,y);
    for(let c=0;c<3;c++) {
      assert.ok(Math.abs(left[c]-inside[c])<=4,'smooth left room margin');
      assert.ok(Math.abs(right[c]-near[c])<=4,'smooth right room margin');
    }
  }
});

test('surface and ice centres survive; mineral seams never glow and bedrock has no grid',()=>{
  const f=fixture(),o={...options(f),ice:[{x:400,y:900}],depthGradient:[[0,0],[1,0]]};
  const surface=f.data.slice(0,29*f.w*4);
  paintSoilDetail(f.ctx,o);
  assert.deepEqual(f.data.slice(0,29*f.w*4),surface,'same surface strip without depth tint');
  assert.deepEqual(pixel(f,400,900),[206,232,246,255]);
  assert.deepEqual(pixel(f,421,900),[255,255,255,255]);
  for(let y=29;y<f.h;y++)for(let x=0;x<f.w;x++) {
    if(Math.abs(x-400)<=21&&Math.abs(y-900)<=8)continue;
    assert.ok(Math.max(...pixel(f,x,y).slice(0,3))<210,'no white/yellow emissive decoration');
  }
  // A clear bedrock patch without rocks/cracks should not have regularly spaced mortar rows.
  const jumps=[];
  for(let y=20+SOIL_ZONES.basalt+100;y<f.h-20;y++) {
    let sum=0;for(let x=0;x<300;x++)sum+=Math.abs(pixel(f,x,y)[0]-pixel(f,x,y-1)[0]);
    jumps.push(sum/300); // exclude the intentional bright ice lens at x=400
  }
  assert.ok(jumps.filter(n=>n>2).length<3,'no repeated horizontal bedrock joints');
});

test('palette uses opaque tile midtones and ignores source patterns and bright flecks',()=>{
  const d=new Uint8ClampedArray(400*40*4);
  for(let y=0;y<40;y++)for(let x=0;x<400;x++) {
    const c=x<160?[150,80,50]:x<320?[110,75,60]:[75,70,72];
    d.set(x%10===0?[255,255,255,255]:[...c,255],(y*400+x)*4);
  }
  assert.deepEqual(soilPalette(d),[[150,80,50],[110,75,60],[75,70,72]]);
  assert.deepEqual(soilPalette(new Uint8ClampedArray(d.length)),soilPalette());
});

test('buildSoil keeps its canvas dimensions and works without terrain or pixel access',()=>{
  const original=globalThis.document,canvases=[];
  globalThis.document={createElement:()=>{
    const c={width:0,height:0,getContext:()=>({fillRect(){},getImageData(){throw Error('unavailable');},createLinearGradient:()=>({addColorStop(){}})})};
    canvases.push(c);return c;
  }};
  try {
    const c=buildSoil({has:()=>false});
    assert.equal(c.width,Math.round((SOIL.x1-SOIL.x0)*SOIL.scale));
    assert.equal(c.height,Math.round((WORLD.height-WORLD.groundY+60)*SOIL.scale));
    assert.equal(canvases.length,1);
  } finally {if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});
