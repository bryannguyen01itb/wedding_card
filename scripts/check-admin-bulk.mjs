import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');
const actionSource = source.slice(source.indexOf('async function runSelectedAction('), source.indexOf('function renderAdminListPage('));
function setup({ confirm = true, failures = [] } = {}) {
    const deleted = [], refreshed = [], downloads = [], outcomes = [];
    const status = { hidden: true, textContent: '' };
    const controls = [{ disabled: false }, { disabled: true }];
    const ctx = {
        bulkBusy: false, keepsakeExportBusy: false,
        auth: {currentUser: {email:'admin'}}, isAllowedAdminEmail:()=>true,
        listSelection: { weddings: {selected:new Set(['one','two','three'])}, music: {selected:new Set(['one','two','three'])} },
        document: {getElementById:()=>({querySelectorAll:()=>controls}),querySelector:()=>status},
        createBulkStatus:()=>({progress:message=>{status.hidden=false;status.textContent=message},item:(id,state,message)=>outcomes.push({id,state,message})}),
        showToast:()=>{}, showAdminConfirm:async()=>confirm,
        deleteWeddingById:async id=>{deleted.push(id);return !failures.includes(id)},
        db: {collection:()=>({doc:id=>({delete:async()=>{deleted.push(id);if(failures.includes(id))throw Error('denied')}})})},
        musicDocId:{value:'one'},resetMusicForm:()=>{},
        loadPaymentList:async()=>refreshed.push('weddings'),loadMusicLibraryAdmin:async()=>refreshed.push('music'),
        buildSavedKeepsake:async id=>({html:'<html>Thiệp</html>', downloadKeepsake:(_,id)=>downloads.push(id)}),
        renderAdminListPage:()=>{},updateSelectionTools:()=>{},console:{error:()=>{}}
    };
    vm.createContext(ctx);vm.runInContext(actionSource,ctx);
    return {ctx,deleted,refreshed,downloads,status,controls,outcomes};
}
let test=setup({confirm:false});
await vm.runInContext('runSelectedAction("weddings","delete")',test.ctx);
assert.deepEqual(test.deleted,[]);assert.equal(test.ctx.bulkBusy,false);
assert.deepEqual(test.controls.map(x=>x.disabled),[false,true]);
test=setup({failures:['two']});
await vm.runInContext('runSelectedAction("weddings","delete")',test.ctx);
assert.deepEqual(test.deleted,['one','two','three']);assert.deepEqual([...test.ctx.listSelection.weddings.selected],['two']);
assert.deepEqual(test.refreshed,['weddings']);assert.match(test.status.textContent,/2\/3/);
assert(test.outcomes.some(x=>x.id==='two' && x.state==='error' && x.message.includes('Thất bại')));
assert(test.outcomes.some(x=>x.id==='three' && x.state==='success'));
test=setup({failures:['two']});
await vm.runInContext('runSelectedAction("music","delete")',test.ctx);
assert.deepEqual([...test.ctx.listSelection.music.selected],['two']);assert.deepEqual(test.refreshed,['music']);
test=setup();test.ctx.listSelection.weddings.selected=new Set(['one']);
await vm.runInContext('runSelectedAction("weddings","export")',test.ctx);
assert.deepEqual(test.downloads,['one']);assert.deepEqual(test.deleted,[]);
test=setup();test.ctx.keepsakeExportBusy=true;
await vm.runInContext('runSelectedAction("weddings","delete")',test.ctx);
assert.deepEqual(test.deleted,[]);
const moduleSource=fs.readFileSync(new URL('../admin/keepsake-zip.js',import.meta.url),'utf8');
const {createKeepsakeZip}=await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
const zip=createKeepsakeZip();zip.add('1-ánh-hảo.html','123456789');zip.add('2-thiep.html','<html>Thiệp offline</html>');
const bytes=new Uint8Array(await zip.blob().arrayBuffer());const view=new DataView(bytes.buffer);
assert.equal(view.getUint32(0,true),0x04034b50);assert.equal(view.getUint32(14,true),0xcbf43926);
const end=bytes.length-22;assert.equal(view.getUint32(end,true),0x06054b50);assert.equal(view.getUint16(end+10,true),2);
let entry=view.getUint32(end+16,true);
for(const [name,text] of [['1-ánh-hảo.html','123456789'],['2-thiep.html','<html>Thiệp offline</html>']]) {
    assert.equal(view.getUint32(entry,true),0x02014b50);
    const nameSize=view.getUint16(entry+28,true);
    assert.equal(new TextDecoder().decode(bytes.slice(entry+46,entry+46+nameSize)),name);
    const local=view.getUint32(entry+42,true),size=view.getUint32(entry+24,true);
    assert.equal(new TextDecoder().decode(bytes.slice(local+30+nameSize,local+30+nameSize+size)),text);
    entry+=46+nameSize;
}
assert.equal(entry,end);
console.log('PASS: bulk delete confirmation, partial failures, selection retention, busy guard, single export and UTF-8 ZIP with CRC.');

// The real status renderer keeps each result, uses textContent for errors, and opens errors automatically.
function element() { return {textContent:'',className:'',children:[],append(...nodes){this.children.push(...nodes)},appendChild(node){this.children.push(node)}}; }
const progressNode=element(), detailNode=element(), resultNode=element();
const statusNode={hidden:true,querySelector:selector=>({'[data-bulk-progress]':progressNode,'[data-bulk-details]':detailNode,'[data-bulk-results]':resultNode})[selector]};
const statusContext={document:{querySelector:()=>statusNode,createElement:element},cachedWeddingList:[{id:'one',groom:{nickname:'Ánh'},bride:{nickname:'Hảo'}}],cachedMusicList:[]};
vm.createContext(statusContext);
const statusSource=source.slice(source.indexOf('function createBulkStatus('),source.indexOf('async function runSelectedAction('));
vm.runInContext(statusSource,statusContext);
const report=vm.runInContext('createBulkStatus("weddings","export",["one","two"])',statusContext);
report.item('one','success','Đã đóng gói');report.item('two','error','Không tải được: <img src=x>');report.progress('1 thành công, 1 lỗi',true);
assert.equal(statusNode.hidden,false);assert.equal(detailNode.open,true);
assert.equal(resultNode.children[0].className,'is-success');assert.equal(resultNode.children[1].className,'is-error');
assert.equal(resultNode.children[1].children[1].textContent,'Không tải được: <img src=x>');
assert.match(resultNode.children[0].children[0].textContent,/Ánh & Hảo/);
assert.equal(progressNode.className,'is-error');
console.log('PASS: per-item status retains successes/errors, displays names/IDs and automatically reveals errors.');
