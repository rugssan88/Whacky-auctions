import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const app = fs.readFileSync('public/app.js','utf8');
const api = fs.readFileSync('netlify/functions/api.mts','utf8');
const css = fs.readFileSync('public/styles.css','utf8');
const sw = fs.readFileSync('public/sw.js','utf8');

const compact = (value) => value.replace(/[\s'\",]/g, '');
const has = (src, needle, message) => assert.ok(src.includes(needle) || compact(src).includes(compact(needle)), message || `Missing: ${needle}`);

// Mobile Quick List essentials.
has(app, '>Quick List</button>', 'Admin navigation should expose Quick List.');
has(app, 'id="quickCameraInput"', 'Camera input missing.');
has(app, 'capture="environment"', 'Rear-camera capture hint missing.');
has(app, 'id="quickGalleryInput"', 'Gallery input missing.');
has(app, 'multiple hidden', 'Gallery must support multi-select.');
for (const field of ['name="title"','name="conditionChoice"','name="conditionNote"','name="description"','name="openingBid"','name="reserve"','name="endAt"']) has(app, field, `Quick List field missing: ${field}`);
has(app, '<details class="advanced-settings">', 'Advanced settings must be collapsed.');
has(app, 'id="saveDraftBtn"', 'Save Draft button missing.');
has(css, '.sticky-save', 'Sticky Save Draft styling missing.');
has(css, 'font-size:16px', 'Phone input sizing should avoid tiny controls / iOS zoom.');

// Existing defaults remain represented in Quick List advanced settings.
has(app, "state.settings.softCloseSeconds||120", 'Soft-close default must continue to use the existing setting / 120 seconds.');
has(app, "paymentDeadlineHours:Number(f.get('paymentHours')||2)", '2-hour payment default changed.');
has(app, 'Inspection by arrangement before bidding closes.', 'Inspection default changed.');
has(app, "Collection in Florida, Gauteng within 30 days: Saturdays and Sundays 07:00-17:30, or weekdays before 06:30, by prior arrangement. Courier at the buyer's cost and arrangement.", 'Collection default changed.');
has(app, 'buyerPremiumPercent", 5', '5% buyer-premium default changed.');
has(app, 'Storage charges may apply after the collection deadline where lawfully disclosed.', 'Storage-fee wording changed.');

// Create/edit/duplicate flow remains on the existing auctions API.
has(app, "api('admin/auctions',{method:'POST'", 'Quick List must create through existing auction API.');
has(app, "api('admin/auctions/'+aid,{method:'PUT'", 'Quick List must edit through existing auction API.');
has(app, '/duplicate`,{method:\'POST\'}', 'Duplicate action missing from client.');
has(api, "parts[3]==='duplicate'", 'Duplicate API route missing.');
has(api, "if(source.status!=='draft')", 'Duplicate must be limited to drafts.');
has(api, "'duplicate_auction'", 'Duplicate action must be audit logged.');

// Photo order / cover handling uses the existing auction_images table and blob store.
has(api, "parts[3]==='images'&&parts[4]==='reorder'", 'Photo reorder API missing.');
has(api, 'UPDATE auction_images SET sort_order=$1', 'Photo sort order is not persisted.');
has(api, "'reorder_images'", 'Photo reorder must be audit logged.');
has(app, 'First photo is the cover.', 'Cover-image behavior must be clear.');
has(app, 'await saveQuickPhotos(aid,title)', 'Draft save must include queued photo changes.');

// Critical auction and launch-lock logic must remain intact.
has(api, "remaining<=Number(a.soft_close_seconds)*1000", '2-minute rolling soft-close logic was changed or removed.');
has(api, "new Date(now+Number(a.soft_close_seconds)*1000).toISOString()", 'Soft-close reset must restore a full configured window.');
has(api, "if(!settings.dealer_registration_confirmed)", 'SAPS/dealer registration publication lock missing.');
has(api, "if(!settings.trading_enabled)", 'Trading launch lock missing.');
has(api, "if(!settings.payment_gateway_enabled)", 'Payment-gateway publication lock missing.');
has(api, 'bidder_verification_checkout_started', 'R10 bidder-verification checkout route missing.');
has(api, 'amountCents:1000', 'R10 verification amount changed.');
has(app, 'Activate verified bidder status — R10', 'Bidder verification call-to-action missing.');
has(sw, "whacky-v5-standard-rules-pdf", 'Service-worker cache version was not bumped for the 2026 standard rules PDF.');

// Exercise actual condition helpers from app.js.
function chunk(start, end){
  const i=app.indexOf(start), j=app.indexOf(end,i+start.length);
  assert.ok(i>=0&&j>i, `Unable to extract ${start}`);
  return app.slice(i,j);
}
const conditionContext={};
vm.createContext(conditionContext);
vm.runInContext(`const QUICK_CONDITIONS=['New','Like New','Good','Fair','Poor','Untested','For parts','Other'];\n${chunk('function quickConditionParts','function cleanupQuickObjectUrls')};this.parts=quickConditionParts;this.text=quickConditionText;`,conditionContext);
assert.equal(conditionContext.text('Good','Light scratches'),'Good — Light scratches');
assert.deepEqual({...conditionContext.parts('Good — Light scratches')},{choice:'Good',note:'Light scratches'});
assert.equal(conditionContext.text('Untested',''),'Untested');

// Exercise the actual multi-photo save/reorder helper with a mocked API.
const calls=[];
let uploadNo=0;
const photoContext={
  state:{
    quickPhotos:[
      {kind:'new',file:new File(['a'],'a.jpg',{type:'image/jpeg'}),url:'blob:a'},
      {kind:'existing',id:'keep-1',url:'/api/images/keep-1',alt:'old'},
      {kind:'new',file:new File(['b'],'b.png',{type:'image/png'}),url:'blob:b'}
    ],
    quickOriginalImageIds:['keep-1','remove-1']
  },
  FormData, URL:{revokeObjectURL:()=>{}},
  api:async(path,opt={})=>{
    calls.push({path,method:opt.method,body:opt.body});
    if(path.endsWith('/image')){uploadNo++;return {image:{id:`new-${uploadNo}`,url:`/api/images/new-${uploadNo}`}}}
    return {ok:true};
  }
};
vm.createContext(photoContext);
vm.runInContext(`${chunk('async function saveQuickPhotos','function setQuickError')};this.saveQuickPhotos=saveQuickPhotos;`,photoContext);
await photoContext.saveQuickPhotos('auction-1','Mobile draft');
assert.equal(calls.filter(c=>c.path.endsWith('/image')).length,2,'Multiple selected photos should upload in one save flow.');
assert.ok(calls.some(c=>c.path==='admin/images/remove-1'&&c.method==='DELETE'),'Removed existing photo was not deleted.');
const reorder=calls.find(c=>c.path==='admin/auctions/auction-1/images/reorder');
assert.ok(reorder,'Photo reorder request missing.');
assert.deepEqual(reorder.body.imageIds,['new-1','keep-1','new-2'],'Cover/order should match the phone thumbnail order.');

console.log('Whacky Auctions Quick List checks passed.');
