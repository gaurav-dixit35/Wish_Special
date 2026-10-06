import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPhoto} from '../js/photos.js';
import {photoTransition} from '../js/lightbox.js';

function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} should equal ${expected}`); }

test('rotated photo transition preserves the original visual centre and corners', () => {
  const angle = -6;
  const radians = angle * Math.PI / 180;
  const size = {width:280,height:350};
  const bounds = {
    left:60,top:240,
    width:Math.abs(Math.cos(radians) * size.width) + Math.abs(Math.sin(radians) * size.height),
    height:Math.abs(Math.sin(radians) * size.width) + Math.abs(Math.cos(radians) * size.height),
  };
  const destination = {left:25,top:90,width:600,height:400};
  const {frame} = photoTransition(bounds,size,destination,angle);
  const project = (x,y) => ({
    x:destination.left + frame.x + Math.cos(radians) * x * frame.scaleX - Math.sin(radians) * y * frame.scaleY,
    y:destination.top + frame.y + Math.sin(radians) * x * frame.scaleX + Math.cos(radians) * y * frame.scaleY,
  });
  const corners = [[0,0],[600,0],[600,400],[0,400]].map(([x,y]) => project(x,y));
  near(Math.min(...corners.map(point => point.x)),bounds.left);
  near(Math.max(...corners.map(point => point.x)),bounds.left + bounds.width);
  near(Math.min(...corners.map(point => point.y)),bounds.top);
  near(Math.max(...corners.map(point => point.y)),bounds.top + bounds.height);
  near(project(300,200).x,bounds.left + bounds.width / 2);
  near(project(300,200).y,bounds.top + bounds.height / 2);
});

test('portrait and landscape photographs retain their aspect ratio inside the starting crop', () => {
  for (const destination of [{left:0,top:0,width:600,height:400},{left:0,top:0,width:300,height:600}]) {
    const rect = {left:10,top:20,width:280,height:350};
    const {frame,image} = photoTransition(rect,{width:280,height:350},destination);
    near(frame.scaleX * image.scaleX,frame.scaleY * image.scaleY);
    assert.ok(destination.width * frame.scaleX * image.scaleX >= 280);
    assert.ok(destination.height * frame.scaleY * image.scaleY >= 350);
  }
});

class Element {
  children = [];
  attributes = new Map();
  classes = new Set();
  classList = {add:name => this.classes.add(name)};
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name,value) { this.attributes.set(name,value); }
}

function fixture(t,{image = null,placeholder = false} = {}) {
  const previous = globalThis.document;
  globalThis.document = {createElement:() => new Element()};
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  const cleanups = [];
  const scope = {alive:true,add:fn => cleanups.push(fn)};
  t.after(() => { scope.alive = false; cleanups.forEach(fn => fn()); });
  const mount = new Element();
  const ctx = {scope,preloader:{loaded:true,getImage:() => image ? {cloneNode:() => image} : null,results:new Map([['photo.webp',{status:placeholder ? 'placeholder' : 'loaded'}]])}};
  return {ctx,mount};
}

test('a photo becomes visible only after its own clone finishes decoding', async t => {
  let finishDecode;
  const candidate = {naturalWidth:800,naturalHeight:1000,decode:() => new Promise(resolve => { finishDecode = resolve; })};
  const {ctx,mount} = fixture(t,{image:candidate});
  const photo = mountPhoto(ctx,{mount,src:'photo.webp',alt:'A real memory',label:'Photo placeholder'});
  assert.equal(photo.image,null);
  assert.equal(mount.children.length,1);
  finishDecode();
  assert.equal(await photo.ready,true);
  assert.equal(photo.image,candidate);
  assert.equal(mount.children[0].hidden,true);
  assert.equal(candidate.alt,'A real memory');
});

test('leaving during decode settles the wait and never inserts a late image', async t => {
  let finishDecode;
  const candidate = {naturalWidth:800,naturalHeight:1000,decode:() => new Promise(resolve => { finishDecode = resolve; })};
  const {ctx,mount} = fixture(t,{image:candidate});
  const photo = mountPhoto(ctx,{mount,src:'photo.webp'});
  photo.destroy();
  assert.equal(await photo.ready,false);
  finishDecode();
  await Promise.resolve();
  assert.equal(photo.image,null);
  assert.equal(mount.children.length,1);
});

test('missing or undecodable photos retain the placeholder', async t => {
  const {ctx,mount} = fixture(t,{placeholder:true});
  const missing = mountPhoto(ctx,{mount,src:'photo.webp'});
  assert.equal(await missing.ready,false);
  assert.equal(mount.children.length,1);
  t.mock.method(console,'warn',() => {});
  const corruptMount = new Element();
  ctx.preloader.getImage = () => ({cloneNode:() => ({decode:() => Promise.reject(new Error('decode failed'))})});
  ctx.preloader.results.set('photo.webp',{status:'loaded'});
  const corrupt = mountPhoto(ctx,{mount:corruptMount,src:'photo.webp'});
  assert.equal(await corrupt.ready,false);
  assert.equal(corruptMount.children.length,1);
  assert.equal(corrupt.image,null);
});
