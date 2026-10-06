import test from 'node:test';
import assert from 'node:assert/strict';
import {createWishService} from '../js/wish.js';

const config = {web3formsKey:'12345678-1234-1234-1234-123456789abc',wishDelivery:{subject:'Birthday wish',fromName:'Birthday Site'}};
function memoryStorage() {
  const values = new Map();
  return {getItem:key => values.get(key) ?? null,setItem:(key,value) => values.set(key,value)};
}
const success = () => ({ok:true,json:async () => ({success:true})});

test('missing access key keeps a durable outbox without attempting a request', async () => {
  const storage = memoryStorage();
  let calls = 0;
  const service = createWishService({config:{...config,web3formsKey:'PASTE_KEY_HERE'},storage,fetcher:async () => { calls++; return success(); }});
  try {
    assert.equal(service.submit('  More adventures together 💙  ').status,'queued');
    await service.flush();
    assert.equal(calls,0);
    assert.equal(service.get().durable,true);
    assert.equal(JSON.parse(storage.getItem('pendingWish')).entries[0].text,'More adventures together 💙');
    assert.equal('text' in service.get(),false);
  } finally { service.destroy(); }
});

test('invalid input is rejected and repeated submission uses one in-flight wish', async () => {
  let resolveFetch;
  let calls = 0;
  const storage = memoryStorage();
  const service = createWishService({config,storage,fetcher:() => { calls++; return new Promise(resolve => { resolveFetch = resolve; }); }});
  try {
    assert.equal(service.submit(' \n '),null);
    assert.equal(service.submit('a'.repeat(281)),null);
    const first = service.submit('A quiet, happy year.');
    const second = service.submit('Accidental second tap.');
    assert.equal(first.id,second.id);
    assert.equal(calls,1);
    resolveFetch(success());
    await service.flush();
    assert.equal(service.get().status,'sent');
    assert.equal(JSON.parse(storage.getItem('pendingWish')).entries[0].text,'');
  } finally { service.destroy(); }
});

test('failure survives reload and only an acknowledged response clears the private text', async () => {
  const storage = memoryStorage();
  const first = createWishService({config,storage,fetcher:async () => ({ok:true,json:async () => ({success:false})})});
  first.submit('A wish to keep safe.');
  await first.flush();
  assert.equal(first.get().status,'queued');
  first.destroy();
  let body;
  const restored = createWishService({config,storage,fetcher:async (url,options) => {
    assert.equal(url,'https://api.web3forms.com/submit');
    body = JSON.parse(options.body);
    return success();
  }});
  try {
    await restored.flush();
    assert.equal(body.message,'A wish to keep safe.');
    assert.equal(body.access_key,config.web3formsKey);
    assert.equal(restored.get().status,'sent');
    assert.equal(storage.getItem('pendingWish').includes('A wish to keep safe.'),false);
    assert.equal(restored.submit('Replaying should not resend.').status,'sent');
  } finally { restored.destroy(); }
});

test('unavailable storage retains a truthful memory-only queue', async () => {
  const storage = {getItem() { throw new Error('blocked'); },setItem() { throw new Error('blocked'); }};
  const service = createWishService({config:{...config,web3formsKey:''},storage});
  try {
    assert.equal(service.submit('Still part of the celebration.').durable,false);
    assert.equal(service.get().status,'queued');
  } finally { service.destroy(); }
});

test('destroy aborts a pending request and leaves it queued for a later visit', async () => {
  const storage = memoryStorage();
  let signal;
  const service = createWishService({config,storage,fetcher:(_url,options) => {
    signal = options.signal;
    return new Promise((_resolve,reject) => signal.addEventListener('abort',() => reject(new Error('aborted')),{once:true}));
  }});
  service.submit('Until next time.');
  const pending = service.flush();
  service.destroy();
  await pending;
  assert.equal(signal.aborted,true);
  assert.equal(JSON.parse(storage.getItem('pendingWish')).entries[0].status,'queued');
});

test('birthday and secret wishes have independent receipts and do not overwrite each other', async () => {
  const storage = memoryStorage();
  const service = createWishService({config:{...config,web3formsKey:''},storage});
  try {
    const birthday = service.submit('Birthday wish.');
    const secret = service.submit('A second little wish.',{slot:'secret'});
    assert.notEqual(birthday.id,secret.id);
    assert.equal(JSON.parse(storage.getItem('pendingWish')).entries.length,2);
    assert.equal(service.submit('Unknown slot.',{slot:'third'}),null);
  } finally { service.destroy(); }
});
