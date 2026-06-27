/* Typing Quest — front-end engine */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = (p, opt) => fetch('api/' + p, opt).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pad2 = n => String(n).padStart(2, '0');
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const localMonth = () => localDate().slice(0, 7);
const fmtShort = s => s < 60 ? s + 's' : Math.round(s / 60) + 'm';
const fmtDur = s => { s = Math.round(s); if (s < 60) return s + 's'; const m = Math.round(s / 60); return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; };

/* ----------------------------- Avatars (SVG) ----------------------------- */
const AVATARS = {
  goth: `<svg class="av" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#2a1033"/>
    <path d="M22 64c0-22 12-34 28-34s28 12 28 34v6H22z" fill="#1a0a22"/>
    <ellipse cx="50" cy="52" rx="18" ry="21" fill="#efe2ee"/>
    <path d="M30 40c2-12 10-18 20-18s18 6 20 18c-6-4-12-5-20-5s-14 1-20 5z" fill="#100515"/>
    <path d="M26 24l6 12 8-12 10 13 10-13 8 12 6-12 2 18H24z" fill="#7b2d8b"/>
    <circle cx="33" cy="22" r="3" fill="#ff3d9a"/><circle cx="50" cy="18" r="3.4" fill="#ffd54a"/><circle cx="67" cy="22" r="3" fill="#ff3d9a"/>
    <ellipse cx="42" cy="52" rx="3" ry="4" fill="#1a0a22"/><ellipse cx="58" cy="52" rx="3" ry="4" fill="#1a0a22"/>
    <path d="M44 64q6 5 12 0" stroke="#8b1a4d" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="36" cy="60" r="3" fill="#ff6b9d" opacity=".5"/><circle cx="64" cy="60" r="3" fill="#ff6b9d" opacity=".5"/></svg>`,
  hulk: `<svg class="av" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#0d3d1a"/>
    <path d="M14 60q6-18 18-20-10 6-8 22z" fill="#cfe8d8"/><path d="M86 60q-6-18-18-20 10 6 8 22z" fill="#cfe8d8"/>
    <path d="M18 58q4-16 12-20-6 8-4 20z" fill="#9fc7ad"/><path d="M82 58q-4-16-12-20 6 8 4 20z" fill="#9fc7ad"/>
    <path d="M26 70c0-26 10-40 24-40s24 14 24 40z" fill="#2ecc40"/>
    <rect x="30" y="40" width="40" height="26" rx="12" fill="#39d94d"/>
    <path d="M32 40l14 5M68 40l-14 5" stroke="#0b6b1c" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="41" cy="50" rx="4" ry="3" fill="#fff"/><ellipse cx="59" cy="50" rx="4" ry="3" fill="#fff"/>
    <circle cx="41" cy="50" r="1.8" fill="#0b3d12"/><circle cx="59" cy="50" r="1.8" fill="#0b3d12"/>
    <path d="M40 60q10 7 20 0" stroke="#0b6b1c" stroke-width="4" fill="none" stroke-linecap="round"/>
    <rect x="44" y="61" width="4" height="4" fill="#fff"/><rect x="50" y="61" width="4" height="4" fill="#fff"/></svg>`,
  garden: `<svg class="av" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#bfe7ff"/>
    <circle cx="74" cy="26" r="11" fill="#ffd54a"/>
    <g stroke="#ffd54a" stroke-width="2"><path d="M74 8v8M74 36v8M56 26h8M84 26h8M61 13l6 6M87 13l-6 6M61 39l6-6M87 39l-6 6"/></g>
    <path d="M0 70q25-10 50 0t50 0V100H0z" fill="#5bbf5b"/>
    <path d="M0 78q25-8 50 0t50 0V100H0z" fill="#3da13d"/>
    <g stroke="#2e7d32" stroke-width="3"><path d="M26 86V64"/><path d="M50 88V60"/><path d="M74 86V66"/></g>
    <g><circle cx="26" cy="60" r="8" fill="#ff6b9d"/><circle cx="26" cy="60" r="3" fill="#fff3"/>
      <circle cx="50" cy="56" r="9" fill="#ff5d5d"/><circle cx="50" cy="56" r="3.5" fill="#ffd54a"/>
      <circle cx="74" cy="62" r="8" fill="#a55eea"/><circle cx="74" cy="62" r="3" fill="#fff3"/></g>
    <g fill="#fff"><circle cx="22" cy="56" r="3"/><circle cx="30" cy="56" r="3"/><circle cx="26" cy="52" r="3"/><circle cx="26" cy="64" r="3"/></g>
    <circle cx="26" cy="60" r="3" fill="#ffd54a"/></svg>`,
  goat: `<svg class="av" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#5b6b7b"/>
    <path d="M30 30C16 24 12 38 16 50c4-10 10-12 18-10z" fill="#d8dde3"/>
    <path d="M70 30C84 24 88 38 84 50c-4-10-10-12-18-10z" fill="#d8dde3"/>
    <path d="M30 30C18 26 16 36 20 46" stroke="#aab3bd" stroke-width="3" fill="none"/>
    <path d="M70 30C82 26 84 36 80 46" stroke="#aab3bd" stroke-width="3" fill="none"/>
    <ellipse cx="26" cy="46" rx="9" ry="5" fill="#e9edf1"/><ellipse cx="74" cy="46" rx="9" ry="5" fill="#e9edf1"/>
    <path d="M34 40c0-8 7-13 16-13s16 5 16 13c0 10-6 22-16 30-10-8-16-20-16-30z" fill="#f1f4f7"/>
    <ellipse cx="42" cy="46" rx="3.6" ry="4.6" fill="#2b2b2b"/><ellipse cx="58" cy="46" rx="3.6" ry="4.6" fill="#2b2b2b"/>
    <rect x="41" y="45" width="2" height="3" fill="#ffd54a"/><rect x="57" y="45" width="2" height="3" fill="#ffd54a"/>
    <path d="M44 62h12l-6 8z" fill="#c9b8a8"/>
    <ellipse cx="46" cy="62" rx="1.6" ry="1" fill="#6b5b4b"/><ellipse cx="54" cy="62" rx="1.6" ry="1" fill="#6b5b4b"/>
    <path d="M48 72c0 8-2 14-4 18M52 72c0 8 2 14 4 18" stroke="#e9edf1" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,

  ballerina: `<svg class="av" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#f06292"/>
    <path d="M20 68c0-20 14-28 30-28s30 8 30 28v32H20z" fill="#e91e8c"/>
    <path d="M15 64q7-6 35-6t35 6l-1 10q-8-4-34-4t-34 4z" fill="#f8bbd0"/>
    <path d="M14 74q8-4 36-4t36 4l-1 8q-9-3-35-3t-35 3z" fill="#fce4ec" opacity=".75"/>
    <ellipse cx="50" cy="45" rx="18" ry="20" fill="#ffd3b0"/>
    <path d="M33 41c0-17 8-23 17-23s17 6 17 23c-5-4-10-5-17-5s-12 1-17 5z" fill="#a07040"/>
    <circle cx="50" cy="19" r="9" fill="#7d5030"/>
    <path d="M41 25l3-6 4 4 2-7 2 7 4-4 3 6" stroke="#ffd700" stroke-width="2.2" fill="none" stroke-linejoin="round"/>
    <ellipse cx="42" cy="45" rx="3" ry="3.5" fill="#2d1008"/><ellipse cx="58" cy="45" rx="3" ry="3.5" fill="#2d1008"/>
    <circle cx="43" cy="44" r="1" fill="#fff"/><circle cx="59" cy="44" r="1" fill="#fff"/>
    <path d="M39 42l-2-3M42 41v-3M45 42l1-3" stroke="#2d1008" stroke-width="1" stroke-linecap="round"/>
    <path d="M55 42l-1-3M58 41v-3M61 42l2-3" stroke="#2d1008" stroke-width="1" stroke-linecap="round"/>
    <ellipse cx="34" cy="51" rx="5" ry="3" fill="#f48fb1" opacity=".5"/>
    <ellipse cx="66" cy="51" rx="5" ry="3" fill="#f48fb1" opacity=".5"/>
    <path d="M44 56q6 5 12 0" stroke="#c2185b" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`,

  musician: `<svg class="av" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#1a0030"/>
    <path d="M22 68c0-20 12-28 28-28s28 8 28 28v32H22z" fill="#0d001a"/>
    <path d="M32 42c0-18 8-24 18-24s18 6 18 24c-5-4-10-5-18-5s-13 1-18 5z" fill="#7b1fa2"/>
    <path d="M32 42c-2-18-1-28 8-32 2 5 5 8 10 8s8-3 10-8c9 4 10 14 8 32z" fill="#ab47bc" opacity=".5"/>
    <ellipse cx="50" cy="46" rx="18" ry="20" fill="#ffd3b0"/>
    <path d="M30 47Q29 31 50 28Q71 31 70 47" stroke="#37474f" stroke-width="5" fill="none"/>
    <rect x="25" y="44" width="9" height="13" rx="3" fill="#1a1a1a"/>
    <rect x="26" y="45" width="7" height="11" rx="2" fill="#9c27b0"/>
    <rect x="66" y="44" width="9" height="13" rx="3" fill="#1a1a1a"/>
    <rect x="67" y="45" width="7" height="11" rx="2" fill="#9c27b0"/>
    <ellipse cx="42" cy="46" rx="3" ry="3.5" fill="#12003a"/><ellipse cx="58" cy="46" rx="3" ry="3.5" fill="#12003a"/>
    <circle cx="43" cy="45" r="1.2" fill="#fff"/><circle cx="59" cy="45" r="1.2" fill="#fff"/>
    <path d="M39 43h7M54 43h7" stroke="#9c27b0" stroke-width="1.5" opacity=".6"/>
    <path d="M44 57q6 5 12 0" stroke="#e91e63" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="44" cy="82" rx="4" ry="3" fill="#ff9f00" opacity=".8" transform="rotate(-15 44 82)"/>
    <line x1="48" y1="80" x2="48" y2="70" stroke="#ff9f00" stroke-width="2" opacity=".8"/>
    <line x1="48" y1="70" x2="55" y2="73" stroke="#ff9f00" stroke-width="2" opacity=".8"/>
    <ellipse cx="55" cy="76" rx="4" ry="3" fill="#ff9f00" opacity=".8" transform="rotate(-15 55 76)"/>
  </svg>`,

  fireman: `<svg class="av" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#1a0a00"/>
    <path d="M18 68c0-20 14-28 32-28s32 8 32 28v32H18z" fill="#bf360c"/>
    <path d="M18 78h64M18 87h64" stroke="#ffd600" stroke-width="4.5"/>
    <path d="M18 68v32h14V58Q22 62 18 68z" fill="#8d2600"/>
    <path d="M82 68v32H68V58Q78 62 82 68z" fill="#8d2600"/>
    <ellipse cx="50" cy="44" rx="17" ry="19" fill="#d4956a"/>
    <path d="M30 40Q30 18 50 18Q70 18 70 40z" fill="#c62828"/>
    <path d="M26 40Q26 36 50 36Q74 36 74 40Q74 45 50 45Q26 45 26 40z" fill="#d32f2f"/>
    <path d="M24 42Q50 38 76 42Q74 46 50 46Q26 46 24 42z" fill="#b71c1c"/>
    <path d="M40 36Q50 26 60 36Q55 29 50 27Q45 29 40 36z" fill="#ffd600"/>
    <ellipse cx="42" cy="46" rx="3.5" ry="3.5" fill="#1a0a00"/><ellipse cx="58" cy="46" rx="3.5" ry="3.5" fill="#1a0a00"/>
    <circle cx="43" cy="45" r="1.2" fill="#fff"/><circle cx="59" cy="45" r="1.2" fill="#fff"/>
    <path d="M38 41l8-2M54 39l8 2" stroke="#1a0a00" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M43 56q7 3 14 0" stroke="#8b4513" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`,

  doctor: `<svg class="av" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#b2dfdb"/>
    <path d="M20 70c0-22 12-32 30-32s30 10 30 32v30H20z" fill="#f5f5f5"/>
    <rect x="38" y="48" width="24" height="52" fill="#26c6da"/>
    <path d="M50 38L33 54v16h19V38z" fill="#fafafa"/>
    <path d="M50 38L67 54v16H49V38z" fill="#f0f0f0"/>
    <rect x="44" y="62" width="12" height="4" rx="1" fill="#f44336"/>
    <rect x="48" y="58" width="4" height="12" rx="1" fill="#f44336"/>
    <ellipse cx="50" cy="42" rx="17" ry="19" fill="#ffd3b0"/>
    <path d="M34 38c0-17 7-23 16-23s16 6 16 23c-4-4-9-5-16-5s-12 1-16 5z" fill="#3e2200"/>
    <path d="M38 56Q32 50 36 43Q40 37 46 41" stroke="#bdbdbd" stroke-width="2.5" fill="none"/>
    <path d="M62 56Q68 50 64 43Q60 37 54 41" stroke="#bdbdbd" stroke-width="2.5" fill="none"/>
    <path d="M46 58Q50 65 54 58" stroke="#bdbdbd" stroke-width="2.5" fill="none"/>
    <circle cx="50" cy="60" r="4" fill="#bdbdbd"/><circle cx="50" cy="60" r="2.5" fill="#9e9e9e"/>
    <ellipse cx="42" cy="42" rx="3" ry="3.5" fill="#2a1a00"/><ellipse cx="58" cy="42" rx="3" ry="3.5" fill="#2a1a00"/>
    <circle cx="43" cy="41" r="1" fill="#fff"/><circle cx="59" cy="41" r="1" fill="#fff"/>
    <path d="M37 39Q42 36 47 39M53 39Q58 36 63 39" stroke="#455a64" stroke-width="1.8" fill="none"/>
    <path d="M47 39h6" stroke="#455a64" stroke-width="1.8"/>
    <path d="M44 52q6 4 12 0" stroke="#a07040" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`,
};

/* ----------------------------- Keyboard ----------------------------- */
const FINGER = {'`':'f1','1':'f1','q':'f1','a':'f1','z':'f1','2':'f2','w':'f2','s':'f2','x':'f2',
  '3':'f3','e':'f3','d':'f3','c':'f3','4':'f4','5':'f4','r':'f4','t':'f4','f':'f4','g':'f4','v':'f4','b':'f4',
  '6':'f5','7':'f5','y':'f5','u':'f5','h':'f5','j':'f5','n':'f5','m':'f5','8':'f6','i':'f6','k':'f6',',':'f6',
  '9':'f7','o':'f7','l':'f7','.':'f7','0':'f8','p':'f8',';':'f8',"'":'f8','-':'f8','=':'f8','[':'f8',']':'f8','\\':'f8','/':'f8',' ':'f9'};
const KB_ROWS = [
  ['`','1','2','3','4','5','6','7','8','9','0','-','=',['⌫','Backspace','wide','f8']],
  [['tab','Tab','wide','f1'],'q','w','e','r','t','y','u','i','o','p','[',']','\\'],
  [['caps','CapsLock','wide','f1'],'a','s','d','f','g','h','j','k','l',';',"'",['enter','Enter','wide','f8']],
  [['shift','ShiftLeft','wide','f1'],'z','x','c','v','b','n','m',',','.','/',['shift','ShiftRight','wide','f8']],
  [[' ','Space','space','f9']],
];
const SHIFTMAP = {'?':'/','!':'1','"':"'",':':';','(':'9',')':'0','*':'8','&':'7','%':'5','$':'4','#':'3','@':'2'};
function physicalKey(ch){ if(/[A-Z]/.test(ch))return ch.toLowerCase(); if(SHIFTMAP[ch])return SHIFTMAP[ch]; return ch; }
function needsShift(ch){ return /[A-Z]/.test(ch) || ch in SHIFTMAP; }

function buildKeyboard(){
  const kb = $('#keyboard'); kb.innerHTML='';
  KB_ROWS.forEach(row=>{
    const r=document.createElement('div'); r.className='krow';
    row.forEach(k=>{
      const el=document.createElement('div');
      if(Array.isArray(k)){ const[label,code,cls,f]=k; el.className='key '+cls+' '+f; el.textContent=label; el.dataset.code=code; }
      else{ el.className='key '+(FINGER[k]||'f9'); el.textContent=k; el.dataset.code=k; }
      r.appendChild(el);
    });
    kb.appendChild(r);
  });
}
function keyEl(code){ return $(`#keyboard .key[data-code="${CSS.escape(code)}"]`); }
function highlightNext(ch){
  $$('#keyboard .key.next').forEach(e=>e.classList.remove('next'));
  if(ch==null) return;
  const phys = ch===' ' ? 'Space' : physicalKey(ch);
  const target = ch===' ' ? keyEl('Space') : keyEl(phys);
  if(target) target.classList.add('next');
  if(ch!==' ' && needsShift(ch)){ const sh=keyEl('ShiftLeft'),sh2=keyEl('ShiftRight'); (phys>='b'?sh:sh2)?.classList.add('next'); }
}
function flashKey(ch){ const phys = ch===' '?'Space':physicalKey(ch); const el=keyEl(phys); if(el){el.classList.add('hit'); setTimeout(()=>el.classList.remove('hit'),90);} }

/* ----------------------------- Sound ----------------------------- */
let actx=null, muted=localStorage.muted==='1';
function tone(freq,dur,type='sine',vol=.12){
  if(muted) return;
  try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)();
    const o=actx.createOscillator(),g=actx.createGain();
    o.type=type;o.frequency.value=freq;o.connect(g);g.connect(actx.destination);
    g.gain.setValueAtTime(vol,actx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+dur);
    o.start();o.stop(actx.currentTime+dur);
  }catch(e){}
}
const sfx={ tick:()=>tone(880,.05,'square',.05), err:()=>tone(150,.14,'sawtooth',.12),
  good:()=>{[523,659,784].forEach((f,i)=>setTimeout(()=>tone(f,.12,'sine'),i*70));},
  up:()=>{[523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,.18,'triangle',.14),i*90));} };
$('#mute').onclick=()=>{ muted=!muted; localStorage.muted=muted?'1':'0'; $('#mute').textContent=muted?'🔇':'🔊'; };
$('#mute').textContent=muted?'🔇':'🔊';

function confetti(){
  const fx=$('#fx'),colors=['#ff3d9a','#7c4dff','#ffd54a','#22c55e','#54a0ff','#ff9f43'];
  for(let i=0;i<90;i++){ const d=document.createElement('div'); d.className='confetti';
    d.style.left=Math.random()*100+'vw'; d.style.top='-20px';
    d.style.background=colors[i%colors.length];
    d.style.animationDuration=(1.6+Math.random()*1.6)+'s'; d.style.animationDelay=(Math.random()*.4)+'s';
    fx.appendChild(d); setTimeout(()=>d.remove(),3600); }
}

/* ----------------------------- Levels & words ----------------------------- */
const LEVELS=[
  {n:1,keys:'asdfjkl;',kind:'drill',target:8},
  {n:2,keys:'asdfghjkl;',kind:'drill',target:10},
  {n:3,keys:'qwertyuiopasdfghjkl;',kind:'words',target:12},
  {n:4,keys:'qwertyuiopasdfghjkl;zxcvbnm',kind:'words',target:15},
  {n:5,keys:'abcdefghijklmnopqrstuvwxyz',kind:'words',maxLen:5,target:18},
  {n:6,keys:'abcdefghijklmnopqrstuvwxyz',kind:'sentence',target:20},
  {n:7,keys:'numbers',kind:'numbers',target:22},
  {n:8,keys:'abcdefghijklmnopqrstuvwxyz',kind:'words',maxLen:11,target:26},
  {n:9,keys:'all',kind:'book-words',target:30},
  {n:10,keys:'all',kind:'book-sentence',target:35},
];
// Fry 1000 most common English words — standard used in reading/typing education
const COMMON="the of and a to in is you that it he was for on are as with his they I at be this have from or one had by word but not what all were we when your can said there use an each which she do how their if will up other about out many then them these so some her would make like him into time has look two more write go see number no way could people my than first water been call who oil its now find long down day did get come made may part over new sound take only little work know place years live me back give most very after things our just name good sentence man think say great where help through much before line right too means old any same tell boy following came want show also around form three small set put end does large must big even such because turned here why asked went men read need land different home us move try kind hand picture again change off play spell air away animals house point page letters mothers answer found study still learn should America world high every near add food between own below country plant last school father keep trees never start city earth eyes light thought head under story saw left few while along might close something seemed next hard open example begin life always those both paper together group often run important often until children side feet car mile night walked white sea began grew took river four carry state once book hear stop without second later miss idea enough eat face watch far Indians really almost let above girl sometimes mountain cut young talk soon list song being leave family it's body music color stand sun questions fish area mark dog horse birds problem complete room knew since ever piece told usually didn't friend easy heard order red door sure become top ship across today during short better best however low hours black products happened whole measure remember early waves reached listen wind rock space covered fast several hold himself toward five step morning passed vowel true hundred against pattern numeral table north slowly money map farm pulled draw voice seen cold cried plan notice south sing war ground fall king town I'll unit figure certain field travel wood fire upon done English road half ten fly gave box finally wait correct oh quickly person became shown minutes strong verb stars front feel fact street decided contain course surface produce building ocean class note nothing rest carefully scientists inside wheels stay green known island week less machine base ago stood plane system behind ran round girl got never us left don't few while along".split(' ');
const rand=a=>a[Math.floor(Math.random()*a.length)];
const onlyKeys=(w,set)=>[...w].every(c=>set.has(c));

function bookWords(){ const v=STATE.profile?.book_vocab; if(!v)return[]; return [...(v.words||[]),...(v.names||[])].map(s=>s.toLowerCase()); }

function genDrill(keys){
  const set=new Set(keys), wb=COMMON.filter(w=>w.length<=5&&onlyKeys(w,set));
  const out=[];
  for(let i=0;i<9;i++){
    if(wb.length&&Math.random()<.5) out.push(rand(wb));
    else{ const len=2+Math.floor(Math.random()*3); let s=''; for(let j=0;j<len;j++)s+=keys[Math.floor(Math.random()*keys.length)]; out.push(s); }
  }
  return out.join(' ');
}
function genWords(lvl,n=9){
  const set=new Set(lvl.keys), max=lvl.maxLen||99;
  let pool=COMMON.filter(w=>w.length<=max&&onlyKeys(w,set));
  const bw=bookWords().filter(w=>w.length<=max&&onlyKeys(w,set));
  const out=[];
  for(let i=0;i<n;i++){ const useBook=bw.length&&Math.random()<.45; out.push(useBook?rand(bw):(rand(pool)||rand(COMMON))); }
  return out.join(' ');
}
function genSentence(){
  const v=STATE.profile?.book_vocab, names=(v?.names||[]), words=(v?.words||[]);
  const subj=names.length?rand(names):cap(rand(COMMON));
  const verb=rand(['ran','jumped','found','saw','wanted','liked','made','took','called','tried']);
  const obj=words.length?rand(words):rand(COMMON);
  const s=`${cap(subj)} ${verb} the ${obj}.`;
  const s2=`Can you ${rand(['help','find','see','keep'])} the ${words.length?rand(words):rand(COMMON)}?`;
  return s+' '+s2;
}
function genNumbers(){
  const out=[]; for(let i=0;i<6;i++){ const len=2+Math.floor(Math.random()*3); let s=''; for(let j=0;j<len;j++)s+=Math.floor(Math.random()*10); out.push(s);} return out.join(' ');
}
function genBookWords(){ const bw=bookWords(); if(!bw.length)return genWords(LEVELS[7],9); const out=[]; for(let i=0;i<8;i++)out.push(rand(bw)); return out.join(' '); }
function genBookSentence(){ const v=STATE.profile?.book_vocab; if(v?.phrases?.length){ const p=[]; for(let i=0;i<2;i++)p.push(rand(v.phrases)); return p.map(cap).join('. ')+'.'; } return genSentence(); }
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);

function weakKeys(){
  const ks=STATE.profile?.key_stats||{}, arr=[];
  for(const k in ks){ const{ok=0,err=0}=ks[k]; if(ok+err>=5){ const r=err/(ok+err); if(r>=0.15)arr.push([k,r]); } }
  arr.sort((a,b)=>b[1]-a[1]); return arr.slice(0,3).map(x=>x[0]);
}
function genAdaptive(keys){
  const base=keys.split(''); const out=[];
  for(let i=0;i<9;i++){ const len=2+Math.floor(Math.random()*3); let s='';
    for(let j=0;j<len;j++){ s += Math.random()<.6 ? rand(keys.length?keys.split(''):base) : rand(base); } out.push(s); }
  return out.join(' ');
}
function makeText(lvl){
  switch(lvl.kind){
    case'drill':return genDrill(lvl.keys);
    case'words':return genWords(lvl);
    case'sentence':return genSentence();
    case'numbers':return genNumbers();
    case'book-words':return genBookWords();
    case'book-sentence':return genBookSentence();
  }
  return genWords(LEVELS[4]);
}

/* ----------------------------- State & nav ----------------------------- */
const STATE={ profiles:[], profile:null, game:null, practiceRound:0 };
function show(id){ $$('.screen').forEach(s=>s.classList.remove('active')); $('#screen-'+id).classList.add('active'); }
$$('[data-to]').forEach(b=>b.onclick=()=>{ if(STATE.game)endGameLoop(); const t=b.dataset.to; if(t==='profiles')loadProfiles(); if(t==='home')renderHome(); show(t); });

/* ----------------------------- Profiles & leaderboard ----------------------------- */
const MORE_HEROES = new Set(['Mia','Becca','Jason','Jess']);
function makeProfileCard(p){
  const c=document.createElement('button'); c.className='pcard';
  c.style.background=`linear-gradient(160deg,${p.color},${shade(p.color,-30)})`;
  c.innerHTML=`${AVATARS[p.avatar]||''}<div class="pname">${p.name}</div>
    <div class="page">${p.grade||( p.age?('age '+p.age):'grown-up')}</div>
    <div class="plevel">Level ${p.level}</div>`;
  c.onclick=()=>selectProfile(p.name);
  return c;
}
async function loadProfiles(){
  STATE.profiles=await api('profiles');
  const wrap=$('#profile-cards'), moreWrap=$('#more-hero-cards');
  wrap.innerHTML=''; moreWrap.innerHTML='';
  STATE.profiles.forEach(p=>{
    (MORE_HEROES.has(p.name)?moreWrap:wrap).appendChild(makeProfileCard(p));
  });
  loadLeaderboard();
  renderCalendar();
}
$('#more-heroes-btn').onclick=()=>{
  const el=$('#more-hero-cards'), shown=el.style.display!=='none';
  el.style.display=shown?'none':'grid';
  $('#more-heroes-btn').textContent=shown?'More Heroes ▼':'Hide Heroes ▲';
};
async function loadLeaderboard(){
  const lb=await api('leaderboard?month='+localMonth()); const el=$('#leaderboard'); el.innerHTML='';
  lb.forEach((r,i)=>{
    const row=document.createElement('div'); row.className='lb-row';
    row.innerHTML=`<div class="rank">${['🥇','🥈','🥉'][i]||'#'+(i+1)}</div>
      <div style="width:42px;height:42px">${AVATARS[r.avatar]}</div>
      <div class="who">${r.name}<small>Lv ${r.level} · ${r.games} games</small></div>
      <div class="big">${r.best_challenge}<small>BEST CHALLENGE</small></div>
      <div class="big">${r.best_wpm}<small>TOP WPM</small></div>
      <div class="big">${r.best_accuracy}%<small>BEST ACCURACY</small></div>
      <div class="big">${fmtDur(r.month_seconds||0)}<small>TIME THIS MONTH</small></div>`;
    el.appendChild(row);
  });
}

async function renderCalendar(){
  const now=new Date(), year=now.getFullYear(), mi=now.getMonth();
  $('#cal-title').textContent='🗓️ '+now.toLocaleString(undefined,{month:'long',year:'numeric'});
  $('#cal-legend').innerHTML=STATE.profiles.map(p=>
    `<span class="cal-leg"><span class="dot" style="background:${p.color}"></span>${p.name}</span>`).join('');
  const data=await api('calendar?month='+localMonth()).catch(()=>({}));
  const firstDow=new Date(year,mi,1).getDay(), days=new Date(year,mi+1,0).getDate();
  const today=localDate();
  const cal=$('#calendar'); cal.innerHTML='';
  for(let i=0;i<firstDow;i++){ const b=document.createElement('div'); b.className='cal-cell blank'; cal.appendChild(b); }
  for(let d=1;d<=days;d++){
    const ds=`${year}-${pad2(mi+1)}-${pad2(d)}`;
    const cell=document.createElement('div'); cell.className='cal-cell'+(ds===today?' today':'');
    const ents=(data[ds]||[]).map(e=>
      `<span class="cal-ent" title="${e.profile}: ${fmtShort(e.seconds)}">
         <span class="cal-av">${AVATARS[e.avatar]||''}</span>${fmtShort(e.seconds)}</span>`).join('');
    cell.innerHTML=`<span class="cal-d">${d}</span>${ents}`;
    cal.appendChild(cell);
  }
}
function shade(hex,p){ const n=parseInt(hex.slice(1),16); let r=(n>>16)+p,g=((n>>8)&255)+p,b=(n&255)+p;
  r=clamp(r,0,255);g=clamp(g,0,255);b=clamp(b,0,255); return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1); }

async function selectProfile(name){
  STATE.profile=await api('profile/'+name);
  STATE.practiceRound=0;
  renderHome(); show('home');
}

/* ----------------------------- Home ----------------------------- */
function renderHome(){
  const p=STATE.profile; if(!p)return show('profiles');
  $('#home-hero').innerHTML=`<div style="width:84px;height:84px">${AVATARS[p.avatar]}</div>
    <div><h2>${p.name}</h2><div class="stats">
      <div><b>Lv ${p.level}</b>level</div>
      <div><b id="hh-wpm">–</b>top wpm</div>
      <div><b id="hh-pts">–</b>best pts</div>
    </div></div>`;
  $('#home-level').textContent=p.level;
  $('#weight').value=p.weight_speed; updateWeightLabel(p.weight_speed);
  renderBookStatus();
  api('leaderboard').then(lb=>{ const me=lb.find(x=>x.name===p.name); if(me){ $('#hh-wpm').textContent=me.best_wpm; $('#hh-pts').textContent=me.best_points; }});
}
function renderBookStatus(){
  const p=STATE.profile, v=p.book_vocab;
  $('#book-status').textContent = p.book_title
    ? `📗 “${p.book_title}” — ${(v?.words?.length||0)+ (v?.names?.length||0)} themed words ready`
    : 'No book set — playing with general words.';
}
function updateWeightLabel(v){
  v=+v; let t;
  if(v<=20)t=`Focus on 🎯 Accuracy (${100-v}% acc / ${v}% speed)`;
  else if(v>=80)t=`Focus on ⚡ Speed (${v}% speed / ${100-v}% acc)`;
  else t=`Balanced — ${v}% speed / ${100-v}% accuracy`;
  $('#weight-label').textContent=t;
}
$('#weight').oninput=e=>updateWeightLabel(e.target.value);
$('#weight').onchange=async e=>{ STATE.profile.weight_speed=+e.target.value;
  await api('profile/'+STATE.profile.name+'/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({weight_speed:+e.target.value})}); };

$('#book-set').onclick=async()=>{
  const title=$('#book-title').value.trim(), text=$('#book-text').value.trim();
  if(!title&&!text){ bookMsg('Type a title or paste some text first.','err'); return; }
  bookMsg('Looking up the book…','');
  try{ const r=await api('profile/'+STATE.profile.name+'/book',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,text})});
    STATE.profile=await api('profile/'+STATE.profile.name);
    renderBookStatus(); bookMsg(`✓ Loaded from ${r.source}: ${(r.vocab.words?.length||0)} words, ${(r.vocab.names?.length||0)} names, ${(r.vocab.phrases?.length||0)} phrases.`,'ok');
  }catch(e){ bookMsg('✗ '+(e.detail||'Could not load that book.'),'err'); }
};
$('#book-clear').onclick=async()=>{ await api('profile/'+STATE.profile.name+'/book',{method:'DELETE'}); STATE.profile.book_title=null;STATE.profile.book_vocab=null; renderBookStatus(); bookMsg('Book cleared.','ok'); };
function bookMsg(t,c){ const e=$('#book-msg'); e.textContent=t; e.className='book-msg '+(c||''); }

$('#play-practice').onclick=()=>startPractice();
$('#play-challenge').onclick=()=>startChallenge();
$('#play-city-easy').onclick=()=>startCity('easy');
$('#play-city-hard').onclick=()=>startCity('hard');
$('#again').onclick=()=>{ if(STATE.lastMode==='city')startCity(STATE.lastDiff||'easy'); else STATE.lastMode==='challenge'?startChallenge():startPractice(); };
$('#city-quit').onclick=()=>{ CityDefense.stop(); show('home'); };

/* ----------------------------- Game engine ----------------------------- */
function renderText(text,pos){
  const ta=$('#type-area'); ta.innerHTML='';
  [...text].forEach((ch,i)=>{
    const s=document.createElement('span');
    s.className='ch '+(ch===' '?'space ':'')+(i<pos?'done':i===pos?'cur':'pending');
    s.textContent=ch; s.dataset.i=i; ta.appendChild(s);
  });
}
function setBanner(t){ $('#banner').textContent=t||''; }

function startPractice(){
  const p=STATE.profile; const lvl=LEVELS[p.level-1];
  STATE.practiceRound++;
  let text, drill=false;
  const wk=weakKeys();
  if(STATE.practiceRound%3===0 && wk.length){ text=genAdaptive(wk.join('')+lvl.keys.slice(0,4)); drill=true; setBanner('🎯 Drill: focus on  '+wk.join(' ').toUpperCase()); }
  else { text=makeText(lvl); setBanner(`Level ${lvl.n} · ${lvl.kind.replace('-',' ')} · goal ${Math.round(lvl.target*p.target_scale)} WPM`); }
  beginRound(text,'practice',lvl,{drill});
}
function startChallenge(){
  const p=STATE.profile;
  setBanner('🔥 60-second sprint — type as much as you can!');
  beginRound(makeChallengeStream(),'challenge',LEVELS[Math.max(p.level,5)-1]||LEVELS[4],{challenge:true});
}
function makeChallengeStream(){
  const bw=bookWords(); const out=[];
  for(let i=0;i<140;i++){ out.push(bw.length&&Math.random()<.6?rand(bw):rand(COMMON)); }
  return out.join(' ');
}

function beginRound(text,mode,lvl,opt={}){
  STATE.lastMode=mode;
  show('game');
  $('#timer-stat').hidden = mode!=='challenge';
  buildKeyboard(); renderText(text,0); highlightNext(text[0]);
  const g={ text,pos:0,correct:0,errors:0,start:0,deadline:0,streak:0,maxStreak:0,clean:true,perKey:{},
            mode,lvl,opt,finished:false,timer:null };
  STATE.game=g;
  $('#g-wpm').textContent='0';$('#g-acc').textContent='100';$('#g-pts').textContent='0';$('#g-combo').textContent='1.0×';
  if(mode==='challenge')$('#g-time').textContent='60';
  document.addEventListener('keydown',onKey,true);
}
function endGameLoop(){ const g=STATE.game; if(g){ if(g.timer)clearInterval(g.timer); } document.removeEventListener('keydown',onKey,true); STATE.game=null; }

function onKey(e){
  const g=STATE.game; if(!g||g.finished)return;
  if(e.key==='Tab'){e.preventDefault();return;}
  if(e.key===' '||e.key==='Backspace')e.preventDefault();
  if(e.key==='Backspace')return;
  if(e.key.length!==1)return;            // ignore Shift/Arrow/etc
  const expected=g.text[g.pos]; if(expected==null)return;

  if(!g.start){ g.start=performance.now(); if(g.mode==='challenge'){ g.deadline=g.start+60000; g.timer=setInterval(tickTimer,100);} }
  flashKey(expected);
  const slot=g.perKey[expected]||(g.perKey[expected]={ok:0,err:0});

  if(e.key===expected){
    slot.ok++; g.correct++;
    const span=$(`#type-area .ch[data-i="${g.pos}"]`); if(span){span.classList.remove('cur','pending');span.classList.add('done');}
    g.pos++;
    if(expected===' '){ if(g.clean){g.streak++; g.maxStreak=Math.max(g.maxStreak,g.streak);} g.clean=true; }
    sfx.tick();
    const nx=$(`#type-area .ch[data-i="${g.pos}"]`); if(nx)nx.classList.add('cur');
    highlightNext(g.text[g.pos]);
    if(g.mode==='challenge' && g.pos>g.text.length-25){ g.text+=' '+makeChallengeStream(); renderText(g.text,g.pos); }
    if(g.mode!=='challenge' && g.pos>=g.text.length){ finishRound(); return; }
  } else {
    slot.err++; g.errors++; g.clean=false; g.streak=0;
    const span=$(`#type-area .ch[data-i="${g.pos}"]`); if(span){span.classList.add('wrong'); setTimeout(()=>span.classList.remove('wrong'),180);}
    sfx.err();
  }
  liveStats();
}
function combo(g){ return 1+Math.min(g.maxStreak*0.1,1.0); }
function liveStats(){
  const g=STATE.game; const mins=(performance.now()-g.start)/60000;
  const wpm=mins>0?(g.correct/5)/mins:0;
  const acc=g.correct+g.errors?g.correct/(g.correct+g.errors)*100:100;
  $('#g-wpm').textContent=Math.round(wpm);
  $('#g-acc').textContent=Math.round(acc);
  $('#g-combo').textContent=(1+Math.min(g.streak*0.1,1.0)).toFixed(1)+'×';
  $('#g-pts').textContent=Math.max(0,computePoints(g,wpm,acc).points);
}
function tickTimer(){
  const g=STATE.game; if(!g)return;
  const left=Math.max(0,(g.deadline-performance.now())/1000);
  $('#g-time').textContent=Math.ceil(left);
  if(left<=0){ finishRound(); }
}
function computePoints(g,wpm,acc){
  const p=STATE.profile;
  const target=g.lvl.target*(g.mode==='challenge'?1:p.target_scale);
  const Ws=p.weight_speed/100, Wa=1-Ws;
  const speedF=clamp(wpm/target,0,2);
  const accF=Math.pow(acc/100,2);
  const lvlMult=g.lvl.n;
  const comboM=combo(g);
  const base=g.correct*lvlMult;
  const points=Math.max(0,Math.round(base*(Ws*speedF+Wa*accF)*comboM - g.errors*2));
  return {points,target,wpm,acc,speedF,accF,comboM};
}

async function finishRound(){
  const g=STATE.game; if(g.finished)return; g.finished=true;
  if(g.timer)clearInterval(g.timer);
  document.removeEventListener('keydown',onKey,true);
  const elapsedSec=Math.max(0,Math.round((performance.now()-g.start)/1000));
  const mins=(performance.now()-g.start)/60000||1/60000;
  const wpm=(g.correct/5)/mins, acc=g.correct+g.errors?g.correct/(g.correct+g.errors)*100:100;
  const r=computePoints(g,wpm,acc);
  // stars
  let stars=1; const met=wpm>=r.target;
  if(acc>=97&&met)stars=3; else if(acc>=90&&wpm>=r.target*0.7)stars=2;
  // level up (practice only)
  let leveledUp=false;
  if(g.mode==='practice'&&!g.opt.drill&&STATE.profile.level<10&&wpm>=r.target&&acc>=90){
    STATE.profile.level++; leveledUp=true;
    await api('profile/'+STATE.profile.name+'/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({level:STATE.profile.level})});
  }
  // submit
  await api('score',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({profile:STATE.profile.name,mode:g.mode,points:r.points,wpm:Math.round(wpm*10)/10,accuracy:Math.round(acc*10)/10,level:g.lvl.n,seconds:elapsedSec,local_date:localDate(),key_stats:g.perKey,book_title:STATE.profile.book_title||null})});
  // PB?
  const lb=await api('leaderboard'); const me=lb.find(x=>x.name===STATE.profile.name);
  STATE.game=null;
  showResults({stars,wpm,acc,r,leveledUp,mode:g.mode,me});
  if(stars===3||leveledUp){ sfx.up(); confetti(); } else sfx.good();
}

function showResults({stars,wpm,acc,r,leveledUp,mode,me}){
  const starStr='★★★'.slice(0,stars).padEnd(3,'☆');
  $('#result-card').innerHTML=`
    <div class="stars">${starStr}</div>
    <h2>${leveledUp?'Level Up!':(mode==='challenge'?'Sprint complete!':'Nice typing!')}</h2>
    <div class="big-pts">+${r.points}</div>
    <div class="rs">
      <div>WPM<b>${Math.round(wpm)}</b></div>
      <div>Accuracy<b>${Math.round(acc)}%</b></div>
      <div>Combo<b>${r.comboM.toFixed(1)}×</b></div>
    </div>
    ${leveledUp?`<div class="levelup">🎉 Promoted to Level ${STATE.profile.level}!</div>`:''}
    ${mode==='challenge'&&me&&r.points>=me.best_challenge?`<div class="pb">🏆 New challenge best!</div>`:''}`;
  show('results');
  $('#home-level') && ($('#home-level').textContent=STATE.profile.level);
}

/* ----------------------------- City Defense ----------------------------- */
function startCity(diff='easy'){
  STATE.lastMode='city';
  STATE.lastDiff=diff;
  show('city');
  CityDefense.start(STATE.profile, diff, async result => {
    // merge key stats
    await api('score',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({
        profile:STATE.profile.name, mode:'challenge',
        points:result.score, wpm:0, accuracy:result.accuracy,
        level:result.level, seconds:Math.round(result.seconds),
        local_date:localDate(), key_stats:result.keyStats, book_title:STATE.profile.book_title||null,
      })
    }).catch(()=>{});
    show('results');
    const starStr = result.accuracy>=95?'★★★': result.accuracy>=80?'★★☆':'★☆☆';
    $('#result-card').innerHTML=`
      <div class="stars">${starStr}</div>
      <h2>City Defense Complete</h2>
      <div class="big-pts">+${result.score}</div>
      <div class="rs">
        <div>Letters Saved<b>${result.caught}</b></div>
        <div>Accuracy<b>${result.accuracy}%</b></div>
        <div>Level Reached<b>${result.level}</b></div>
      </div>`;
    sfx.good();
  });
}

/* ----------------------------- boot ----------------------------- */
loadProfiles();
