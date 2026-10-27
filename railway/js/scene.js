'use strict';
Railway.scene = (()=>{
  const canvas=document.getElementById('cab'), ctx=canvas.getContext('2d');
  let width=0,height=0,leg=0,motion=0;
  let state={zoom:1,velocity:0,finished:false,active:false};
  let fraction=0;
  const stationNames=Railway.config.stations.slice(1);
  const progress=()=>fraction;
  function resize(){
    const rect=canvas.getBoundingClientRect(), ratio=Math.min(window.devicePixelRatio||1,2);
    width=rect.width;height=rect.height;
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    if(ctx)ctx.setTransform(ratio,0,0,ratio,0,0);
    draw();
  }
  function rounded(x,y,w,h,r,fill,stroke) {ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  function line(points, color, weight = 1) {ctx.beginPath();points.forEach((p,i) => i ? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]));ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.stroke();}
  function poly(points,fill,stroke,weight=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=weight;ctx.stroke();}}
  function draw() {
    if(!ctx || !width || !height) return;
    ctx.clearRect(0,0,width,height);
    const narrow=width<520;
    const horizon=height*.38, center=width*.5, deck=height-110;
    const focal=Math.min(width*.92,height*1.36)*state.zoom;
    const traveled=motion;
    const stationZ=Math.max(7,155-progress()*148);
    const project=(x,y,z)=>[center+x*focal/Math.max(2,z),horizon+(2.8-y)*focal/Math.max(2,z)];
    const worldQuad=(a,b,c,d,fill)=>poly([project(...a),project(...b),project(...c),project(...d)],fill);
    const sky=ctx.createLinearGradient(0,0,0,horizon+40);sky.addColorStop(0,'#93bdce');sky.addColorStop(.7,'#d6e2da');sky.addColorStop(1,'#edf0dd');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    const sunshine=ctx.createRadialGradient(width*.78,65,1,width*.78,65,width*.35);sunshine.addColorStop(0,'#fff3cc90');sunshine.addColorStop(1,'#fff3cc00');ctx.fillStyle=sunshine;ctx.fillRect(0,0,width,horizon+15);
    rounded(width*.13,49,width*.18,6,3,'#f2f0e280');rounded(width*.52,71,width*.24,5,3,'#f2f0e270');
    poly([[0,horizon-16],[width*.11,horizon-29],[width*.23,horizon-8],[width*.37,horizon-25],[width*.5,horizon-16],[width*.67,horizon-43],[width*.79,horizon-51],[width*.9,horizon-28],[width,horizon-37],[width,horizon+25],[0,horizon+25]],'#9fb9a9');
    poly([[0,horizon+7],[width*.19,horizon-13],[width*.33,horizon+6],[width*.47,horizon-8],[width*.63,horizon+5],[width*.82,horizon-17],[width,horizon+3],[width,height],[0,height]],'#809e89');
    const terrain=ctx.createLinearGradient(0,horizon,0,deck);terrain.addColorStop(0,'#a4b19a');terrain.addColorStop(1,'#7d8d71');ctx.fillStyle=terrain;ctx.fillRect(0,horizon+15,width,height-horizon);
    function building(x,z,w,h,d,color){
      if(z<7)return;
      worldQuad([x-w/2,0,z],[x+w/2,0,z],[x+w/2,h,z],[x-w/2,h,z],color);
      worldQuad([x+w/2,0,z],[x+w/2,0,z+d],[x+w/2,h,z+d],[x+w/2,h,z],'#8b9e93');
      worldQuad([x-w/2,h,z],[x+w/2,h,z],[x+w/2,h,z+d],[x-w/2,h,z+d],'#b9c2ae');
      for(let row=0;row<Math.min(5,Math.floor(h/2.3));row++)for(let col=0;col<3;col++){
        const xx=x-w*.35+col*w*.29, yy=1.4+row*2.2;
        worldQuad([xx,yy,z-.1],[xx+w*.15,yy,z-.1],[xx+w*.15,yy+1,z-.1],[xx,yy+1,z-.1],'#6c8b8d');
      }
    }
    for(let i=9;i>=0;i--){
      const z=20+i*17-(traveled*.4%17);
      building(-12-(i%3)*3,z,6+(i%3),(leg===2?10:4)+(i%4)*(leg===2?3:2),8,['#d4d0b6','#c1c5b3','#bdc6b9'][i%3]);
      building(15+(i%3)*4,z+7,8,(leg===0?3:leg===2?12:6)+(i%4)*(leg===0?1:3),9,['#c3c4ad','#b8c5ba','#cfcbb7'][i%3]);
    }
    for(const track of [0,3.8]){
      worldQuad([track-1.8,0,5],[track+1.8,0,5],[track+1.8,0,350],[track-1.8,0,350],'#8d8f80');
      for(let i=100;i>=0;i--){const z=5+i*2.7-(traveled%2.7);if(z<4)continue;worldQuad([track-1.25,.07,z],[track+1.25,.07,z],[track+1.25,.07,z+.3],[track-1.25,.07,z+.3],'#5d6257');}
      for(const rail of [-.54,.54]){
        worldQuad([track+rail-.065,.12,4],[track+rail+.065,.12,4],[track+rail+.065,.12,350],[track+rail-.065,.12,350],'#d4d7cc');
        line([project(track+rail-.035,.12,4),project(track+rail-.035,.12,350)],'#566c6a',1);
      }
    }
    const platformNear=Math.max(3,stationZ-77), platformFar=stationZ+16;
    worldQuad([-5.8,1,platformNear],[-1.75,1,platformNear],[-1.75,1,platformFar],[-5.8,1,platformFar],'#c4c4b0');
    worldQuad([-1.75,0,platformNear],[-1.75,1,platformNear],[-1.75,1,platformFar],[-1.75,0,platformFar],'#929f92');
    worldQuad([-2.13,1.015,platformNear],[-1.85,1.015,platformNear],[-1.85,1.015,platformFar],[-2.13,1.015,platformFar],'#e9c96d');
    if(progress()>.4){
      for(let i=4;i>=0;i--){const z=stationZ-65+i*17;if(z<4)continue;line([project(-4.8,1,z),project(-4.8,4.3,z)],'#5a736b',Math.max(1,focal/z*.09));line([project(-5.7,4.3,z),project(-1.8,4.3,z)],'#657d73',Math.max(1,focal/z*.08));}
      const nearRoof=Math.max(4,stationZ-66);
      worldQuad([-6.1,4.35,nearRoof],[-1.6,4.35,nearRoof],[-1.6,4.35,platformFar],[-6.1,4.35,platformFar],'#7d9083');
      worldQuad([-1.6,4.15,nearRoof],[-1.6,4.35,nearRoof],[-1.6,4.35,platformFar],[-1.6,4.15,platformFar],'#516c62');
      const signZ=Math.max(13,stationZ-10);
      const sign=project(-3.5,3.1,signZ), signW=Math.min(119,2.8*focal/signZ), signH=signW*.46;
      if(signW>22){
        rounded(sign[0]-signW/2,sign[1]-signH/2,signW,signH,1,'#f1efdd','#6e8b7c');
        ctx.fillStyle='#183d3d';ctx.textAlign='center';ctx.font=`500 ${Math.max(10,Math.min(18,signW*.19))}px sans-serif`;ctx.fillText(stationNames[leg],sign[0],sign[1]+2);
        ctx.fillStyle='#ac353e';ctx.fillRect(sign[0]-signW/2+2,sign[1]+signH/2-5,signW-4,3);ctx.textAlign='left';
      }
    }
    for(let i=8;i>=0;i--){
      const z=15+i*24-(traveled%24);if(z<6)continue;
      const scale=focal/z;
      for(const x of [-6.4,7])line([project(x,0,z),project(x,7.2,z)],'#5b7568',Math.max(1,scale*.085));
      line([project(-6.4,7.2,z),project(7,7.2,z)],'#637d6b',Math.max(1,scale*.08));
      line([project(-6.4,5.8,z),project(-3.8,7.2,z)],'#6a816b',Math.max(1,scale*.04));
    }
    for(const track of [0,3.8])line([project(track,5.6,8),project(track,5.6,400)],'#526e6590',1);
    const haze=ctx.createLinearGradient(0,horizon-12,0,horizon+52);haze.addColorStop(0,'#dee9da44');haze.addColorStop(1,'#dee9da00');ctx.fillStyle=haze;ctx.fillRect(0,horizon-12,width,64);
    const glass=ctx.createLinearGradient(0,20,0,deck);glass.addColorStop(0,'#9ecbc01a');glass.addColorStop(1,'#c8dfd600');ctx.fillStyle=glass;ctx.fillRect(0,0,width,deck);
    poly([[0,0],[width,0],[width-16,15],[16,15]],'#273d40');
    poly([[0,0],[17,0],[width*.05,deck],[0,deck+8]],'#2d4344');
    poly([[width-17,0],[width,0],[width,deck+8],[width*.95,deck]],'#2d4344');
    line([[18,17],[width*.05+3,deck]],'#698178',2);line([[width-18,17],[width*.95-3,deck]],'#698178',2);
    line([[width*.15,deck-3],[width*.24,deck-9],[width*.38,deck-13]],'#263d41cf',3);
    line([[width*.85,deck-3],[width*.76,deck-9],[width*.62,deck-13]],'#263d41cf',3);
    const desk=ctx.createLinearGradient(0,deck,0,height);desk.addColorStop(0,'#5f746e');desk.addColorStop(.12,'#455d58');desk.addColorStop(1,'#263e3e');
    poly([[0,deck+6],[width*.045,deck-7],[width*.95,deck-7],[width,deck+6],[width,height],[0,height]],desk);
    line([[width*.045,deck-7],[width*.95,deck-7]],'#91a196',2);line([[0,deck+10],[width,deck+10]],'#263e3d',4);
    const speedX=width*.065,speedY=deck+21,speedW=narrow?80:119;
    rounded(speedX,speedY,speedW,51,4,'#101f28','#758d83');
    ctx.fillStyle='#8aa5a6';ctx.font='10px sans-serif';ctx.fillText('速度',speedX+9,speedY+12);
    ctx.fillStyle='#b2efda';ctx.font=`500 ${narrow?23:27}px monospace`;ctx.fillText(String(state.finished?0:Math.round(state.velocity*3.6)).padStart(2,'0'),speedX+9,speedY+38);
    ctx.fillStyle='#97afb0';ctx.font='10px sans-serif';ctx.fillText('km/h',speedX+speedW-34,speedY+37);
    const screenX=narrow?width*.39:width*.4,screenW=narrow?width*.36:width*.26;
    rounded(screenX,speedY,screenW,51,3,'#12282d','#728a7d');ctx.fillStyle='#8eaca5';ctx.font='10px sans-serif';ctx.fillText(state.finished?'ただいま':'次の停車駅',screenX+9,speedY+13);
    ctx.fillStyle='#f0e7bd';ctx.font=`500 ${narrow?17:21}px sans-serif`;ctx.fillText(stationNames[leg],screenX+9,speedY+37);
    function gauge(x,y,r,label,angle){
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle='#182e31';ctx.fill();ctx.strokeStyle='#90a89b';ctx.lineWidth=1.5;ctx.stroke();
      for(let i=0;i<9;i++){const a=Math.PI*.75+i*Math.PI*1.5/8;line([[x+Math.cos(a)*(r-5),y+Math.sin(a)*(r-5)],[x+Math.cos(a)*(r-2),y+Math.sin(a)*(r-2)]],'#c4cfc1',1);}
      line([[x,y],[x+Math.cos(angle)*(r-7),y+Math.sin(angle)*(r-7)]],'#e6c886',1.5);
      ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fillStyle='#a8b5a5';ctx.fill();ctx.fillStyle='#8da69b';ctx.textAlign='center';ctx.font='9px sans-serif';ctx.fillText(label,x,y+r+13);ctx.textAlign='left';
    }
    if(!narrow){gauge(width*.265,speedY+24,23,'圧力計',-.7);gauge(width*.335,speedY+24,23,'ブレーキ圧',state.finished?-1.1:.4);}
    const handleX=narrow?width*.84:width*.82;
    rounded(handleX-13,speedY+13,30,30,4,'#203735','#6b8376');
    const angle=state.finished ? -0.65 : state.active ? 0.12 : -0.15;
    ctx.save();ctx.translate(handleX+2,speedY+30);ctx.rotate(angle);rounded(-4,-24,8,25,2,'#84988d','#a4b4a3');rounded(-12,-29,24,11,3,'#3c4c47','#a9a68c');ctx.restore();
    if(!narrow){ctx.fillStyle='#c4d1c1';ctx.font='10px sans-serif';ctx.fillText(state.finished?'自動停車':'運転台',handleX+31,speedY+34);}
    ctx.fillStyle='#a4b7a8';ctx.font='10px monospace';ctx.fillText('813 SERIES',width*.065,height-22);
    const lamps=narrow?[]:[{x:width*.7,label:'電源',on:true},{x:width*.75,label:'戸閉',on:!state.finished}];
    for(const lamp of lamps){rounded(lamp.x,speedY+8,22,12,2,lamp.on?'#9bba82':'#344e44','#6a8470');ctx.fillStyle='#aac1ad';ctx.textAlign='center';ctx.font='9px sans-serif';ctx.fillText(lamp.label,lamp.x+11,speedY+36);ctx.textAlign='left';}
    ctx.fillStyle='#263b3c';ctx.fillRect(0,height-14,width,14);
  }

  new ResizeObserver(resize).observe(canvas);
  return {render(next){leg=next.leg;fraction=next.progress;motion=next.motion;state={...state,...next};draw();}};
})();
