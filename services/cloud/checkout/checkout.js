(() => {
  const config=window.daywhisperCheckout;
  const token=config?.clientToken||'';
  const sandbox=config?.environment==='sandbox';
  if(!window.Paddle || !(sandbox ? /^test_/.test(token) : config?.environment==='live' && /^live_/.test(token)))return;
  if(sandbox)Paddle.Environment.set('sandbox');
  Paddle.Initialize({token});
  document.getElementById('status').textContent='Review your purchase with Paddle. After payment, return to Daywhisper and restore purchases.';
})();
