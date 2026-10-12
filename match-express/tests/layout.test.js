// static layout check: every yard route at max bus length vs every parked / queued bus,
// for each yard preset (compact = default, classic = the original wide layout) and every lane count (2-5)
const C=require('./core.js')();
let allMin=9;
for (const Y0 of Object.values(C.YARDS)) for (let NL=C.LANE_MIN; NL<=C.LANE_MAX; NL++){
const Y=Object.assign({},Y0,{LANE_X:C.laneXs(NL,Y0)});
const W=C.BUS_W;
const rect=(x,z,dx,dz,len)=>({x,z,dx,dz,len});
const sep=(a,b)=>{const ax=[[a.dx,a.dz],[-a.dz,a.dx]],bx=[[b.dx,b.dz],[-b.dz,b.dx]],ha=[a.len/2,W/2],hb=[b.len/2,W/2],d=[b.x-a.x,b.z-a.z];let m=-9;
 for(const v of [...ax,...bx]){const p=Math.abs(d[0]*v[0]+d[1]*v[1]);const ra=ha[0]*Math.abs(ax[0][0]*v[0]+ax[0][1]*v[1])+ha[1]*Math.abs(ax[1][0]*v[0]+ax[1][1]*v[1]);const rb=hb[0]*Math.abs(bx[0][0]*v[0]+bx[0][1]*v[1])+hb[1]*Math.abs(bx[1][0]*v[0]+bx[1][1]*v[1]);m=Math.max(m,p-ra-rb);}return m;};
const LENS=[4,6,8,12].map(C.busLen), LMAX=C.busLen(12);
const parked=(k,len)=>rect(Y.BAY_X[k],C.parkZ(len),0,-1,len);
const laneFront=(l,len)=>rect(Y.LANE_X[l],C.laneSlotZ(len),0,-1,len);
let worst=[];
function sweep(name,path,len,statics){
  const o={}; let seg=0, m=9, at='';
  for(let s=0;s<=path.len;s+=0.05){ seg=C.pathAt(path,s,o,seg); const r=rect(o.x,o.z,o.dx,o.dz,len);
    for(const [sn,st] of statics){ const d=sep(r,st); if(d<m){ m=d; at=sn+' @s='+s.toFixed(2); } } }
  worst.push([m,name+' len'+len.toFixed(2)+' vs '+at]);
}
for(const len of LENS){
  // lane -> road, both sides; statics: other lanes' fronts (max len), all parked (max len)
  const mid=(NL-1)/2;
  for(let l=0;l<NL;l++) for(const side of (l===mid?[-1,1]:[l<mid?-1:1])){
    const st=[]; for(let m=0;m<NL;m++) if(m!==l) st.push(['lane'+m,laneFront(m,LMAX)]); for(let k=0;k<5;k++) st.push(['bay'+k,parked(k,LMAX)]);
    sweep(`lane${l}->road(${side})`,C.routeToRoad(Y.LANE_X[l],C.laneSlotZ(len),side,Y),len,st);
  }
  for(let l=0;l<NL;l++) for(let k=0;k<5;k++){
    const st=[]; for(let m=0;m<NL;m++) if(m!==l) st.push(['lane'+m,laneFront(m,LMAX)]); for(let j=0;j<5;j++) if(j!==k) st.push(['bay'+j,parked(j,LMAX)]);
    sweep(`lane${l}->bay${k}`,C.routeLaneToBay(Y.LANE_X[l],C.laneSlotZ(len),k,len,Y),len,st);
  }
  for(let k=0;k<5;k++){
    const st=[]; for(let j=0;j<5;j++) if(j!==k) st.push(['bay'+j,parked(j,LMAX)]);
    sweep(`bay${k}->road`,C.routeBayToRoad(Y.BAY_X[k],C.parkZ(len)),len,st);
    const st2=[]; for(let m=0;m<NL;m++) st2.push(['lane'+m,laneFront(m,LMAX)]); for(let j=0;j<5;j++) if(j!==k) st2.push(['bay'+j,parked(j,LMAX)]);
    const rp=C.routeReturn(k,len,Y.TUNNEL_R,Y); sweep(`return->bay${k}`,rp,len,st2);
  }
}
worst.sort((a,b)=>a[0]-b[0]);
console.log(`[${Y.name} yard, ${NL} lanes]  min separation ${worst[0][0].toFixed(3)}  (${worst[0][1]})`);
allMin=Math.min(allMin,worst[0][0]); worst=[];
}
console.log('min separation (every yard and lane count)',allMin.toFixed(3));

// the drawn queue on the fixed 390 x 844 screen: lanes start in the queue zone; with every lane full of
// 8-seat buses at least 3 per lane are fully visible above the queue tunnel (whose arch begins at QUEUE_BOT, right
// above the booster bar); for any mix of sizes the drawn buses never overlap.  Buses are drawn BUS_DRAW (90%) of
// their simulated size, the ones behind a lane's front bus 1/1.1 of that.
let qFail=0;
const H=C.SCREEN.h, SW=C.SCREEN.w, cam=C.SCREEN_CAM, BUS_H=1.05;
function drawnQueue(caps){                    // sim queue (as createGame stacks it) -> drawn boxes
  const out=[]; let z=C.Z_LANE_TOP+0.12;
  for(const cap of caps){ const len=C.busLen(cap), zc=z+len/2, s=C.dispScale(zc), k=C.BUS_DRAW*s, dz=C.dispZ(zc);
    out.push({cap, s, k, top:dz-k*len/2, bot:dz+k*len/2}); z+=len+C.LANE_GAP; }
  return out;
}
function visible(x, b){                       // the whole drawn bus (wheels to roof) is on screen, above the queue tunnel
  const sx=C.dispSx(C.Z_LANE_TOP), hw=b.k*C.BUS_W/2;
  for(const dx of [-hw,hw]) for(const z of [b.top,b.bot]) for(const y of [0,BUS_H*b.k]){
    const [u,v]=C.project(x*sx+dx,y,z,cam); if(u<0||u>SW||v<0||v>C.SCREEN.QUEUE_BOT*H) return false; }
  return true;
}
for(let NL=C.LANE_MIN; NL<=C.LANE_MAX; NL++){ const LX=C.laneXs(NL,C.YARD), res=[];
  for(let l=0;l<NL;l++){
    const q=drawnQueue(new Array(8).fill(8)), x=LX[l];
    const n=q.filter(b=>visible(x,b)).length, front12=visible(x,drawnQueue([12])[0]);
    const topV=C.project(x*C.dispSx(C.Z_LANE_TOP),0,q[0].top,cam)[1]/H;
    const ok=n>=3 && front12 && q[0].s===1 && q.slice(1).every(b=>Math.abs(b.s-C.DISP.QS)<1e-9) && topV>=C.SCREEN.STATIC_BOT-0.01;
    if(!ok) qFail++; res.push(`${n}${ok?'':' FAIL'}`);
  }
  const gap=(LX[1]-LX[0])*C.dispSx(C.Z_LANE_TOP)-C.BUS_DRAW*C.BUS_W;
  if(!(gap>0.05)) qFail++;
  console.log(`  ${NL} lanes at x ${LX.join(', ')}: eight-seat buses fully visible per lane ${res.join(' / ')} (the front bus and a front 12-seat bus always), gap between lanes ${gap.toFixed(2)} ${gap>0.05?'OK':'FAIL'}`);
}
{ const caps=[4,6,8,12]; let minGap=9;
  for(const a of caps) for(const b of caps) for(const c of caps){ const q=drawnQueue([a,b,c]); for(let i=1;i<q.length;i++) minGap=Math.min(minGap,q[i].top-q[i-1].bot); }
  console.log(`  drawn queue: smallest gap between buses ${minGap.toFixed(3)} ${minGap>0.05?'OK':'FAIL'}`);
  if(!(minGap>0.05)) qFail++;
  const n4=drawnQueue(new Array(10).fill(4)).filter(b=>visible(0,b)).length, n12=drawnQueue(new Array(10).fill(12)).filter(b=>visible(0,b)).length;
  console.log(`  fully visible per lane: ${n4} four-seat, ${n12} twelve-seat buses`);
}
// the screen zones from the top: bar, target zone, static row (bays), queue, the queue tunnel's arch, the booster bar
{ const S=C.SCREEN, z=[S.BAR, S.TARGET_TOP, S.TARGET_BOT, S.STATIC_BOT, S.QUEUE_BOT, S.BOOST_TOP, 1];
  const ok=z.every((v,i)=>!i||v>=z[i-1]) && 1-S.BOOST_TOP>=0.06 && S.BOOST_TOP-S.QUEUE_BOT>=0.02;
  console.log(`  zones (fraction of the height): target ${S.TARGET_TOP}-${S.TARGET_BOT}, bays to ${S.STATIC_BOT}, queue to ${S.QUEUE_BOT}, queue tunnel to ${S.BOOST_TOP}, booster bar ${(1-S.BOOST_TOP).toFixed(3)} ${ok?'OK':'FAIL'}`);
  if(!ok) qFail++;
  // the bays: 15% smaller than before (each bay's outline and the row as a whole), a 12-seat bus still inside its outline
  const b=C.drawnBay(C.YARD.BAY_X[0]), b4=C.drawnBay(C.YARD.BAY_X[4]), L12=C.busLen(12), zc=C.dispZ(C.parkZ(L12));
  const rowW=b4.x+b4.hw-(b.x-b.hw), rowH=2*b.hl, OLD_W=2*2.72+1.12, OLD_H=C.Z_BAY_BOT-C.Z_BAY_TOP;
  const fits=C.BUS_DRAW*L12/2<=b.hl-0.04 && C.BUS_DRAW*C.BUS_W/2<=b.hw-0.04 && Math.abs(zc-b.z)<1e-9;
  const smaller=rowW<=OLD_W*0.87 && rowH<=OLD_H*0.87;
  console.log(`  bay row ${rowW.toFixed(2)} x ${rowH.toFixed(2)} (was ${OLD_W.toFixed(2)} x ${OLD_H.toFixed(2)}: ${(rowW/OLD_W*100).toFixed(0)}% x ${(rowH/OLD_H*100).toFixed(0)}%), a 12-seat bus ${(C.BUS_DRAW*L12).toFixed(2)} x ${(C.BUS_DRAW*C.BUS_W).toFixed(2)} in a ${(2*b.hl).toFixed(2)} x ${(2*b.hw).toFixed(2)} bay ${fits&&smaller?'OK':'FAIL'}`);
  if(!(fits&&smaller)) qFail++; }
process.exitCode = allMin > 0 && !qFail ? 0 : 1;
