// test_browser_auth.js
// Direct Chrome DevTools Protocol tester using native Node 24 WebSocket

async function run() {
  const versionRes = await fetch('http://localhost:9222/json/version');
  const versionData = await versionRes.json();
  console.log('Connected to Edge CDP:', versionData.Browser);

  // Create a new target page using PUT
  const newTargetRes = await fetch('http://localhost:9222/json/new?http://localhost:5173/', { method: 'PUT' });
  const targetData = await newTargetRes.json();
  const pageWsUrl = targetData.webSocketDebuggerUrl;
  console.log('Target page created. WS URL:', pageWsUrl);

  const ws = new WebSocket(pageWsUrl);
  let msgId = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise((resolve) => ws.onopen = resolve);

  // Enable events
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    } else if (data.method === 'Runtime.consoleAPICalled') {
      console.log(`[BROWSER CONSOLE ${data.params.type.toUpperCase()}]`, ...data.params.args.map(a => a.value || a.description));
    } else if (data.method === 'Runtime.exceptionThrown') {
      console.error(`[BROWSER EXCEPTION]`, data.params.exceptionDetails);
    }
  };

  // Helper to evaluate JS in the page
  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return res.result?.value;
  }

  // 1. Wait for landing page load
  console.log('\n--- 1. Testing Landing Page (/) ---');
  await new Promise(r => setTimeout(r, 2000));
  const landingUrl = await evalJs('window.location.href');
  const landingTitle = await evalJs('document.title');
  const rootHtmlLen = await evalJs('document.getElementById("root")?.innerHTML?.length || 0');
  console.log('Current URL:', landingUrl);
  console.log('Page Title:', landingTitle);
  console.log('Root DOM length:', rootHtmlLen);

  // Check if Sign In link exists
  const signInExists = await evalJs('Boolean(document.querySelector("a[href=\'/login\']"))');
  console.log('Sign In link found:', signInExists);

  // 2. Click Sign In
  console.log('\n--- 2. Clicking "Sign In" link ---');
  await evalJs(`
    const link = document.querySelector("a[href='/login']");
    if (link) link.click();
  `);
  await new Promise(r => setTimeout(r, 1500));
  const postClickUrl = await evalJs('window.location.href');
  const postClickTitle = await evalJs('document.title');
  const postClickDom = await evalJs('document.body.innerText.substring(0, 300)');
  console.log('Post Click URL:', postClickUrl);
  console.log('Post Click Title:', postClickTitle);
  console.log('Post Click Visible Text:', JSON.stringify(postClickDom));

  // 3. Direct /login navigation
  console.log('\n--- 3. Direct Navigation to /login ---');
  await send('Page.navigate', { url: 'http://localhost:5173/login' });
  await new Promise(r => setTimeout(r, 2000));
  const directLoginUrl = await evalJs('window.location.href');
  const directLoginTitle = await evalJs('document.title');
  const directLoginText = await evalJs('document.body.innerText.substring(0, 300)');
  console.log('Direct /login URL:', directLoginUrl);
  console.log('Direct /login Title:', directLoginTitle);
  console.log('Direct /login Visible Text:', JSON.stringify(directLoginText));

  // 4. Direct /register navigation
  console.log('\n--- 4. Direct Navigation to /register ---');
  await send('Page.navigate', { url: 'http://localhost:5173/register' });
  await new Promise(r => setTimeout(r, 2000));
  const directRegUrl = await evalJs('window.location.href');
  const directRegTitle = await evalJs('document.title');
  const directRegText = await evalJs('document.body.innerText.substring(0, 300)');
  console.log('Direct /register URL:', directRegUrl);
  console.log('Direct /register Title:', directRegTitle);
  console.log('Direct /register Visible Text:', JSON.stringify(directRegText));

  // Close target
  await fetch(`http://localhost:9222/json/close/${targetData.id}`);
  ws.close();
  console.log('\nBrowser diagnostic session complete.');
  process.exit(0);
}

run().catch(console.error);
