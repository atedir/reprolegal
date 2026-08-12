(function(){
 if(typeof DEST==='undefined'||!document.getElementById('combo'))return;
 var I=window.MATCH_I18N||{}, t=function(s){return (s&&I[s])||s};

var WHO={married:'a married couple',unmarried:'an unmarried couple',samesex:'a same-sex couple',singlef:'a single father',singlem:'a single mother'};
var WHOSHORT={married:'Married couples',unmarried:'Unmarried couples',samesex:'Same-sex couples',singlef:'Single fathers',singlem:'Single mothers'};
var POPULAR=['Germany','United States','United Kingdom','France','Italy','Israel','Spain','China'];
var ALIAS={'United States':'usa us america','United Kingdom':'uk britain england gb','United Arab Emirates':'uae emirates dubai abu dhabi','Germany':'deutschland de','Czechia':'czech republic','South Korea':'korea','Netherlands':'holland nl','Somewhere else':'other'};
var HOME=[{n:'Germany',g:'strict'},{n:'France',g:'strict'},{n:'Italy',g:'strict'},{n:'Spain',g:'strict'},{n:'Switzerland',g:'strict'},{n:'Austria',g:'strict'},{n:'Norway',g:'strict'},
{n:'United Kingdom',g:'order'},{n:'Ireland',g:'order'},{n:'Netherlands',g:'order'},{n:'Sweden',g:'order'},{n:'Denmark',g:'order'},{n:'Australia',g:'order'},{n:'New Zealand',g:'order'},
{n:'United States',g:'smooth'},{n:'Canada',g:'smooth'},{n:'Israel',g:'smooth'},
{n:'Portugal',g:'check'},{n:'Poland',g:'check'},{n:'Czechia',g:'check'},{n:'Belgium',g:'check'},{n:'Ukraine',g:'check'},{n:'United Arab Emirates',g:'check'},{n:'China',g:'check'},{n:'Japan',g:'check'},{n:'South Korea',g:'check'},{n:'Singapore',g:'check'},{n:'Brazil',g:'check'},{n:'Mexico',g:'check'},{n:'South Africa',g:'check'},{n:'Somewhere else',g:'check'}];
var GROUPNOTE={strict:'Your country does not recognise surrogacy domestically, so expect an additional legal step at home — usually a recognition or adoption procedure. Engage counsel there before you start, not after.',
order:'Your country typically requires a court order after birth to transfer legal parenthood. The foreign birth certificate on its own is not the end of the process.',
smooth:'Recognition at home is usually the straightforward part for your nationality. The paperwork sequence still has to be exact.',
check:'Recognition rules for your country need an individual check — this is the first thing we verify on the call.'};
var GROUPSHORT={strict:'extra legal step at home',order:'court order at home',smooth:'usually straightforward',check:'needs an individual check'};
var combo=document.getElementById('combo'), inp=document.getElementById('homeInput'), list=document.getElementById('homeList');
var chosen=HOME[0], hl=-1, filtered=HOME.slice();
inp.value=t(chosen.n);
function hay(h){return (h.n+' '+(ALIAS[h.n]||'')).toLowerCase()}
function score(h,q){var t=hay(h);if(h.n.toLowerCase().indexOf(q)===0)return 0;if(t.split(/\s+/).some(function(w){return w.indexOf(q)===0}))return 1;if(t.indexOf(q)>-1)return 2;return 99}
function row(h,i){return '<li role="option" data-i="'+i+'" class="'+(i===hl?'hl':'')+'">'+t(h.n)+'<small>'+t(GROUPSHORT[h.g])+'</small></li>'}
function drawList(q){q=(q||'').trim().toLowerCase();
 if(!q){var pop=HOME.filter(function(h){return POPULAR.indexOf(h.n)>-1}),rest=HOME.filter(function(h){return POPULAR.indexOf(h.n)===-1});
  filtered=pop.concat(rest);
  list.innerHTML='<li class="grp">'+t('Most popular')+'</li>'+pop.map(function(h,i){return row(h,i)}).join('')+'<li class="grp">'+t('All countries')+'</li>'+rest.map(function(h,i){return row(h,i+pop.length)}).join('');return}
 filtered=HOME.map(function(h){return {h:h,s:score(h,q)}}).filter(function(x){return x.s<99}).sort(function(a,b){return a.s-b.s}).map(function(x){return x.h});
 list.innerHTML=filtered.length?filtered.map(row).join(''):'<li class="grp">'+t('No match — choose "Somewhere else"')+'</li>'}
function drawChips(){document.getElementById('popchips').innerHTML=POPULAR.map(function(n){return '<button type="button" data-n="'+n+'" class="'+(chosen.n===n?'on':'')+'">'+t(n)+'</button>'}).join('')}
function openL(){combo.classList.add('open');inp.setAttribute('aria-expanded','true')}
function closeL(){combo.classList.remove('open');inp.setAttribute('aria-expanded','false');hl=-1}
function pick(i){if(!filtered[i])return;chosen=filtered[i];inp.value=t(chosen.n);closeL();drawChips();render()}
inp.addEventListener('focus',function(){inp.select();drawList('');openL()});
inp.addEventListener('input',function(){hl=-1;drawList(inp.value);openL()});
inp.addEventListener('keydown',function(e){
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!combo.classList.contains('open')){drawList(inp.value);openL()}
  hl+=e.key==='ArrowDown'?1:-1;if(hl<0)hl=filtered.length-1;if(hl>=filtered.length)hl=0;drawList(inp.value);
  var el=list.querySelector('.hl');if(el)el.scrollIntoView({block:'nearest'})}
 else if(e.key==='Enter'){e.preventDefault();pick(hl>-1?hl:0)}
 else if(e.key==='Escape'){inp.value=t(chosen.n);closeL()}});
list.addEventListener('mousedown',function(e){var li=e.target.closest('li[data-i]');if(li)pick(+li.getAttribute('data-i'))});
document.addEventListener('click',function(e){if(!combo.contains(e.target)){inp.value=t(chosen.n);closeL()}});
document.getElementById('popchips').addEventListener('click',function(e){var b=e.target.closest('button[data-n]');if(!b)return;
 chosen=HOME.filter(function(h){return h.n===b.getAttribute('data-n')})[0];inp.value=t(chosen.n);drawChips();render()});
function render(){
 var who=document.querySelector('input[name=who]:checked').value;
 document.getElementById('homenote').textContent=t(GROUPNOTE[chosen.g]);
 var match=DEST.filter(function(d){return d.allows.indexOf(who)>-1}), blocked=DEST.filter(function(d){return d.allows.indexOf(who)===-1});
 document.getElementById('tally').innerHTML='<span><b>'+match.length+' '+t('of')+' '+DEST.length+'</b> '+t('destinations accept')+' '+t(WHO[who])+' '+t('resident in')+' '+t(chosen.n)+'.</span><span>'+t('Back home afterwards:')+' <b>'+t(GROUPSHORT[chosen.g])+'</b></span>';
 document.getElementById('cards').innerHTML=match.length?match.map(function(d){
  return '<div class="dcardc"><div class="top"><div><h3>'+d.n+'</h3><div class="region">'+d.r+'</div></div><span class="pill st-'+d.status+'">'+t(d.status==='ok'?'Regulated by statute':'Practised, no statute')+'</span></div>'+
  '<p class="d">'+t(d.d)+'</p><div class="who">'+Object.keys(WHO).map(function(k){var y=d.allows.indexOf(k)>-1;return '<span class="'+(y?'yes':'')+'">'+(y?'✓ ':'')+t(WHOSHORT[k])+'</span>'}).join('')+'</div>'+
  '<div class="meta"><span>'+t('Typical programme')+'<b>'+d.cost+'</b></span><span>'+t('Typical duration')+'<b>'+t(d.time)+'</b></span></div>'+
  '<div class="athome"><b>'+t('Back in')+' '+t(chosen.n)+':</b> '+t(GROUPNOTE[chosen.g])+'</div>'+
  '<div style="margin-top:20px"><a class="go" href="/countries/'+d.slug+'" style="font-family:var(--disp);font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--amber-dk)">Read about '+d.n+' →</a></div></div>'}).join('')
  :'<div class="emptystate">'+t('No destination in our list accepts')+' '+t(WHO[who])+' '+t('at the moment. That is worth a call rather than a form — the picture changes, and there may be a route we would only discuss case by case.')+'</div>';
 document.getElementById('blockedWrap').innerHTML=blocked.length?'<div class="sechead">'+t('Ruled out for your situation')+'</div><div class="cards">'+blocked.map(function(d){
  return '<div class="dcardc no"><div class="top"><div><h3>'+d.n+'</h3><div class="region">'+d.r+'</div></div><span class="pill st-mid">Restricted</span></div><p class="d">'+d.d+'</p><div class="blocked">Does not accept '+WHO[who]+'.</div></div>'}).join('')+'</div>':''}
document.getElementById('whoChips').addEventListener('change',render);
drawChips();render();

})();