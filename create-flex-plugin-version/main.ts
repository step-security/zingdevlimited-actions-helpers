import { run } from './action';

run().catch((err: Error) => {
  console.error(`::error::${err.message}`);
  process.exit(1);
});
