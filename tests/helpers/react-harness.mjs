import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

export async function mountHook(t, useHook, setup = () => {}) {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", {url:"http://localhost"});
  const originals = new Map();
  let now = 1000, timerId = 0, current;
  const timers = new Map();
  const clock = new Proxy(globalThis.performance, {get(target,key) {
    if(key === "now") return () => now;
    const value=Reflect.get(target,key,target);
    return typeof value === "function" ? value.bind(target) : value;
  }});
  for (const [key,value] of Object.entries({window:dom.window,document:dom.window.document,Element:dom.window.Element,Node:dom.window.Node,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,performance:clock})) {
    originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  }
  dom.window.setTimeout = (callback,delay=0) => {const id=++timerId; timers.set(id,{callback,due:now+delay}); return id;};
  dom.window.clearTimeout = id => timers.delete(id);
  dom.window.requestAnimationFrame = callback => dom.window.setTimeout(()=>callback(now),16);
  dom.window.cancelAnimationFrame = dom.window.clearTimeout;
  setup(dom.window);
  const root = createRoot(document.getElementById("root"));
  function Probe() { current = useHook(); return current?.view ?? null; }
  const render = async () => {await act(async()=>root.render(createElement(Probe)));};
  const run = async action => {await act(async()=>action(current));};
  async function tick(ms, commitLag=0) {
    const end=now+ms;
    for (;;) {
      const next=[...timers.entries()].filter(([,timer])=>timer.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];
      if (!next) break;
      now=next[1].due; timers.delete(next[0]);
      await act(async()=>{next[1].callback(); now+=commitLag;});
    }
    now=Math.max(now,end);
  }
  async function key(key, extra={}, target=document.body) {
    const event = new dom.window.KeyboardEvent("keydown",{key,bubbles:true,cancelable:true,...extra});
    Object.defineProperty(event,"timeStamp",{value:now});
    await run(()=>target.dispatchEvent(event));
    return event;
  }
  t.after(async()=>{
    await act(async()=>root.unmount());
    assertNoTimers(); dom.window.close();
    for(const [key,value] of originals) { if(value) Object.defineProperty(globalThis,key,value); else delete globalThis[key]; }
  });
  function assertNoTimers() { if(timers.size) throw new Error(`${timers.size} timers leaked after unmount`); }
  await render();
  return {get value(){return current;},now:()=>now,run,tick,key,render,pendingCount:()=>timers.size};
}
