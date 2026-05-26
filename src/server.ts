import env from './config/env';
import app from './app';

const PORT = env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`🚀 LOGMAS API Engine running on mode: [${env.NODE_ENV}] listening intently on tracking socket port reference: ${PORT}`);
  console.log(`📑 Swagger Documentation active dashboard endpoints maps served directly on: http://localhost:${PORT}/api/v1/docs`);
});