#!/usr/bin/env node
import { run } from "@/cli";

const NODE_MIN = 20;
const major = Number(process.versions.node.split(".")[0]);
if (Number.isFinite(major) && major < NODE_MIN) {
  // eslint-disable-next-line no-console
  console.error(
    `The Superwall wizard requires Node.js >=${NODE_MIN}. You are on ${process.version}.`,
  );
  process.exit(1);
}

run();
