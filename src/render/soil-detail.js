/**
 * Procedural development stand-in, baked ONCE by buildSoil at 0.5 px/world unit.
 * Crisp whole pixels; all variation uses world.js's deterministic hash.
 * Palette comes from terrain swatches, never from a mosaic under the picture.
 *
 * Science notes (citations and provenance in campaign/sources.js, SOIL_SOURCES):
 * layers      approximation    RIMFAX: lake sediments, erosion, a buried tilted delta
 * colour      nasa_measurement iron-oxide rust/ochre, greyer basalt with depth
 * bedrock     nasa_measurement volcanic rock on the Jezero crater floor
 * boulders    nasa_measurement flood-carried boulders in the Jezero delta
 * veins       nasa_measurement pale calcium sulfate filling cracks (Curiosity)
 * meteorite   nasa_measurement iron-nickel meteorite Cacao (Curiosity)
 * ice lenses  gameplay         see drawIce: ice here is not a Jezero measurement
 * cracks, pebbles, tracks      gameplay decoration
 * Layout, sizes, spacing, colours and depths below are illustrative render choices
 * (approximation/gameplay), not measured dimensions or simulation parameters.
 */
export const SOIL_ZONES = Object.freeze({ surfaceBand: 60, erosion: 335, basalt: 615 });
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = v => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const blend = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const shade = (c, n) => c.map(v => Math.max(0, Math.min(255, v + n)));
const grey = (c, t) => blend(c, Array(3).fill((c[0] + c[1] + c[2]) / 3), t);

/** Continuous value noise; knots have no discontinuity (including former 40 px tile edges). */
function noise(x, span, seed, hash) {
  const u = x / span, i = Math.floor(u);
  return (hash(i, seed) * (1 - smooth(u - i)) + hash(i + 1, seed) * smooth(u - i)) * 2 - 1;
}

/** Geometry shared with regression checks; all depths are relative to the ground in canvas pixels. */
export function soilProfile(w, hash) {
  const wave = x => 7 * noise(x, 190, 71, hash) + 2 * noise(x, 73, 72, hash);
  return {
    wave,
    erosionAt: x => SOIL_ZONES.erosion + wave(x),
    basaltAt: x => SOIL_ZONES.basalt + 9 * noise(x, 240, 73, hash),
    // One buried delta lobe, four inclined beds, tapered at both sides and top/bottom.
    deltaAt: x => ({ top: 425 + (x - w * 0.67) * 0.12 + wave(x), strength: smooth((1 - Math.abs(x - w * 0.67) / (w * 0.16)) * 3) }),
  };
}

/** Reject whole rocks near rooms, ice, edges and each other: never clip a rock into a rectangle. */
export function planSoilRocks({ w, h, groundPx: g, hash, avoid = [], ice = [] }) {
  const rocks = [];
  const exclusions = [...avoid, ...ice.map(p => ({ x: p.x - 24, y: p.y - 11, w: 48, h: 22 }))];
  const count = Math.round(w * Math.max(0, h - g) / 27000);
  for (let i = 0; i < count * 5 && rocks.length < count; i++) {
    const meteorite = rocks.length < 2;
    const x = Math.floor(hash(i, 400) * w);
    const y = meteorite ? g + 100 + Math.floor(hash(i, 402) * 180) : g + 12 + Math.floor(hash(i, 402) * Math.max(1, h - g - 28));
    const depth = clamp01((y - g) / Math.max(1, h - g));
    const r = meteorite ? 4 : 3 + Math.floor(hash(i, 403) * (3 + depth * 12));
    const bounds = { x: x - r, y: y - r, w: r * 2 + 1, h: r * 2 + 1 };
    if (bounds.x < 3 || bounds.y < g + 10 || x + r >= w - 3 || y + r >= h - 3) continue;
    if (exclusions.some(a => bounds.x < a.x + a.w + 6 && bounds.x + bounds.w > a.x - 6 && bounds.y < a.y + a.h + 6 && bounds.y + bounds.h > a.y - 6)) continue;
    if (rocks.some(a => Math.hypot(x - a.x, y - a.y) < r + a.r + 12)) continue;
    rocks.push({ x, y, r, seed: i, meteorite });
  }
  return rocks;
}

/** Median tile colours discard highlights and cracks; no tile's painted texture survives. */
export function soilPalette(swatches) {
  const fallback = [[156, 78, 51], [113, 73, 60], [77, 70, 72]];
  if (!swatches) return fallback;
  return [[0, 4], [4, 8], [8, 10]].map(([from, to], zone) => {
    const colours = [];
    for (let y = 0; y < 40; y++) for (let x = from * 40; x < to * 40; x++) {
      const k = (y * 400 + x) * 4;
      if (swatches[k + 3] > 200) colours.push([swatches[k], swatches[k + 1], swatches[k + 2]]);
    }
    if (!colours.length) return fallback[zone];
    colours.sort((a,b) => a[0]+a[1]+a[2]-b[0]-b[1]-b[2]);
    const middle = colours.slice(Math.floor(colours.length * 0.35), Math.ceil(colours.length * 0.65));
    return [0,1,2].map(c => Math.round(middle.reduce((s,p) => s+p[c],0) / middle.length));
  });
}

/** {w,h,groundPx,hash,avoid,ice,swatches,airlockX,garageX}; all coordinates in soil pixels. */
export function paintSoilDetail(ctx, o) {
  const { w: W, h: H, groundPx: G, hash, avoid = [], ice = [] } = o;
  let img;
  try { img = ctx.getImageData(0, 0, W, H); } catch { return false; }
  const D = img.data, blocked = new Uint8Array(W * H), quiet = new Float32Array(W * H);
  // Smoothly reduce detail around the rooms, while painting the SAME strata through their interiors.
  // Only discrete decorations are blocked; skipping background pixels would expose rectangular seams.
  for (const r of avoid) {
    for (let y = Math.max(G + 9, Math.floor(r.y - 48)); y < Math.min(H, Math.ceil(r.y + r.h + 48)); y++) {
      for (let x = Math.max(0, Math.floor(r.x - 48)); x < Math.min(W, Math.ceil(r.x + r.w + 48)); x++) {
        const dx = Math.max(r.x - x, 0, x - (r.x + r.w)), dy = Math.max(r.y - y, 0, y - (r.y + r.h));
        const k = y * W + x;
        quiet[k] = Math.max(quiet[k], 1 - smooth(Math.hypot(dx, dy) / 48));
        if (dx === 0 && dy === 0) blocked[k] = 1;
      }
    }
  }
  const [top, lower, bed] = soilPalette(o.swatches);
  const low = grey(lower, 0.15), basalt = grey(bed, 0.7);
  const profile = soilProfile(W, hash);
  // Broad, irregularly spaced beds. Each boundary uses the same continuous world coordinate.
  const beds = [];
  for (let d = SOIL_ZONES.surfaceBand, i = 0; d < H - G + 40; i++) {
    beds.push({ depth: d, tone: Math.round((hash(i, 12) - 0.5) * 17) });
    d += 23 + Math.floor(hash(i, 11) * 26);
  }
  const tones = new Int8Array(H + 80), boundaries = new Uint8Array(H + 80);
  for (let i = 0; i < beds.length; i++) {
    const a = beds[i].depth, b = beds[i+1]?.depth ?? tones.length;
    tones.fill(beds[i].tone, a, Math.min(b, tones.length)); boundaries[a] = 1;
  }
  const write = (x,y,c) => { const k=(y*W+x)*4; D[k]=c[0];D[k+1]=c[1];D[k+2]=c[2];D[k+3]=255; };
  const free = (x,y) => x>=0 && x<W && y>=G+9 && y<H && !blocked[y*W+x];
  const mix = (x,y,c,a) => {
    if (!free(x,y)) return;
    const k=(y*W+x)*4, f=a*(1-quiet[y*W+x]*0.4);
    D[k]=Math.round(D[k]+(c[0]-D[k])*f);D[k+1]=Math.round(D[k+1]+(c[1]-D[k+1])*f);D[k+2]=Math.round(D[k+2]+(c[2]-D[k+2])*f);
  };
  // Precompute the broad material transition and depth tint per row, outside the pixel loop.
  const rows = [];
  for(let d=0;d<H-G;d++) {
    let c=blend(top,low,smooth((d-SOIL_ZONES.surfaceBand)/(SOIL_ZONES.erosion+80)));
    c=blend(c,basalt,smooth((d-SOIL_ZONES.basalt+30)/95));
    rows.push(c);
  }
  for (let x=0;x<W;x++) {
    const wob=profile.wave(x), ero=profile.erosionAt(x), bas=profile.basaltAt(x), delta=profile.deltaAt(x);
    for(let y=G+9;y<H;y++) {
      const d=y-G, k=y*W+x, u=Math.max(0,Math.min(tones.length-1,Math.round(d-wob)));
      const sediment=1-smooth((d-bas+20)/45);
      let tone=(tones[u]-(boundaries[u] ? 3 : 0))*sediment;
      if(d<SOIL_ZONES.surfaceBand) tone=8*(1-d/SOIL_ZONES.surfaceBand);
      if(Math.abs(d-ero)<1) tone-=5;
      const t=d-delta.top;
      if(delta.strength>0 && t>0 && t<104) {
        const n=Math.min(3,Math.floor(t/26));
        tone+=(n%2 ? -5 : 4)*delta.strength*smooth(t/18)*smooth((104-t)/18);
      }
      // Very sparse, low contrast grain. No repeating grid or per-tile coordinate.
      if(hash(x,y)>0.982) tone-=3;
      tone*=1-quiet[k]*0.55;
      const c=rows[d], p=k*4;
      D[p]=Math.max(0,c[0]+tone);D[p+1]=Math.max(0,c[1]+tone);D[p+2]=Math.max(0,c[2]+tone);D[p+3]=255;
    }
  }
  const rocks=planSoilRocks(o), occupied=new Uint8Array(W*H);
  for(const {x:cx,y:cy,r,seed,meteorite} of rocks) {
    // A bevelled polygon raster: three solid colours, a one-pixel outline, one upper-left highlight.
    const ry=Math.max(2,Math.round(r*0.72)), bevel=Math.max(1,Math.round(r*(0.25+hash(seed,410)*0.15)));
    const inside=(x,y)=>{
      const dx=x-cx, dy=y-cy;
      return Math.abs(dx)<=r && Math.abs(dy)<=ry &&
        Math.abs(dx)+Math.abs(dy)<=r+ry-bevel-(dx>0&&dy<0?1:0) &&
        !(dx<-r+1 && dy>ry-2);
    };
    const d=cy-G, body=shade(meteorite ? grey(blend(top,basalt,0.65),0.7) : blend(d>SOIL_ZONES.basalt ? basalt : rows[d],basalt,0.25),12);
    const dark=shade(body,-15), light=shade(body,10);
    for(let y=cy-ry;y<=cy+ry;y++) for(let x=cx-r;x<=cx+r;x++) {
      if(!inside(x,y))continue;
      const edge=!inside(x-1,y)||!inside(x+1,y)||!inside(x,y-1)||!inside(x,y+1);
      const highlight=!inside(x-2,y-2) && y<cy && x<cx+Math.round(r/3);
      write(x,y,edge ? dark : highlight ? light : body);occupied[y*W+x]=1;
    }
    if(meteorite) for(let p=0;p<3;p++)write(cx-1+p,cy+(p%2),dark);
  }
  // A few short unbranched mineral seams, gently curved, pale relative to their host rock.
  // They receive the same depth tint as the soil: no emissive mask, yellow or white lightning.
  for(let i=0;i<7;i++) {
    const x0=Math.floor(hash(i,501)*W), y0=G+90+Math.floor(hash(i,502)*Math.max(1,H-G-190));
    const len=30+Math.floor(hash(i,503)*45), dx=hash(i,504)>0.5 ? 1 : -1;
    for(let n=0;n<len;n++) {
      const x=x0+dx*n, y=y0+Math.round(n*0.24+2*noise(n,38,510+i,hash));
      if(free(x,y)&&!occupied[y*W+x]) { const p=(y*W+x)*4;mix(x,y,blend([D[p],D[p+1],D[p+2]],[177,163,147],0.23),1); }
    }
  }
  // Sparse, irregular basalt fractures; no tiled or rectangular joints.
  for(let i=0;i<14;i++) {
    const x0=Math.floor(hash(i,802)*W), y0=G+SOIL_ZONES.basalt+25+Math.floor(hash(i,803)*Math.max(1,H-G-SOIL_ZONES.basalt-90));
    const len=18+Math.floor(hash(i,805)*34), dx=hash(i,804)>0.5?1:-1;
    for(let n=0;n<len;n++) { const x=x0+Math.round(n*0.3*dx+noise(n,17,820+i,hash)*2), y=y0+n;if(free(x,y)&&!occupied[y*W+x])mix(x,y,shade(basalt,-16),0.5); }
  }
  if(o.airlockX!=null && o.garageX!=null) {
    const a=Math.min(o.airlockX,o.garageX),b=Math.max(o.airlockX,o.garageX);
    // Preserve the original surface-strip tracks (above the rebuilt underground pixels).
    for(let x=Math.floor(a);x<b;x++)if(x%5<2)for(const y of [G+3,G+6]) {
      if(x>=0&&x<W&&y>=0&&y<H&&!blocked[y*W+x]) { const p=(y*W+x)*4;D[p]*=0.9;D[p+1]*=0.9;D[p+2]*=0.9; }
    }
  }
  const stops=o.depthGradient??[[0,0],[0.8,0.5],[1,0.72]],tint=o.depthTint??[24,6,12];
  for(let y=0;y<H;y++) {
    const f=y/Math.max(1,H-1);let a=stops.at(-1)[1];
    for(let i=1;i<stops.length;i++)if(f<=stops[i][0]){const [f0,a0]=stops[i-1],[f1,a1]=stops[i];a=a0+(a1-a0)*(f-f0)/(f1-f0);break;}
    for(let x=0,p=y*W*4;x<W;x++,p+=4)for(let c=0;c<3;c++)D[p+c]=Math.round(D[p+c]+(tint[c]-D[p+c])*a);
  }
  drawIce(ice,(x,y,c)=>{if(free(x,y))write(x,y,c);});
  ctx.putImageData(img,0,0);
  return true;
}

/** Gameplay: keep buildSoil's existing ice centres. SWIM maps ice mainly poleward of ~40°;
 * Jezero is ~18° N, so these lenses illustrate a resource, not measured local ice. */
function drawIce(ice,put) {
  for(const {x:cx,y:cy} of ice) {
    const rx=21,ry=8;
    for(let y=-ry;y<=ry;y++)for(let x=-rx;x<=rx;x++) {
      if(x*x/(rx*rx)+y*y/(ry*ry)>1)continue;
      const rim=x*x/((rx-1)*(rx-1))+y*y/((ry-1)*(ry-1))>1;
      put(cx+x,cy+y,rim?[255,255,255]:[206,232,246]);
    }
  }
}
