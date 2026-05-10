export const ENV = {
  API_URL: import.meta.env.VITE_API_URL || '',
  COGNITO_USER_POOL_ID: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  COGNITO_CLIENT_ID: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
  REGION: import.meta.env.VITE_REGION || 'us-west-2',
  DEMO_MODE: import.meta.env.VITE_DEMO_MODE === 'true',
}

// Validate required environment variables
const requiredEnvVars = [
  'VITE_API_URL',
  'VITE_COGNITO_USER_POOL_ID',
  'VITE_COGNITO_CLIENT_ID',
]

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !import.meta.env[varName]
)

if (missingEnvVars.length > 0 && !ENV.DEMO_MODE) {
  console.warn(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  )
  console.warn('Create a .env.local file based on .env.example')
}
