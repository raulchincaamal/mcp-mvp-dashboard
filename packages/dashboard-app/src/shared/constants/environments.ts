/**
 * Environment variables configuration module.
 *
 * Exports typed environment variables from process.env for use throughout the application.
 * Provides centralized access to configuration values for Azure AD, API endpoints, and application settings.
 *
 * @module constants/environments
 */

/**
 * Base path for the Next.js application.
 * @type {string | undefined}
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH;

/**
 * Domain URL for the application.
 * @type {string | undefined}
 */
export const DOMAIN_URL = process.env.DOMAIN_URL;

/**
 * Azure AD logout URL.
 * @type {string | undefined}
 */
export const URL_AZURE_AD_LOGOUT = process.env.NEXT_PUBLIC_URL_AZURE_AD_LOGOUT;

/**
 * Redirect URL after login.
 * @type {string | undefined}
 */
export const URL_REDIRECT_LOGIN = process.env.NEXT_PUBLIC_REDIRECT_LOGIN;

/**
 * Azure AD and application configuration variables.
 * Destructured from process.env for direct access.
 */
export const {
  /** Azure AD client grant type for OAuth flow */
  AZURE_AD_CLIENT_GRANT_TYPE,
  /** Azure AD client application ID */
  AZURE_AD_CLIENT_ID,
  /** Azure AD client resource identifier */
  AZURE_AD_CLIENT_RESOURCE,
  /** Azure AD client secret for authentication */
  AZURE_AD_CLIENT_SECRET,
  /** Azure AD Graph API endpoint to get user by email */
  AZURE_AD_GRAPH_GET_USER_BY_EMAIL,
  /** Azure AD Graph API endpoint for groups */
  AZURE_AD_GRAPH_GROUPS,
  /** Azure AD Graph API token URL */
  AZURE_AD_GRAPH_URL_TOKEN,
  /** Azure AD tenant identifier */
  AZURE_AD_TENANT_ID,
  /** Session timeout duration in minutes */
  TIMEOUT_SESSION_MINUTES,
  /** Prefix for login operations */
  PREFIX_LOGIN,
  /** Session token identifier */
  SESSION_TOKEN,
  /** Frontend application identifier */
  ID_FRONT,
} = process.env;

/**
 * Refetch interval in seconds for polling operations.
 * @type {number}
 */
export const REFETCH_INTERVAL = 60;
