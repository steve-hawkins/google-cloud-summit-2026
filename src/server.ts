import { createApp } from './app.js';

const app = createApp();
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Carbon-Aware API server listening on port ${PORT}`);
});
