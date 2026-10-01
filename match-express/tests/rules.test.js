// Headless rule suite for Match Express: node tests/rules.test.js
const C=require('./core.js')();
let pass=0, fail=0;
const chk=(ok,name,info='')=>{ ok?pass++:fail++; console.log((ok?'  PASS  ':'  FAIL  ')+name+(info?'  -> '+info:'')); };
const L=C.LEVEL_DATA, dt=1/60;
const run=(g,sec,fn)=>{ for(let i=0;i<Math.round(sec/dt);i++){ C.step(g,dt); if(fn) fn(g); } };
const mk=()=>C.createGame(L,{});
// a tiny custom level helper: ramps of a single pattern, lanes custom
function custom(lanes, ramps){ return {seed:0, ramps, lanes}; }

// ---------- 1. send destinations + counter ----------
{ const g=mk(); const r=[]; for(let i=0;i<5;i++) r.push(C.tapLane(g,i%3));
  chk(r.every(x=>x==='road') && g.toRoad===5 && g.counter===0, 'first five taps head to the main road; counter waits until they join', r.join(','));
  const t6=C.tapLane(g,0);
  chk(t6==='bay' && g.bayRes[0]>=0, 'sixth tap (road check = 5) goes to the leftmost free bay', t6);
  for(let i=0;i<4;i++) C.tapLane(g,(i+1)%3);
  const t11=C.tapLane(g,2);
  chk(t11==='refused' && g.events.some(e=>e.type==='refuse'), 'with road full and all bays taken a tap is refused (shake), not a fail', t11+' result='+g.result);
  let maxC=0, mergeOrder=[], sendOrder=g.buses.filter(b=>b.trip&&b.trip.kind==='toRoad').sort((a,b)=>a.trip.seq-b.trip.seq).map(b=>b.id);
  run(g,40,g=>{ maxC=Math.max(maxC,g.counter); for(const e of g.events) if(e.type==='merge') mergeOrder.push(e.bus); g.events.length=0; });
  chk(JSON.stringify(mergeOrder.slice(0,5))===JSON.stringify(sendOrder), 'buses merge into the main road in the order they were sent', mergeOrder.slice(0,5).join(','));
  chk(maxC<=5, 'counter never exceeds 5', 'max '+maxC);
}
// ---------- 2. bay tap: road or handbrake lurch ----------
{ const g=mk(); for(let i=0;i<5;i++) C.tapLane(g,i%3); C.tapLane(g,1);
  for(let i=0;i<60*30 && !(g.bays.some(x=>x>=0) && !C.canRoad(g));i++){ C.step(g,dt); if(C.canRoad(g)) C.tapLane(g,i%3); }
  const k=g.bays.findIndex(x=>x>=0);
  const r1=C.tapBay(g,k); chk(r1==='lurch' && g.bays[k]>=0, 'tapping a parked bus while the road check fails = handbrake lurch, it stays', r1);
  // wait until capacity frees
  let r2=null; for(let i=0;i<60*120 && r2!=='road';i++){ C.step(g,dt); if(C.canRoad(g)) r2=C.tapBay(g,k); }
  chk(r2==='road' && g.bays[k]<0, 'once the road check passes the parked bus goes to the main road', r2);
}
// ---------- 3. boarding rules on a hand-made level ----------
{ // ramp 1 front row: col0 red, col1 red, col2 blue, col3 red; behind col0 another red (chain)
  const cols=[["red","red","blue","green","red","blue","green","red","blue","green"],
              ["red","blue","green","red","blue","green","red","blue","green","red"],
              ["blue","red","green","blue","red","green","blue","red","green","blue"],
              ["red","green","blue","red","green","blue","red","green","blue","red"]];
  const filler=(n)=>[0,1,2,3].map(c=>Array.from({length:n},(_,i)=>["orange","yellow","cyan","purple","pink"][(i+c)%5]));
  const lv=custom([[{color:"red",cap:4}],[{color:"green",cap:4}],[{color:"orange",cap:4}]],
    [{columns:cols},{columns:filler(9)},{columns:filler(10)},{columns:filler(9)},{columns:filler(10)}]);
  const g=C.createGame(lv,{}); C.tapLane(g,0);
  const boards=[]; let stopT=null, fullT=null, landT=null;
  run(g,20,g=>{ for(const e of g.events){ if(e.type==='boardStart') stopT=e.t; if(e.type==='board') boards.push(e); if(e.type==='jump') fullT=e.t; if(e.type==='land') landT=e.t; } g.events.length=0; });
  const r0=C.RAMPS[0];
  chk(stopT!==null && boards.length===4 && boards.every(b=>b.ramp===0), 'red 4-seater stops at ramp 1 and boards exactly its 4 free seats', boards.map(b=>'c'+b.col).join(' '));
  const firstRound=boards.slice(0,3).map(b=>b.col);
  const order=r0.colOrder.filter(c=>["red","red","blue","red"][c]==='red');
  chk(JSON.stringify(firstRound)===JSON.stringify(order), 'the matching front-row stickmen board first, nearest to the road first', 'order '+firstRound+' expected '+order);
  chk(boards[3].col===0, 'then the new front row is checked again (chain: the red behind column 1 follows)', 'col '+boards[3].col);
  chk(fullT!==null && Math.abs(fullT-landT)<1e-6, 'the bus jumps off the moment its last seat fills', 'jump '+(fullT&&fullT.toFixed(2))+' last land '+(landT&&landT.toFixed(2)));
  chk(g.counter===0, 'a filled bus frees its road slot (counter back to 0)', ''+g.counter);
  const g2=C.createGame(lv,{}); C.tapLane(g2,1); let stopped=false, passed=null;
  run(g2,25,g=>{ for(const e of g.events){ if(e.type==='boardStart' && e.ramp===0) stopped=true; } g.events.length=0; const b=g.buses[1]; if(b.state==='road' && b.rs>r0.s+0.5 && passed===null) passed=b.v; });
  chk(!stopped && passed>2.5, 'a bus with no front-row match drives past without stopping', 'speed past ramp 1: '+(passed&&passed.toFixed(2)));
}
// ---------- 4. no overtaking + followers stop ----------
{ const g=mk(); for(let i=0;i<5;i++) C.tapLane(g,i%3); let bad=0, minGap=9;
  run(g,60,g=>{ const R=g.road; for(let i=1;i<R.length;i++){ const gap=R[i-1].rs-R[i-1].len/2-(R[i].rs+R[i].len/2); minGap=Math.min(minGap,gap); if(gap<-1e-6) bad++; } });
  chk(bad===0, 'buses never overtake or overlap on the main road', 'min bumper gap '+minGap.toFixed(3));
}
// ---------- 5. lap, tunnel, return to leftmost bay, keeps passengers ----------
const noRed=(n)=>[0,1,2,3].map(c=>Array.from({length:n},(_,i)=>["orange","yellow","cyan","purple","pink","green"][(i*2+c)%6]));
const noRedRamps=[{columns:noRed(10)},{columns:noRed(9)},{columns:noRed(10)},{columns:noRed(9)},{columns:noRed(10)}];
{ const lv={seed:0, ramps:noRedRamps, lanes:[[{color:"red",cap:8}],[{color:"orange",cap:6}],[{color:"blue",cap:4}]]};
  const g=C.createGame(lv,{}); C.tapLane(g,1); C.tapLane(g,0); const b=g.buses[0]; let tin=null,tout=null,park=null,cAt=[];
  run(g,60,g=>{ for(const e of g.events){ if(e.bus===b.id){ if(e.type==='tunnelIn'){tin=e.t; cAt.push(['in',g.counter]);} if(e.type==='tunnelOut'){tout=e.t; cAt.push(['out',g.counter]);} if(e.type==='park'){park=e; cAt.push(['park',g.counter]);} } } g.events.length=0; });
  const orange=g.buses[1];
  chk(tin!==null && tout!==null && Math.abs(tout-tin-C.RETURN_TUNNEL_TIME)<0.02, 'an unfilled bus comes out of the return tunnel RETURN_TUNNEL_TIME later', tin&&tout&&(tout-tin).toFixed(2)+'s');
  chk(park && g.bays[park.bay]===b.id && park.bay===(g.bays[0]===orange.id?1:0), 'it parks in the leftmost free bay', park&&('bay '+park.bay+', orange '+orange.state+' '+orange.seated+'/6'));
  chk(cAt.length===3 && cAt[0][1]>=1 && cAt[1][1]>=1, 'the bus still counts while in the tunnel and on its way back', JSON.stringify(cAt));
  chk(Math.abs(b.z-C.parkZ(b.len))<1e-6 && b.dz<-0.99, 'parked from below facing up, at the top end of the bay', 'z '+b.z.toFixed(2));
  const k=g.bays.indexOf(b.id), seated=orange.seated; 
  chk(orange.seated>0 && orange.state==='bay', 'a partly filled bus keeps its seated stickmen while parked', orange.seated+'/6');
  C.tapBay(g,g.bays.indexOf(orange.id)); run(g,3); chk(orange.seated===seated && orange.state!=='bay', 'it continues from that state when sent again', orange.state+' '+orange.seated+'/6');
}
// ---------- 6. fail check at the tunnel exit ----------
{ const lane=()=>Array.from({length:4},()=>({color:"red",cap:4}));
  const lv={seed:0, ramps:noRedRamps, lanes:[lane(),lane(),lane()]};
  const g=C.createGame(lv,{}); const r=[]; for(let i=0;i<10;i++) r.push(C.tapLane(g,i%3));
  let failT=null, exitT=[], crashBus=null;
  run(g,120,g=>{ for(const e of g.events){ if(e.type==='crash'){ failT=e.t; crashBus=e.bus; } if(e.type==='tunnelOut') exitT.push(e.t); } g.events.length=0; });
  chk(r.filter(x=>x==='road').length===5 && r.filter(x=>x==='bay').length===5, 'five buses to the road, five parked', r.join(','));
  chk(g.result==='fail' && failT!==null && exitT.length===0, 'the first returning bus to exit the tunnel with all 5 bays full = fail (crash)', 'result '+g.result+' at '+(failT&&failT.toFixed(1))+'s');
}
// ---------- 7. hidden buses reveal when they reach the front ----------
{ const g=mk(); const hid=g.buses.filter(b=>b.hidden); let rev=[];
  chk(hid.length===2 && hid.every(b=>!b.revealed), 'two hidden buses start unrevealed');
  const l=hid[0].lane; let n=0; while(g.lanes[l][0]!==hid[0].id && n<20){ C.tapLane(g,l); n++; run(g,0.5,g=>{ for(const e of g.events) if(e.type==='reveal') rev.push(e.bus); g.events.length=0; }); for(let i=0;i<60*30 && !C.canRoad(g) && C.freeBay(g)<0;i++) C.step(g,dt); }
  chk(hid[0].revealed && rev.includes(hid[0].id), 'a hidden bus reveals its colour when it becomes the front of its lane', 'after '+n+' sends');
}
// ---------- 8. win + ramp empty + full bot sweeps ----------
{ const r=C.simulate(L,C.greedyPick,null,1/60);
  chk(r.result==='win' && r.landed===192, 'greedy bot wins the frozen level at the live 60 Hz step', r.t.toFixed(0)+'s, '+r.sends+' sends');
}
// physical spacing in the yard and deadlocks across many random games
{ let minD=9, worst='', timeouts=0, games=0, maxWait=0, badCounter=0;
  const obb=(a,b)=>{ // separating axis test for two bus rectangles (with a 2 cm tolerance)
    const ax=[[a.dx,a.dz],[-a.dz,a.dx]], bx=[[b.dx,b.dz],[-b.dz,b.dx]], ha=[a.len/2,C.BUS_W/2], hb=[b.len/2,C.BUS_W/2];
    const d=[b.x-a.x,b.z-a.z]; let sep=-9;
    for(const ax2 of [...ax,...bx]){ const p=Math.abs(d[0]*ax2[0]+d[1]*ax2[1]);
      const ra=ha[0]*Math.abs(ax[0][0]*ax2[0]+ax[0][1]*ax2[1])+ha[1]*Math.abs(ax[1][0]*ax2[0]+ax[1][1]*ax2[1]);
      const rb=hb[0]*Math.abs(bx[0][0]*ax2[0]+bx[0][1]*ax2[1])+hb[1]*Math.abs(bx[1][0]*ax2[0]+bx[1][1]*ax2[1]);
      sep=Math.max(sep,p-ra-rb); }
    return sep; };
  for(let run_=0; run_<120; run_++){
    const g=C.createGame(L,{headless:true}), rng=C.mulberry32(500+run_); let think=0; const stuck=new Map();
    while(!g.result && g.t<1500){ think-=1/30; if(think<=0){ think+=C.BOT_THINK; const a=run_%3===0?C.greedyPick(g):C.randomPick(g,rng); if(a) C.applyAction(g,a); }
      C.step(g,1/30);
      const cnt=g.buses.filter(b=>b.state==='road'||b.state==='tunnel'||b.state==='return').length; if(!g.result && cnt!==g.counter) badCounter++;
      const Y=g.buses.filter(b=>(b.state==='toRoad'||b.state==='toBay'||b.state==='return'||b.state==='lane'||b.state==='bay'||(b.state==='road'&&b.rs<3)) && !(b.state==='return'&&b.trip&&b.trip.s<1.2));
      for(let i=0;i<Y.length;i++) for(let j=i+1;j<Y.length;j++){ const s=obb(Y[i],Y[j]); if(s<minD){ minD=s; worst=`${Y[i].state}#${Y[i].id} vs ${Y[j].state}#${Y[j].id} t=${g.t.toFixed(1)}`; } }
      for(const b of g.trips){ const k=b.id; if(b.v<0.01) stuck.set(k,(stuck.get(k)||0)+1/30); else stuck.set(k,0); maxWait=Math.max(maxWait,stuck.get(k)); }
    }
    games++; if(!g.result) timeouts++;
  }
  chk(minD>-0.03, 'no two buses overlap anywhere in the yard (120 bot games, separating-axis test)', 'closest '+minD.toFixed(3)+' ('+worst+')');
  chk(badCounter===0, 'counter = buses on the main road + in the tunnel + returning, at every step of every game', badCounter+' mismatches');
  chk(timeouts===0, 'no deadlocks: every bot game ends in a win or a fail', timeouts+' timeouts');
  console.log('      longest single wait of a yard bus: '+maxWait.toFixed(1)+'s');
}
console.log(fail?`\n${fail} FAILED, ${pass} passed`:`\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0;
