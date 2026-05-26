import env from './env';

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'LOGMAS API Engine Documentation',
    version: '1.0.0',
    description: 'System documentation setup targeting production systems deployed for local governance configurations.'
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}/api/v1`,
      description: 'Dynamic Local Runtime Node'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Authentication Module'],
        summary: 'Register system user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { '201': { description: 'Successful provisioning sequence output matching response objects structure.' } }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Authentication Module'],
        summary: 'Establish security assertion verification session token state',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { '200': { description: 'Authorization validated access token wrapper tokens.' } }
      }
    }
  }
};
