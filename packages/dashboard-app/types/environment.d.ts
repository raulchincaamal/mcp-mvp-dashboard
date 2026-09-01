/**
 * TypeScript type definitions for Node.js process environment variables.
 *
 * Extends the NodeJS.ProcessEnv interface to provide type safety for all
 * environment variables used throughout the application.
 *
 * @module types/environment
 */

namespace NodeJS {
  /**
   * Extended ProcessEnv interface with application-specific environment variables.
   *
   * Provides type definitions for configuration values including:
   * - Application logging and telemetry settings
   * - Authentication and session management
   * - Azure AD integration
   * - Backend API endpoints
   * - Redis configuration
   * - Device verification settings
   * - ADB and M360 integration
   */
  interface ProcessEnv extends NodeJS.ProcessEnv {
    /** Application logs name identifier */
    NEXT_PUBLIC_APP_LOGS_NAME: string;
    /** Logging level (debug, info, warn, error) */
    NEXT_PUBLIC_LOGS_LEVEL: string;
    /** Flag to enable/disable silent logs */
    NEXT_PUBLIC_SILENT_LOGS: string;
    /** Next.js telemetry disabled flag */
    NEXT_TELEMETRY_DISABLED: number;

    /** NextAuth secret key for session encryption */
    NEXTAUTH_SECRET: string;
    /** Session timeout duration in minutes */
    TIMEOUT_SESSION_MINUTES: number;

    /** Azure AD application client ID */
    AZURE_AD_CLIENT_ID: string;
    /** Azure AD tenant identifier */
    AZURE_AD_TENANT_ID: string;
    /** Azure AD client secret for authentication */
    AZURE_AD_CLIENT_SECRET: string;
    /** Azure AD logout redirect URL */
    URL_AZURE_AD_LOGOUT: string;
    /** Azure AD resource identifier */
    AZURE_AD_CLIENT_RESOURCE: string;
    /** Azure AD OAuth grant type */
    AZURE_AD_CLIENT_GRANT_TYPE: string;
    /** Azure AD Graph API token endpoint */
    AZURE_AD_GRAPH_URL_TOKEN: string;
    /** Azure AD Graph API groups endpoint */
    AZURE_AD_GRAPH_GROUPS: string;
    /** Azure AD Graph API user lookup endpoint */
    AZURE_AD_GRAPH_GET_USER_BY_EMAIL: string;

    /** Node environment (development, production, test) */
    NODE_ENV: string;

    /** Login redirect URL */
    URL_REDIRECT_LOGIN: string;
    /** Main menu redirect URL */
    NEXT_PUBLIC_REDIRECT_MENU: string;
    /** Application base path */
    NEXT_PUBLIC_BASE_PATH: string;

    /** Redis server host */
    REDIS_HOST: string;
    /** Redis server port */
    REDIS_PORT: number;
    /** Redis server password */
    REDIS_PASS: string;

    /** Secret key for signature generation */
    SECRET_SIGNATURE: string;

    /** Public domain URL */
    NEXT_PUBLIC_DOMAIN_URL: string;
    /** Public login redirect URL */
    NEXT_PUBLIC_REDIRECT_LOGIN: string;

    /** Login operation prefix */
    PREFIX_LOGIN: string;
    /** Session token identifier */
    SESSION_TOKEN: string;
    /** Frontend application identifier */
    ID_FRONT: string;
    /** Public Azure AD logout URL */
    NEXT_PUBLIC_URL_AZURE_AD_LOGOUT: string;
  }
}
