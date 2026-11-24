// SPDX-License-Identifier: MIT
// Studio Niko Quantum Core — ideal statevector simulator, q0 is least-significant bit.
const single=new Set(['H','X','Y','Z','S','T','RX','RY','RZ']);
const pair=new Set(['CX','CZ','SWAP']);
export function simulateCircuit(circuit){
 if(!circuit||typeof circuit!=='object'||!Number.isInteger(circuit.qubits)||circuit.qubits<1||circuit.qubits>12||!Array.isArray(circuit.gates)||circuit.gates.length>128)throw Error('Circuit : 1–12 qubits, 128 portes maximum');
 const n=circuit.qubits,N=2**n,re=new Float64Array(N),im=new Float64Array(N);re[0]=1;
 const wire=q=>Number.isInteger(q)&&q>=0&&q<n;
 const multiply=(i,a,b)=>{const r=re[i],v=im[i];re[i]=a*r-b*v;im[i]=a*v+b*r;};
 const swap=(i,j)=>{[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];};
 const matrix=(q,m)=>{
  const bit=2**q;
  for(let i=0;i<N;i++)if(!(i&bit)){
   const j=i|bit,a=re[i],b=im[i],c=re[j],d=im[j];
   re[i]=m[0]*a-m[1]*b+m[2]*c-m[3]*d;im[i]=m[0]*b+m[1]*a+m[2]*d+m[3]*c;
   re[j]=m[4]*a-m[5]*b+m[6]*c-m[7]*d;im[j]=m[4]*b+m[5]*a+m[6]*d+m[7]*c;
  }
 };
 for(const g of circuit.gates){
  if(!g||!wire(g.target)||!(single.has(g.gate)||pair.has(g.gate)))throw Error('Porte ou qubit invalide');
  const bit=2**g.target;
  if(pair.has(g.gate)){
   if(!wire(g.control)||g.control===g.target)throw Error('Contrôle invalide');
   const c=2**g.control;
   for(let i=0;i<N;i++)if(i&c){
    if(g.gate==='CZ'&&(i&bit))multiply(i,-1,0);
    else if(g.gate!=='CZ'&&!(i&bit))swap(i,g.gate==='CX'?i|bit:(i^c)|bit);
   }
   continue;
  }
  const h=Math.SQRT1_2;
  const matrices={H:[h,0,h,0,h,0,-h,0],X:[0,0,1,0,1,0,0,0],Y:[0,0,0,-1,0,1,0,0],Z:[1,0,0,0,0,0,-1,0],S:[1,0,0,0,0,0,0,1],T:[1,0,0,0,0,0,h,h]};
  if(g.gate.startsWith('R')){
   if(typeof g.theta!=='number'||!Number.isFinite(g.theta)||Math.abs(g.theta)>1e6)throw Error('Angle en radians invalide');
   const c=Math.cos(g.theta/2),s=Math.sin(g.theta/2);
   matrices.RX=[c,0,0,-s,0,-s,c,0];matrices.RY=[c,0,-s,0,s,0,c,0];matrices.RZ=[c,-s,0,0,0,0,c,s];
  }
  matrix(g.target,matrices[g.gate]);
 }
 let norm=0;const outcomes=[];
 for(let i=0;i<N;i++){const probability=re[i]**2+im[i]**2;norm+=probability;if(probability>1e-14)outcomes.push({state:i.toString(2).padStart(n,'0'),probability,re:re[i],im:im[i]});}
 outcomes.sort((a,b)=>b.probability-a.probability||a.state.localeCompare(b.state));
 return {engine:'Studio Niko Quantum Core',mode:'ideal_classical_statevector',qubits:n,gates:circuit.gates.length,norm,outcomes:outcomes.slice(0,32),omittedProbability:outcomes.slice(32).reduce((s,x)=>s+x.probability,0),nonzeroStates:outcomes.length,noiseModel:false};
}
export const quantumPresets={
 bell:{qubits:2,gates:[{gate:'H',target:0},{gate:'CX',control:0,target:1}]},
 ghz:{qubits:3,gates:[{gate:'H',target:0},{gate:'CX',control:0,target:1},{gate:'CX',control:1,target:2}]},
 interference:{qubits:1,gates:[{gate:'H',target:0},{gate:'H',target:0}]}
};
