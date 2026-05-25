import app from './app';
const env = require('./config/env');

const PORT = env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 LOGMAS API Engine running on mode: [${env.NODE_ENV}] listening intently on tracking socket port reference: ${PORT}`);
  console.log(`📑 Swagger Documentation active dashboard endpoints maps served directly on: http://localhost:${PORT}/api/v1/docs`);
});