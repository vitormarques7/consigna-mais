import { createDeploymentApp } from '../deploy/vercel.js';

// Vercel owns the listener; local development keeps its existing server entrypoint.
export default createDeploymentApp(process.env, (event) => console.info(JSON.stringify(event)));
