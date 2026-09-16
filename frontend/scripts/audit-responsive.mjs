/**
 * Responsive audit for the CMM marketplace.
 *
 * The UI work asks for the layout to be *checked* at eight widths rather than
 * assumed, so this script drives headless Edge over CDP, resizes the viewport,
 * and reports two things per route and width: whether the document scrolls
 * sideways, and — when it does — which elements stick out past the viewport.
 * Only innermost offenders are printed, because a wide child makes every
 * ancestor look wide and the ancestor is never the bug.
 *
 * Elements inside a genuinely scrollable `overflow-x` container are ignored:
 * the category rail and the dashboard tables are meant to scroll sideways
 * within their own box, and they do not move the page.
 *
 * Needs both dev servers running (`npm run dev` in `backend/` and `frontend/`).
 *
 *   node scripts/audit-responsive.mjs
 *   node scripts/audit-responsive.mjs --light --shots
 */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const browserPath =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const frontendUrl = "http://localhost:5173";
const outputDirectory = path.resolve("screenshots/responsive");

/** The widths the request names, plus the two the token layer is designed on. */
const WIDTHS = [320, 375, 390, 414, 768, 1024, 1280, 1440];
const SHOT_WIDTHS = new Set([390, 768, 1440]);

const ROUTES = [
  "/",
  "/products",
  "/products?search=cement&sort=price-asc",
  "/stores",
  "/professionals",
  "/projects",
  "/cart",
  "/login",
];

const wantsLight = process.argv.includes("--light");
const wantsShots = process.argv.includes("--shots");

const MEASURE = `(() => {
  const doc = document.documentElement;
  const limit = doc.clientWidth;
  const overflow = doc.scrollWidth - limit;
  const result = {
    h1: document.querySelector("h1")?.textContent?.trim() ?? null,
    limit,
    offenders: [],
    overflow,
    scrollWidth: doc.scrollWidth,
  };
  if (overflow <= 1) {
    return result;
  }

  const scrollable = new Set();
  for (const node of document.querySelectorAll("*")) {
    const overflowX = getComputedStyle(node).overflowX;
    if (
      (overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden") &&
      node.scrollWidth > node.clientWidth + 1
    ) {
      scrollable.add(node);
    }
  }
  const inScrollableBox = (node) => {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      if (scrollable.has(parent)) {
        return true;
      }
    }
    return false;
  };

  const wide = [];
  for (const node of document.body.querySelectorAll("*")) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }
    if (rect.right <= limit + 1) {
      continue;
    }
    if (inScrollableBox(node)) {
      continue;
    }
    wide.push(node);
  }

  // Innermost only: an offender that contains another offender is a symptom.
  const causes = wide.filter(
    (node) => !wide.some((other) => other !== node && node.contains(other)),
  );
  result.offenders = causes.slice(0, 10).map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      classes: (node.getAttribute("class") ?? "").slice(0, 140),
      right: Math.round(rect.right),
      tag: node.tagName.toLowerCase(),
      text: (node.textContent ?? "").trim().slice(0, 60),
      width: Math.round(rect.width),
    };
  });
  return result;
})()`;

let browser;
let cdp;
let failures = 0;

try {
  if (wantsShots) {
    await mkdir(outputDirectory, { recursive: true });
  }
  const userDataDirectory = await mkdtemp(path.join(tmpdir(), "cmm-audit-"));
  const debuggingPort = await findAvailablePort();

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
  browser.stderr.on("data", () => {});

  await waitForBrowser(debuggingPort);
  const target = await createTarget(debuggingPort);
  cdp = await createCdpClient(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // The theme is stored per origin, so it has to be set from a loaded page.
  await setViewport(1440, 900);
  await navigate(frontendUrl, 1200);
  await evaluate(
    `localStorage.setItem("cmm.theme", ${JSON.stringify(
      wantsLight ? "light" : "dark",
    )})`,
  );

  console.log(`theme: ${wantsLight ? "light" : "dark"}`);

  for (const route of ROUTES) {
    console.log(`\n${route}`);
    for (const width of WIDTHS) {
      await setViewport(width, width < 500 ? 844 : 900);
      // A fresh load per width, so route-level effects run at that size.
      await navigate(`${frontendUrl}${route}`, width === WIDTHS[0] ? 1600 : 1100);
      const measurement = await evaluate(MEASURE);

      if (measurement.overflow > 1) {
        failures += 1;
        console.log(
          `  ${String(width).padStart(4)}  OVERFLOW +${measurement.overflow}px ` +
            `(scrollWidth ${measurement.scrollWidth} > ${measurement.limit})`,
        );
        for (const offender of measurement.offenders) {
          console.log(
            `        <${offender.tag}> w=${offender.width} right=${offender.right}` +
              `\n          class="${offender.classes}"` +
              (offender.text ? `\n          text="${offender.text}"` : ""),
          );
        }
      } else {
        console.log(
          `  ${String(width).padStart(4)}  ok   h1=${
            measurement.h1 === null ? "—" : JSON.stringify(measurement.h1)
          }`,
        );
      }

      if (wantsShots && SHOT_WIDTHS.has(width)) {
        await capture(
          `${route === "/" ? "home" : route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${width}.png`,
        );
      }
    }
  }

  console.log(
    `\n${failures === 0 ? "no horizontal overflow found" : `${failures} width/route combinations overflow`}`,
  );
  process.exitCode = failures === 0 ? 0 : 1;

  await rm(userDataDirectory, { recursive: true, force: true }).catch(() => {});
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
}

async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text,
    );
  }
  return result.result.value;
}

async function setViewport(width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height,
    mobile: width < 500,
    width,
  });
}

async function navigate(url, settleMs) {
  await cdp.send("Page.navigate", { url });
  await sleep(settleMs);
}

async function capture(filename) {
  const result = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: true,
    format: "png",
    fromSurface: true,
  });
  await writeFile(
    path.join(outputDirectory, filename),
    Buffer.from(result.data, "base64"),
  );
}

async function waitForBrowser(debuggingPort) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
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
  throw new Error("The Edge DevTools endpoint did not start.");
}

async function createTarget(debuggingPort) {
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
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve) => server.close(resolve));
  if (!port) {
    throw new Error("Could not allocate a browser debugging port.");
  }
  return port;
}
