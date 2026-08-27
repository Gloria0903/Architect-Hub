/**
 * Custom entry point for cPanel's "Setup Node.js App" tool specifically.
 *
 * cPanel's Node.js Selector runs a literal JavaScript file via `node
 * <file>` -- it has no concept of running an npm script like `next
 * start`, which is what every other deployment path in this repo uses
 * instead (Vercel builds its own entry; Railway/Docker run the
 * standalone build's own auto-generated .next/standalone/server.js, a
 * completely different file from this one). This file exists only to
 * satisfy that one platform's requirement.
 *
 * PASSENGER NOTE: cPanel's Node.js Selector runs your app under
 * Phusion Passenger, which manages process lifecycle and routing.
 * Passenger sets its own PORT environment variable and expects your
 * app to listen on it -- which this file does via process.env.PORT,
 * the standard, documented pattern for a plain (non-Express) Node
 * server under Passenger. If the app doesn't start, check the Error
 * Log in cPanel's Node.js Selector interface first -- that's the
 * fastest way to see what actually went wrong.
 *
 * Requires the app to be built WITHOUT standalone output first --
 * DISABLE_STANDALONE_BUILD=true (see next.config.js) -- since this
 * boots a normal Next.js production server against a normal .next
 * build directory, not the standalone output shape.
 *
 * In cPanel's "Setup Node.js App" interface, set "Application startup
 * file" to this file's path (server.js, at the repo root).
 */

const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const { createServer } = require("http");

    createServer((req, res) => {
      handle(req, res);
    }).listen(port, () => {
       
      console.log(`Architect Hub listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
