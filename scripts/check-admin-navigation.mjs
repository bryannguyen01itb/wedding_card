import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../admin/admin.js',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('function setAdminEditorActiveTab('),source.indexOf('function scrollAdminTargetIntoView('));
function setup(mobile) {
    const top={general:0,theme:180,media:400};
    const links=Object.keys(top).map((id,i)=>{
        const classes=new Set(),attributes=new Map([['href',`#${id}`]]);
        return {offsetLeft:i*100,offsetWidth:90,classList:{contains:c=>classes.has(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)},getAttribute:k=>attributes.get(k),setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k)};
    });
    const nav={scrollLeft:0,clientWidth:150,querySelectorAll:()=>links,getBoundingClientRect:()=>({height:48,bottom:100}),scrollTo:({left})=>{nav.scrollLeft=left}};
    const properties=new Map(),panel={hidden:false,style:{setProperty:(k,v)=>properties.set(k,v)}};
    const scroller={scrollTop:100,clientHeight:500,scrollHeight:1500};
    const form={...scroller,getBoundingClientRect:()=>({top:200})};
    const elements={weddingEditPanel:panel,weddingsView:{classList:{contains:()=>true}},adminFormNav:nav,adminMobileChrome:{getBoundingClientRect:()=>({height:52})}};
    for(const id of Object.keys(top)) elements[id]={id,getClientRects:()=>[{}],getBoundingClientRect:()=>({top:top[id]})};
    const ctx={form,window:{matchMedia:()=>({matches:mobile})},document:{getElementById:id=>elements[id],querySelector:()=>scroller}};
    vm.createContext(ctx);vm.runInContext(functions,ctx);
    return {ctx,links,top,nav,panel,properties,scroller,form};
}
for(const mobile of [false,true]) {
    const t=setup(mobile);t.ctx.updateAdminEditorNavigation();
    const expected=mobile?0:1;
    assert.equal(t.links[expected].getAttribute('aria-current'),'location');
    t.top.media=mobile?108:208;t.ctx.updateAdminEditorNavigation();
    assert.equal(t.links[2].getAttribute('aria-current'),'location');
    assert.equal(t.links[expected].getAttribute('aria-current'),undefined);
    if(mobile) {assert.equal(t.properties.get('--admin-mobile-header-height'),'52px');assert.equal(t.properties.get('--admin-editor-tabs-height'),'48px');assert(t.nav.scrollLeft>0)}
    t.top.media=900;(mobile?t.scroller:t.form).scrollTop=1000;t.ctx.updateAdminEditorNavigation();
    assert.equal(t.links[2].getAttribute('aria-current'),'location');
    t.panel.hidden=true;t.ctx.updateAdminEditorNavigation();
}
console.log('PASS: desktop/mobile active sections, tab changes, mobile tab visibility, measured header height and final section.');
