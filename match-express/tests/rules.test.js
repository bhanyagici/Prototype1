// Headless rule suite for Match Express: node tests/rules.test.js
const C=require('./core.js')();
let pass=0, fail=0;
const chk=(ok,name,info='')=>{ ok?pass++:fail++; console.log((ok?'  PASS  ':'  FAIL  ')+name+(info?'  -> '+info:'')); };
const L=C.LEVEL_DATA, dt=1/60;
const run=(g,sec,fn)=>{ for(let i=0;i<Math.round(sec/dt);i++){ C.step(g,dt); if(fn) fn(g); } };
const mk=()=>C.createGame(L,{});
// a tiny custom level helper: ramps of a single pattern, lanes custom
function custom(lanes, ramps){ return {seed:0, ramps, lanes}; }

// ---------- 1. sending: a queue tap only ever goes to the main road; the road holds 5 ----------
{ const g=mk(); const r=[], cnt=[]; for(let i=0;i<5;i++){ r.push(C.tapLane(g,i%3)); cnt.push(g.counter); }
  chk(r.every(x=>x==='road') && JSON.stringify(cnt)==='[1,2,3,4,5]', 'each queue tap sends the bus to the main road; the counter goes up the moment it is sent', r.join(',')+' counter '+cnt.join(','));
  const front=g.lanes[0][0], ev0=g.events.length, t6=C.tapLane(g,0), ev=g.events.slice(ev0);
  chk(t6==='refused' && g.lanes[0][0]===front && g.counter===5 && g.result===null && ev.length===1 && ev[0].type==='refuse' && ev[0].bus===front,
      'at 5/5 a queue tap is refused: the bus shakes and nothing else happens (no fail)', t6+', events '+ev.map(e=>e.type).join(','));
  chk(g.bayRes.every(x=>x<0) && g.bays.every(x=>x<0) && !g.buses.some(b=>b.state==='toBay'), 'a queue tap never parks a bus in a static bay');
  let maxC=0, mergeOrder=[], sendOrder=g.buses.filter(b=>b.trip&&b.trip.kind==='toRoad').sort((a,b)=>a.trip.seq-b.trip.seq).map(b=>b.id), parkedFromQueue=0;
  run(g,40,g=>{ maxC=Math.max(maxC,g.counter); if(C.canRoad(g)) C.tapLane(g,(g.t*7|0)%3);
    for(const e of g.events){ if(e.type==='merge') mergeOrder.push(e.bus); if(e.type==='send' && e.dest!=='road') parkedFromQueue++; } g.events.length=0; });
  chk(JSON.stringify(mergeOrder.slice(0,5))===JSON.stringify(sendOrder), 'buses merge into the main road in the order they were sent', mergeOrder.slice(0,5).join(','));
  chk(maxC<=5 && parkedFromQueue===0, 'the counter never exceeds 5 and no send ever goes to a bay', 'max '+maxC);
}
// ---------- 2. counter math, static re-send, the fail example ----------
const noRed=(n)=>[0,1,2,3].map(c=>Array.from({length:n},(_,i)=>["orange","yellow","cyan","purple","pink","green"][(i*2+c)%6]));
const noRedRamps=[{columns:noRed(10)},{columns:noRed(9)},{columns:noRed(10)},{columns:noRed(9)},{columns:noRed(10)}];
const redLanes=()=>[0,1,2].map(()=>Array.from({length:4},()=>({color:"red",cap:4})));   // nobody boards: every bus returns
/* the example from the rule: send 5, 2 return (3/5, bays 2/5), send 2 (5/5), 3 return (bays 5/5, no fail yet),
   then a 4th returning bus fails - unless a parked bus was sent back to the road in the meantime */
function failExample(saveIt){
  const g=C.createGame({seed:0, ramps:noRedRamps, lanes:redLanes()},{}), log={};
  const nBays=()=>g.bays.filter(x=>x>=0).length;
  for(let i=0;i<5;i++) C.tapLane(g,i%3);
  let parks=0, fourth=null;
  const tick=()=>{ C.step(g,dt); for(const e of g.events){ if(e.type==='park') parks++;
      if(parks>=5 && !fourth && (e.type==='tunnelOut' || e.type==='crash')) fourth={event:e.type, bus:e.bus, bay:e.bay, result:g.result}; } g.events.length=0; };
  while(parks<2 && g.t<120) tick();
  log.after2={counter:g.counter, bays:nBays()};
  C.tapLane(g,0); C.tapLane(g,1); log.sent2={counter:g.counter, bays:nBays()};
  while(parks<5 && !g.result && g.t<240) tick();
  log.after5={counter:g.counter, bays:nBays(), result:g.result};
  if(saveIt){ const r=C.tapBay(g,0); log.resend={res:r, counter:g.counter, bays:nBays()}; }
  while(!fourth && g.t<360) tick();                 // the 4th of the returning buses comes out of the tunnel
  log.fourth=fourth;
  return log;
}
{ const A=failExample(false), B=failExample(true);
  chk(A.after2.counter===3 && A.after2.bays===2, 'send 5, two return and park: road 3/5, bays 2/5 (a returning bus counts until it has parked)', JSON.stringify(A.after2));
  chk(A.sent2.counter===5 && A.sent2.bays===2, 'send 2 more: road 5/5, bays 2/5', JSON.stringify(A.sent2));
  chk(A.after5.bays===5 && A.after5.counter===2 && A.after5.result===null, 'three of them return: bays 5/5, road 2/5, no fail', JSON.stringify(A.after5));
  chk(A.fourth && A.fourth.event==='crash' && A.fourth.result==='fail', 'a 4th returning bus with all 5 bays full = fail', JSON.stringify(A.fourth));
  chk(B.resend.res==='road' && B.resend.counter===3 && B.resend.bays===4 && B.fourth && B.fourth.event==='tunnelOut' && B.fourth.bay===0 && B.fourth.result===null,
      'the same, but a parked bus is sent back to the road first: the 4th takes the freed bay, no fail', JSON.stringify([B.resend, B.fourth]));
}
// static re-send: road or handbrake lurch, counter +1
{ const g=C.createGame({seed:0, ramps:noRedRamps, lanes:redLanes()},{});
  C.tapLane(g,0); while(g.bays.every(x=>x<0) && g.t<60){ C.step(g,dt); if(C.canRoad(g)) C.tapLane(g,(g.t*5|0)%3); }
  const k=g.bays.findIndex(x=>x>=0), id=g.bays[k];
  while(C.canRoad(g)) C.tapLane(g,(g.t*5|0)%3);
  const c0=g.counter, r1=C.tapBay(g,k);
  chk(c0===5 && r1==='lurch' && g.bays[k]===id && g.counter===5, 'a parked bus tapped at 5/5 does the handbrake lurch and stays', r1);
  let r2=null, c1=0; for(let i=0;i<60*120 && r2!=='road';i++){ C.step(g,dt); if(C.canRoad(g)){ c1=g.counter; r2=C.tapBay(g,k); } }
  chk(r2==='road' && g.bays[k]<0 && g.counter===c1+1 && g.buses[id].state==='toRoad', 'below 5/5 it goes back to the main road and counts +1 at once', c1+' -> '+g.counter);
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
// ---------- 6. cheering at send time = exactly who then boards that bus ----------
{ // ramp 1: ten reds reachable (front rows and the chains behind), one of them hidden; nothing red further on
  const r1=[["red","?red","red","blue","green","blue","green","orange","blue","green"],
            ["red","red","red","green","blue","green","orange","blue","green","orange"],
            ["red","red","blue","orange","green","blue","green","orange","blue","green"],
            ["red","red","green","blue","orange","green","blue","orange","green","blue"]];
  const lv={seed:0, ramps:[{columns:r1}].concat(noRedRamps.slice(1)), lanes:[[{color:"red",cap:8},{color:"red",cap:4}],[{color:"red",cap:4}],[{color:"orange",cap:4}]]};
  const g=C.createGame(lv,{}), b8=g.buses[g.lanes[0][0]];
  C.tapLane(g,0); const s8=g.events.find(e=>e.type==='send').cheer, hid=g.men.find(m=>m.hidden);
  chk(s8.length===8 && s8.every(id=>g.men[id].cheerBus===b8.id && g.men[id].color==='red'), 'an 8-seat bus with 10 matching stickmen reachable: exactly 8 cheer, from the moment it is sent', s8.length+' cheering');
  chk(s8.includes(hid.id) && !hid.revealed, 'a hidden stickman who will board cheers too (still hidden)', 'man '+hid.id+' revealed '+hid.revealed);
  const b4=g.buses[g.lanes[0][0]]; g.events.length=0; C.tapLane(g,0); const s4=g.events.find(e=>e.type==='send').cheer;
  chk(s4.length===2 && s4.every(id=>!s8.includes(id)) && s8.every(id=>g.men[id].cheerBus===b8.id), 'the next red bus only gets the 2 left over: a new bus never takes stickmen promised to a bus ahead', s4.length+' cheering');
  const got=new Map(); let miss=0;
  run(g,40,g=>{ for(const e of g.events){ if(e.type==='board'){ if(!got.has(e.bus)) got.set(e.bus,[]); got.get(e.bus).push(e.man); } if(e.type==='cheerMiss') miss++; } g.events.length=0; });
  const same=(a,b)=>JSON.stringify([...a].sort((x,y)=>x-y))===JSON.stringify([...(b||[])].sort((x,y)=>x-y));
  chk(same(s8,got.get(b8.id)) && same(s4,got.get(b4.id)) && miss===0, 'the cheering stickmen are exactly the ones who then board each bus', (got.get(b8.id)||[]).length+' + '+(got.get(b4.id)||[]).length+' boarded');
  const g2=C.createGame({seed:0, ramps:[{columns:r1.map(c=>c.map((x,i)=>i<1?x:'blue'))}].concat(noRedRamps.slice(1)), lanes:[[{color:"red",cap:8}],[{color:"orange",cap:4}],[{color:"blue",cap:4}]]},{});
  C.tapLane(g2,0); const s4b=g2.events.find(e=>e.type==='send').cheer;
  chk(s4b.length===4, 'an 8-seat bus with only 4 matching stickmen reachable: those 4 cheer', s4b.length+' cheering');
}
// ---------- 7. hidden buses reveal when they reach the front ----------
{ const g=mk(); const hid=g.buses.filter(b=>b.hidden); let rev=[];
  chk(hid.length===2 && hid.every(b=>!b.revealed), 'two hidden buses start unrevealed');
  const l=hid[0].lane; let n=0; while(g.lanes[l][0]!==hid[0].id && n<20){ C.tapLane(g,l); n++; run(g,0.5,g=>{ for(const e of g.events) if(e.type==='reveal') rev.push(e.bus); g.events.length=0; }); for(let i=0;i<60*30 && !C.canRoad(g);i++) C.step(g,dt); }
  chk(hid[0].revealed && rev.includes(hid[0].id), 'a hidden bus reveals its colour when it becomes the front of its lane', 'after '+n+' sends');
}
// ---------- 8. win + ramp empty + full bot sweeps ----------
{ const r=C.simulate(L,C.greedyPick,null,1/60);
  chk(r.result==='win' && r.landed===192, 'greedy bot wins the frozen level at the live 60 Hz step', r.t.toFixed(0)+'s, '+r.sends+' sends');
}
// physical spacing in the yard and deadlocks across many random games
{ let minD=9, worst='', timeouts=0, games=0, maxWait=0, badCounter=0, laps=0, lapBad=0, misses=0, overSeats=0;
  const obb=(a,b)=>{ // separating axis test for two bus rectangles (with a 2 cm tolerance)
    const ax=[[a.dx,a.dz],[-a.dz,a.dx]], bx=[[b.dx,b.dz],[-b.dz,b.dx]], ha=[a.len/2,C.BUS_W/2], hb=[b.len/2,C.BUS_W/2];
    const d=[b.x-a.x,b.z-a.z]; let sep=-9;
    for(const ax2 of [...ax,...bx]){ const p=Math.abs(d[0]*ax2[0]+d[1]*ax2[1]);
      const ra=ha[0]*Math.abs(ax[0][0]*ax2[0]+ax[0][1]*ax2[1])+ha[1]*Math.abs(ax[1][0]*ax2[0]+ax[1][1]*ax2[1]);
      const rb=hb[0]*Math.abs(bx[0][0]*ax2[0]+bx[0][1]*ax2[1])+hb[1]*Math.abs(bx[1][0]*ax2[0]+bx[1][1]*ax2[1]);
      sep=Math.max(sep,p-ra-rb); }
    return sep; };
  for(let run_=0; run_<120; run_++){
    const g=C.createGame(L,{}), rng=C.mulberry32(500+run_); let think=0; const stuck=new Map(), lap=new Map();
    while(!g.result && g.t<1500){ think-=1/30; if(think<=0){ think+=C.BOT_THINK; const a=run_%3===0?C.greedyPick(g):C.randomPick(g,rng); if(a) C.applyAction(g,a); }
      C.step(g,1/30);
      const cnt=g.buses.filter(b=>b.state==='toRoad'||b.state==='road'||b.state==='tunnel'||b.state==='return').length; if(!g.result && cnt!==g.counter) badCounter++;
      for(const e of g.events){                   // cheering set at send vs who then boards during that lap
        if(e.type==='send'){ const b=g.buses[e.bus]; if(e.cheer.length>b.cap-b.seated) overSeats++; lap.set(e.bus,{pred:e.cheer.slice().sort((x,y)=>x-y),got:[]}); }
        if(e.type==='board'){ const q=lap.get(e.bus); if(q) q.got.push(e.man); else lapBad++; }
        if(e.type==='cheerMiss') misses++;
        if(e.type==='jump'||e.type==='tunnelIn'){ const q=lap.get(e.bus); laps++; if(!q || q.pred.join()!==q.got.sort((x,y)=>x-y).join()) lapBad++; lap.delete(e.bus); } }
      g.events.length=0;
      const Y=g.buses.filter(b=>(b.state==='toRoad'||b.state==='toBay'||b.state==='return'||b.state==='lane'||b.state==='bay'||(b.state==='road'&&b.rs<3)) && !(b.state==='return'&&b.trip&&b.trip.s<1.2));
      for(let i=0;i<Y.length;i++) for(let j=i+1;j<Y.length;j++){ const s=obb(Y[i],Y[j]); if(s<minD){ minD=s; worst=`${Y[i].state}#${Y[i].id} vs ${Y[j].state}#${Y[j].id} t=${g.t.toFixed(1)}`; } }
      for(const b of g.trips){ const k=b.id; if(b.v<0.01) stuck.set(k,(stuck.get(k)||0)+1/30); else stuck.set(k,0); maxWait=Math.max(maxWait,stuck.get(k)); }
    }
    games++; if(!g.result) timeouts++;
  }
  chk(minD>-0.03, 'no two buses overlap anywhere in the yard (120 bot games, separating-axis test)', 'closest '+minD.toFixed(3)+' ('+worst+')');
  chk(badCounter===0, 'counter = buses sent to / on the main road + in the tunnel + returning, at every step of every game', badCounter+' mismatches');
  chk(laps>1000 && lapBad===0 && misses===0 && overSeats===0, 'in every lap of every game the cheering set (fixed at send) equals the stickmen who then board that bus, never more than its free seats', laps+' laps, '+lapBad+' mismatches');
  chk(timeouts===0, 'no deadlocks: every bot game ends in a win or a fail', timeouts+' timeouts');
  console.log('      longest single wait of a yard bus: '+maxWait.toFixed(1)+'s');
}
console.log(fail?`\n${fail} FAILED, ${pass} passed`:`\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0;
