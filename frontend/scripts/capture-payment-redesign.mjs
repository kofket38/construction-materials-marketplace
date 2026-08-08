import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";

const browserPath =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const frontendUrl = "http://localhost:5173";
const apiUrl = "http://localhost:3000/api";
const outputDirectory = path.resolve("screenshots");
const userDataDirectory = await mkdtemp(
  path.join(tmpdir(), "cmm-payment-capture-"),
);
const debuggingPort = await findAvailablePort();
let browser;
let cdp;

try {
  const session = await registerCaptureCustomer();
  const product = await loadCaptureProduct();
  const refreshToken = parseRefreshToken(session.cookie);

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
    process.stderr.write(chunk);
  });

  await waitForBrowser();
  const target = await createTarget();
  cdp = await createCdpClient(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Network.setCookie", {
    name: "refreshToken",
    value: refreshToken,
    url: `${apiUrl}/auth`,
    path: "/api/auth",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  });

  await setViewport(1440, 1050, false);
  await navigate(frontendUrl);
  await cdp.send("Runtime.evaluate", {
    expression: `localStorage.setItem("cmm-marketplace-cart-v1", ${JSON.stringify(
      JSON.stringify(createCart(session.user.id, product)),
    )})`,
  });
  await navigate(`${frontendUrl}/checkout`);
  await waitForSelector("#payment-provider-telebirr:not(:disabled)");
  await click("#payment-provider-telebirr");
  await waitForSelector("#payment-proof");
  await capture("payment-redesign-desktop.png");
  console.log("Captured desktop digital-payment screen.");

  await click("#payment-provider-cash_on_delivery");
  await sleep(250);
  await capture("payment-redesign-cash-on-delivery.png");
  console.log("Captured cash-on-delivery screen.");

  await click("#payment-provider-telebirr");
  await setViewport(390, 844, true);
  await sleep(400);
  await capture("payment-redesign-mobile.png");
  console.log("Captured mobile digital-payment screen.");

  console.log(outputDirectory);
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
    console.warn(`Could not remove temporary Chrome profile: ${error}`);
  }
}

async function registerCaptureCustomer() {
  const response = await fetch(`${apiUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Payment Preview Customer",
      email: `payment-preview-${Date.now()}@cmm.local`,
      password: "PreviewPay123!",
      phone: "+251911555010",
      role: "CUSTOMER",
    }),
  });
  if (!response.ok) {
    throw new Error(`Customer registration failed: ${response.status}`);
  }

  return {
    ...(await response.json()).data,
    cookie: response.headers.get("set-cookie"),
  };
}

async function loadCaptureProduct() {
  const response = await fetch(`${apiUrl}/products?page=1&limit=1`);
  if (!response.ok) {
    throw new Error(`Product loading failed: ${response.status}`);
  }
  const body = await response.json();
  const product = body.data.products[0];
  if (!product) {
    throw new Error("No product is available for checkout capture.");
  }
  return product;
}

function parseRefreshToken(cookie) {
  const match = cookie?.match(/refreshToken=([^;]+)/);
  if (!match?.[1]) {
    throw new Error("Registration did not return a refresh-token cookie.");
  }
  return match[1];
}

function createCart(userId, product) {
  const now = new Date().toISOString();
  return {
    version: 1,
    cartsByUserId: {
      [userId]: [
        {
          addedAt: now,
          availableQuantity: product.quantity,
          brandName: product.brand?.name ?? null,
          categoryId: product.categoryId,
          categoryName: product.category.name,
          imageUrl: product.imageUrl,
          name: product.name,
          price: product.price,
          productId: product.id,
          quantity: 2,
          sellerName: product.seller.shopName || product.seller.name,
          updatedAt: now,
        },
      ],
    },
  };
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
      // Chrome is still starting.
    }
    await sleep(100);
  }
  throw new Error("Chrome DevTools endpoint did not start.");
}

async function createTarget() {
  const response = await fetch(
    `http://localhost:${debuggingPort}/json/new?${encodeURIComponent(
      "about:blank",
    )}`,
    { method: "PUT" },
  );
  if (!response.ok) {
    throw new Error(`Chrome target creation failed: ${response.status}`);
  }
  return response.json();
}

async function createCdpClient(webSocketUrl) {
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
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await cdp.send("Runtime.evaluate", {
      expression: `Boolean(document.querySelector(${JSON.stringify(
        selector,
      )}))`,
      returnByValue: true,
    });
    if (result.result.value) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for selector: ${selector}`);
}

async function click(selector) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `document.querySelector(${JSON.stringify(selector)})?.click()`,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(`Could not click ${selector}.`);
  }
  await sleep(250);
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
