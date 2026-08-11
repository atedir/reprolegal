/* cost explorer — semicircular arc */
(function(){
  var host0=document.getElementById('chart'); if(!host0) return;
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var C=['#A9744C','#C0906B','#D3AC8C','#E4C9B0','#F0E2D3'];
  var DATA={
    fet:{range:'$48,500 – $52,000',items:[
      {l:'Surrogate compensation and care',g:'Paid to the surrogate',v:22000},
      {l:'Agency coordination',g:'Agency fee',v:12000},
      {l:'Clinic, transfer, monitoring',g:'Medical expenses',v:8500},
      {l:'Contracts, apostille, registration',g:'Legal expenses',v:4500},
      {l:'Contingency and insurance',g:'Billed only if used',v:3500}]},
    egg:{range:'$56,000 – $60,500',items:[
      {l:'Surrogate compensation and care',g:'Paid to the surrogate',v:22000},
      {l:'Donor search, screening and cycle',g:'Medical expenses',v:14000},
      {l:'Agency coordination',g:'Agency fee',v:12000},
      {l:'Clinic, transfer, monitoring',g:'Medical expenses',v:6000},
      {l:'Contracts and documents',g:'Legal expenses',v:4500}]},
    ivf:{range:'$6,700 – $7,000',items:[
      {l:'Stimulation and monitoring',g:'Medical expenses',v:2600},
      {l:'Retrieval and anaesthesia',g:'Medical expenses',v:1500},
      {l:'Laboratory, ICSI, culture',g:'Laboratory',v:1400},
      {l:'Genetic testing',g:'Optional add-on',v:1200}]},
    ivfegg:{range:'$9,500 – $10,000',items:[
      {l:'Donor search and screening',g:'Paid to the donor',v:3800},
      {l:'Stimulation and monitoring',g:'Medical expenses',v:2200},
      {l:'Laboratory, ICSI, culture',g:'Laboratory',v:1500},
      {l:'Retrieval and anaesthesia',g:'Medical expenses',v:1100},
      {l:'Coordination and legal',g:'Agency and legal',v:1100}]}
  };
  var NS='http://www.w3.org/2000/svg', CX=260, CY=272, R=196, GAP=2.6;
  var host=document.getElementById('chart'), svg=host.querySelector('svg');
  var leg=document.getElementById('legend'), totalEl=document.getElementById('total'), subEl=document.getElementById('subline');
  var money=function(n){return '$'+Math.round(n).toLocaleString('en-US')};
  function pt(a,r){var t=a*Math.PI/180;return [CX+r*Math.cos(t), CY+r*Math.sin(t)]}

  function render(key,animate){
    var d=DATA[key], total=d.items.reduce(function(a,x){return a+x.v},0);
    svg.innerHTML=''; leg.innerHTML='';
    totalEl.textContent=d.range;
    subEl.textContent=d.items.length+' line items';
    var span=180-GAP*(d.items.length-1), start=180;

    d.items.forEach(function(it,i){
      var sweep=span*(it.v/total), pc=Math.round(it.v/total*100);
      var p0=pt(start,R), p1=pt(start+sweep,R);
      var path=document.createElementNS(NS,'path');
      path.setAttribute('d','M'+p0[0].toFixed(2)+' '+p0[1].toFixed(2)+' A'+R+' '+R+' 0 0 1 '+p1[0].toFixed(2)+' '+p1[1].toFixed(2));
      path.setAttribute('fill','none');
      path.setAttribute('stroke',C[i%C.length]);
      path.setAttribute('stroke-width','13');
      path.setAttribute('stroke-linecap','round');
      path.setAttribute('tabindex','0');
      path.setAttribute('aria-label',it.l+', '+money(it.v)+', '+pc+' percent');
      svg.appendChild(path);
      start+=sweep+GAP;

      var cell=document.createElement('div');
      cell.className='acell';
      cell.innerHTML='<span class="dot" style="background:'+C[i%C.length]+'"></span>'+
        '<div class="nm">'+it.l+'</div><div class="am">'+money(it.v)+'</div>'+
        '<div class="pc">'+pc+'% · '+it.g+'</div>';
      leg.appendChild(cell);

      function on(){host.classList.add('dim');path.classList.add('on');cell.classList.add('on')}
      function off(){host.classList.remove('dim');path.classList.remove('on');cell.classList.remove('on')}
      [path,cell].forEach(function(n){
        n.addEventListener('mouseenter',on);
        n.addEventListener('mouseleave',off);
        n.addEventListener('focus',function(){if(n.matches(':focus-visible'))on()});
        n.addEventListener('blur',off);
      });
      path.addEventListener('click',function(e){e.preventDefault();path.blur()});

      if(animate && !reduce){
        var len=path.getTotalLength();
        path.style.strokeDasharray=len; path.style.strokeDashoffset=len;
        setTimeout(function(){
          path.style.transition='stroke-dashoffset .9s cubic-bezier(.22,.61,.36,1),opacity .28s';
          path.style.strokeDashoffset=0;
        },80*i+50);
      }
    });
  }

  var started=false;
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting&&!started){started=true;render('fet',true);io.disconnect()}})},{threshold:.25});
    io.observe(host);
  }else{render('fet',false)}
  document.querySelectorAll('.tab').forEach(function(t){
    t.addEventListener('click',function(){
      document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('on');x.setAttribute('aria-selected','false')});
      t.classList.add('on');t.setAttribute('aria-selected','true');
      started=true; render(t.getAttribute('data-key'),true);
    });
  });
})();
