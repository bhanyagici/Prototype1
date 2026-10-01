// static layout check: every yard route at max bus length vs every parked / queued bus
const C=require('./core.js')();
const W=C.BUS_W;
const rect=(x,z,dx,dz,len)=>({x,z,dx,dz,len});
const sep=(a,b)=>{const ax=[[a.dx,a.dz],[-a.dz,a.dx]],bx=[[b.dx,b.dz],[-b.dz,b.dx]],ha=[a.len/2,W/2],hb=[b.len/2,W/2],d=[b.x-a.x,b.z-a.z];let m=-9;
 for(const v of [...ax,...bx]){const p=Math.abs(d[0]*v[0]+d[1]*v[1]);const ra=ha[0]*Math.abs(ax[0][0]*v[0]+ax[0][1]*v[1])+ha[1]*Math.abs(ax[1][0]*v[0]+ax[1][1]*v[1]);const rb=hb[0]*Math.abs(bx[0][0]*v[0]+bx[0][1]*v[1])+hb[1]*Math.abs(bx[1][0]*v[0]+bx[1][1]*v[1]);m=Math.max(m,p-ra-rb);}return m;};
const LENS=[4,6,8,12].map(C.busLen), LMAX=C.busLen(12);
const parked=(k,len)=>rect(C.BAY_X[k],C.parkZ(len),0,-1,len);
const laneFront=(l,len)=>rect(C.LANE_X[l],C.laneSlotZ(len),0,-1,len);
let worst=[];
function sweep(name,path,len,statics){
  const o={}; let seg=0, m=9, at='';
  for(let s=0;s<=path.len;s+=0.05){ seg=C.pathAt(path,s,o,seg); const r=rect(o.x,o.z,o.dx,o.dz,len);
    for(const [sn,st] of statics){ const d=sep(r,st); if(d<m){ m=d; at=sn+' @s='+s.toFixed(2); } } }
  worst.push([m,name+' len'+len.toFixed(2)+' vs '+at]);
}
for(const len of LENS){
  // lane -> road, both sides; statics: other lanes' fronts (max len), all parked (max len)
  for(let l=0;l<3;l++) for(const side of (l===1?[-1,1]:[l===0?-1:1])){
    const st=[]; for(let m=0;m<3;m++) if(m!==l) st.push(['lane'+m,laneFront(m,LMAX)]); for(let k=0;k<5;k++) st.push(['bay'+k,parked(k,LMAX)]);
    sweep(`lane${l}->road(${side})`,C.routeToRoad(C.LANE_X[l],C.laneSlotZ(len),side),len,st);
  }
  for(let l=0;l<3;l++) for(let k=0;k<5;k++){
    const st=[]; for(let m=0;m<3;m++) if(m!==l) st.push(['lane'+m,laneFront(m,LMAX)]); for(let j=0;j<5;j++) if(j!==k) st.push(['bay'+j,parked(j,LMAX)]);
    sweep(`lane${l}->bay${k}`,C.routeLaneToBay(C.LANE_X[l],C.laneSlotZ(len),k,len),len,st);
  }
  for(let k=0;k<5;k++){
    const st=[]; for(let j=0;j<5;j++) if(j!==k) st.push(['bay'+j,parked(j,LMAX)]);
    sweep(`bay${k}->road`,C.routeBayToRoad(C.BAY_X[k],C.parkZ(len)),len,st);
    const st2=[]; for(let m=0;m<3;m++) st2.push(['lane'+m,laneFront(m,LMAX)]); for(let j=0;j<5;j++) if(j!==k) st2.push(['bay'+j,parked(j,LMAX)]);
    const rp=C.routeReturn(k,len); sweep(`return->bay${k}`,rp,len,st2);
  }
}
worst.sort((a,b)=>a[0]-b[0]);
worst.slice(0,10).forEach(w=>console.log(w[0].toFixed(3),w[1]));
console.log('min separation',worst[0][0].toFixed(3));
process.exitCode = worst[0][0] > 0 ? 0 : 1;
