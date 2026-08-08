import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";

const browserPath =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const frontendUrl = "http://localhost:5173";
const apiUrl = "http://localhost:3000/api";
const outputDirectory = path.resolve("screenshots");
const userDataDirectory = await mkdtemp(
  path.join(tmpdir(), "cmm-seller-orders-capture-"),
);
const debuggingPort = await findAvailablePort();
const browserErrors = [];
const failedResponses = [];
let browser;
let cdp;

try {
  const sellerSession = await login(
    "addis.build.supply@cmm.local",
    "DevSeller123!",
  );
  const order = await createCaptureOrder(sellerSession.accessToken);

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
  await cdp.send("Network.setCookie", {
    name: "refreshToken",
    value: sellerSession.refreshToken,
    url: `${apiUrl}/auth`,
    path: "/api/auth",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  });

  await setViewport(1440, 1000, false);
  await navigate(`${frontendUrl}/seller/orders`);
  await waitForSelector("table tbody tr");
  const desktopMetrics = await getLayoutMetrics();
  await capture("seller-orders-desktop.png");

  await click(
    `button[aria-label="View order #${order.id
      .slice(0, 8)
      .toUpperCase()}"]`,
  );
  await waitForSelector('[role="dialog"]');
  await waitForSelector(
    '[role="dialog"] button:not([disabled])',
  );
  await capture("seller-orders-details.png");

  const confirmed = await clickButtonByText("Confirm order");
  if (!confirmed) {
    throw new Error("The pending order did not expose a confirm action.");
  }
  await waitForSelector(
    '[role="dialog"] [data-seller-order-status="CONFIRMED"]',
  );
  await click('button[aria-label="Close order details"]');
  await waitForSelectorAbsent('[role="dialog"]');

  await setViewport(390, 844, true);
  await sleep(450);
  const mobileMetrics = await getLayoutMetrics();
  await capture("seller-orders-mobile.png");

  if (browserErrors.length > 0) {
    throw new Error(`Browser errors:\n${browserErrors.join("\n")}`);
  }
  const criticalResponses = failedResponses.filter(
    (response) =>
      response.status >= 500 ||
      ["Fetch", "XHR", "Script", "Stylesheet"].includes(response.type),
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
        desktop: desktopMetrics,
        failedResponses,
        mobile: mobileMetrics,
        orderId: order.id,
        screenshots: [
          "seller-orders-desktop.png",
          "seller-orders-details.png",
          "seller-orders-mobile.png",
        ],
        statusUpdate: "CONFIRMED",
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

async function login(email, password) {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Login failed for ${email}: ${response.status}`);
  }

  const body = await response.json();
  const cookie = response.headers.get("set-cookie");
  const refreshToken = cookie?.match(/refreshToken=([^;]+)/)?.[1];
  if (!refreshToken) {
    throw new Error("Login did not return a refresh-token cookie.");
  }

  return {
    accessToken: body.data.accessToken,
    refreshToken,
  };
}

async function createCaptureOrder(sellerAccessToken) {
  const productsResponse = await fetch(
    `${apiUrl}/seller/products?page=1&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${sellerAccessToken}`,
      },
    },
  );
  if (!productsResponse.ok) {
    throw new Error(
      `Seller products failed: ${productsResponse.status}`,
    );
  }
  const productsBody = await productsResponse.json();
  const product = productsBody.data.products[0];
  if (!product) {
    throw new Error("The capture seller has no inventory product.");
  }

  const timestamp = Date.now();
  const registrationResponse = await fetch(`${apiUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Seller Orders Capture Customer",
      email: `seller-orders-capture-${timestamp}@cmm.local`,
      password: "CaptureOrders123!",
      phone: "+251911555020",
      role: "CUSTOMER",
    }),
  });
  if (!registrationResponse.ok) {
    throw new Error(
      `Capture customer registration failed: ${registrationResponse.status}`,
    );
  }
  const registration = await registrationResponse.json();

  const orderResponse = await fetch(`${apiUrl}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${registration.data.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "CASH_ON_DELIVERY",
      shipping: {
        fullName: "Mekdes Alemu",
        phone: "+251911555020",
        city: "Addis Ababa",
        address: "Bole Road, Atlas area",
        notes: "Call before delivery.",
      },
    }),
  });
  if (!orderResponse.ok) {
    throw new Error(`Capture order failed: ${orderResponse.status}`);
  }

  return (await orderResponse.json()).data.order;
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
  await sleep(1400);
}

async function waitForSelector(selector) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (
      await evaluate(
        `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      )
    ) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for selector: ${selector}`);
}

async function waitForSelectorAbsent(selector) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (
      !(await evaluate(
        `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      ))
    ) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`Selector remained visible: ${selector}`);
}

async function click(selector) {
  const clicked = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    element.click();
    return true;
  })()`);
  if (!clicked) {
    throw new Error(`Could not click selector: ${selector}`);
  }
  await sleep(300);
}

async function clickButtonByText(text) {
  const clicked = await evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find(
      (element) => element.textContent?.trim() === ${JSON.stringify(text)}
    );
    if (!(button instanceof HTMLButtonElement)) {
      return false;
    }
    button.click();
    return true;
  })()`);
  await sleep(500);
  return clicked;
}

async function getLayoutMetrics() {
  return evaluate(`(() => ({
    bodyWidth: document.body.scrollWidth,
    cards: document.querySelectorAll("article").length,
    documentWidth: document.documentElement.scrollWidth,
    orderRows: document.querySelectorAll("table tbody tr").length,
    title: document.querySelector("h1")?.textContent?.trim() ?? null,
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
