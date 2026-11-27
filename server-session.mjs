// Session management: signed short-lived credentials, no raw token persisted.
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export const NAME='__Host-niko_session';
export const LIFETIME=7*86400;
const mac=(secret,value)=>createHmac('sha256',secret).update(value).digest('base64url');
function configured(secret){return typeof secret==='string'&&secret.length>=32;}
export function sameOrigin(req){
 const {origin,host,'sec-fetch-site':site}=req.headers??{};
 if(typeof origin!=='string'||typeof host!=='string'||(site&&site!=='same-origin'))return false;
 try{const u=new URL(origin);return u.protocol==='https:'&&u.origin===origin&&u.host===host;}catch{return false;}
}
export function matches(a,b){
 if(typeof a!=='string'||!configured(b))return false;
 const x=Buffer.from(mac(b,a)),y=Buffer.from(mac(b,b));
 return timingSafeEqual(x,y);
}
export function issue(secret,now=Math.floor(Date.now()/1000)){
 if(!configured(secret))throw Error('Authentication unavailable');
 const payload=Buffer.from(JSON.stringify({v:1,exp:now+LIFETIME,nonce:randomBytes(18).toString('base64url')})).toString('base64url');
 return payload+'.'+mac(secret,'niko-session-v1:'+payload);
}
export function verified(req,secret,now=Math.floor(Date.now()/1000)){
 if(!configured(secret)||typeof req.headers?.cookie!=='string'||req.headers.cookie.length>8192)return false;
 const values=req.headers.cookie.split(';').map(x=>x.trim()).filter(x=>x.startsWith(NAME+'='));
 if(values.length!==1)return false;
 const value=values[0].slice(NAME.length+1);
 if(value.length>512||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]{43}$/.test(value))return false;
 const [payload,sig]=value.split('.');
 if(!timingSafeEqual(Buffer.from(sig),Buffer.from(mac(secret,'niko-session-v1:'+payload))))return false;
 try{const p=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));return p.v===1&&Number.isInteger(p.exp)&&p.exp>now&&p.exp<=now+LIFETIME&&/^[A-Za-z0-9_-]{24}$/.test(p.nonce);}catch{return false;}
}
export function setCookie(value,age=LIFETIME){return NAME+'='+value+'; Path=/; Max-Age='+age+'; Secure; HttpOnly; SameSite=Strict';}
