import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";

const browserPath =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const frontendUrl = "http://localhost:5173";
const outputDirectory = path.resolve("screenshots");
const userDataDirectory = await mkdtemp(
  path.join(tmpdir(), "cmm-marketplace-smoke-"),
);
const debuggingPort = await findAvailablePort();
const browserErrors = [];
const failedResponses = [];
let browser;
let cdp;

try {
  await mkdir(outputDirectory, { recursive: true });
  browser = spawn(
    browserPath,
    [
      "--headless=new",
      `--remote-debugging-port=${debuggingPort}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${userDataDirectory}`,
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  browser.stderr.on("data", (chunk) => {
    const message = chunk.toString();
    if (!message.includes("DevTools listening")) {
      process.stderr.write(chunk);
    }
  });

  await waitForBrowser();
  const target = await createTarget();
  cdp = await createCdpClient(target.webSocketDebuggerUrl, (message) => {
    if (message.method === "Runtime.exceptionThrown") {
      browserErrors.push(
        message.params.exceptionDetails.text ?? "Runtime exception",
      );
    }
    if (
      message.method === "Network.responseReceived" &&
      message.params.response.status >= 400
    ) {
      failedResponses.push({
        status: message.params.response.status,
        type: message.params.type,
        url: message.params.response.url,
      });
    }
    if (
      message.method === "Log.entryAdded" &&
      message.params.entry.level === "error" &&
      !message.params.entry.text.startsWith("Failed to load resource:")
    ) {
      browserErrors.push(message.params.entry.text);
    }
  });
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Network.enable");

  await setViewport(1440, 1000, false);
  await navigate(`${frontendUrl}/products`);
  await evaluate(
    `sessionStorage.setItem("cmm.marketplace.city", "Addis Ababa")`,
  );
  // Force a full page reload so the Zustand store re-reads sessionStorage on init.
  await cdp.send("Page.reload", { ignoreCache: true });
  await sleep(2000);
  await waitForPage(
    `document.querySelector("h1")?.textContent?.trim() === "Construction materials" &&
      document.querySelectorAll('a[href^="/products/"]').length > 0 &&
      document.body.textContent.includes("Addis Ababa marketplace")`,
    "city-scoped product catalog",
  );
  const productsDesktop = await getLayoutMetrics();
  await capture("marketplace-products-desktop.png");

  await navigate(`${frontendUrl}/stores`);
  await waitForPage(
    `document.querySelector("h1")?.textContent?.includes("Suppliers in Addis Ababa") &&
      document.querySelectorAll('a[href^="/stores/"]').length >= 3`,
    "supplier directory",
  );
  const suppliersDesktop = await getLayoutMetrics();
  await capture("marketplace-suppliers-desktop.png");

  const firstStorePath = await evaluate(
    `document.querySelector('a[href^="/stores/"]')?.getAttribute("href")`,
  );
  if (!firstStorePath) {
    throw new Error("Supplier directory did not expose a store link.");
  }
  await navigate(`${frontendUrl}${firstStorePath}`);
  await waitForPage(
    `document.querySelector("h1")?.textContent?.trim().length > 0 &&
      document.querySelectorAll('a[href^="/products/"]').length > 0 &&
      document.body.textContent.includes("Store inventory")`,
    "seller storefront",
  );
  const storeDesktop = await getLayoutMetrics();
  await capture("marketplace-store-desktop.png");

  await setViewport(390, 844, true);
  await navigate(`${frontendUrl}/products`);
  await waitForPage(
    `document.querySelector("h1")?.textContent?.trim() === "Construction materials" &&
      document.querySelectorAll('a[href^="/products/"]').length > 0`,
    "mobile product catalog",
  );
  const productsMobile = await getLayoutMetrics();
  await capture("marketplace-products-mobile.png");

  await navigate(`${frontendUrl}/stores`);
  await waitForPage(
    `document.querySelector("h1")?.textContent?.includes("Suppliers in Addis Ababa")`,
    "mobile supplier directory",
  );
  const suppliersMobile = await getLayoutMetrics();
  await capture("marketplace-suppliers-mobile.png");

  const overflowedLayouts = [
    productsDesktop,
    suppliersDesktop,
    storeDesktop,
    productsMobile,
    suppliersMobile,
  ].filter(
    (metrics) =>
      metrics.bodyWidth > metrics.viewportWidth ||
      metrics.documentWidth > metrics.viewportWidth,
  );
  if (overflowedLayouts.length > 0) {
    throw new Error(
      `Horizontal overflow detected:\n${JSON.stringify(
        overflowedLayouts,
        null,
        2,
      )}`,
    );
  }
  if (browserErrors.length > 0) {
    throw new Error(`Browser errors:\n${browserErrors.join("\n")}`);
  }
  const criticalResponses = failedResponses.filter(
    (response) =>
      !response.url.includes("/api/auth/") &&
      (response.status >= 500 ||
        ["Fetch", "XHR", "Script", "Stylesheet"].includes(response.type)),
  );
  if (criticalResponses.length > 0) {
    throw new Error(
      `Critical HTTP failures:\n${JSON.stringify(
        criticalResponses,
        null,
        2,
      )}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        failedResponses,
        productsDesktop,
        productsMobile,
        storeDesktop,
        suppliersDesktop,
        suppliersMobile,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  cdp?.close();
  if (browser && !browser.killed) {
    browser.kill();
    await Promise.race([
      new Promise((resolve) => browser.once("exit", resolve)),
      sleep(1500),
    ]);
  }
  await sleep(300);
  try {
    await rm(userDataDirectory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  } catch (error) {
    console.warn(`Could not remove temporary browser profile: ${error}`);
  }
}

async function waitForBrowser() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(
        `http://localhost:${debuggingPort}/json/version`,
      );
      if (response.ok) {
        return;
      }
    } catch {
      // The browser is still starting.
    }
    await sleep(100);
  }
  throw new Error("Browser DevTools endpoint did not start.");
}

async function createTarget() {
  const response = await fetch(
    `http://localhost:${debuggingPort}/json/new?${encodeURIComponent(
      "about:blank",
    )}`,
    { method: "PUT" },
  );
  if (!response.ok) {
    throw new Error(`Browser target creation failed: ${response.status}`);
  }
  return response.json();
}

async function createCdpClient(webSocketUrl, onEvent) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let messageId = 0;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      onEvent(message);
      return;
    }
    const request = pending.get(message.id);
    if (!request) {
      return;
    }
    pending.delete(message.id);
    if (message.error) {
      request.reject(new Error(message.error.message));
      return;
    }
    request.resolve(message.result);
  });

  return {
    close: () => socket.close(),
    send(method, params = {}) {
      messageId += 1;
      const id = messageId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function setViewport(width, height, mobile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
}

async function navigate(url) {
  await cdp.send("Page.navigate", { url });
  await sleep(2000);
}

async function waitForPage(condition, description) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (await evaluate(`Boolean(${condition})`)) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

async function getLayoutMetrics() {
  return evaluate(`(() => ({
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    heading: document.querySelector("h1")?.textContent?.trim() ?? null,
    productLinks: document.querySelectorAll('a[href^="/products/"]').length,
    storeLinks: document.querySelectorAll('a[href^="/stores/"]').length,
    viewportWidth: window.innerWidth
  }))()`);
}

async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }
  return result.result.value;
}

async function capture(filename) {
  const result = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true,
  });
  await writeFile(
    path.join(outputDirectory, filename),
    Buffer.from(result.data, "base64"),
  );
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function findAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : null;
  await new Promise((resolve) => server.close(resolve));
  if (!port) {
    throw new Error("Could not allocate a browser debugging port.");
  }
  return port;
}
