import { startStack } from "./bootstrap.ts";

const stack = await startStack();
try {
  console.log(JSON.stringify({ directory: stack.directory, baseVersion: await stack.base.getVersion(), erVersion: await stack.er.getVersion(), identity: await stack.er.getClosestValidator() }));
} finally {
  await stack.stop();
}
