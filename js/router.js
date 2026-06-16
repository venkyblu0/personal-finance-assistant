/**
 * @module router
 * @description Hash-based SPA router. Listens to hashchange events, matches
 * registered routes, and dispatches 'route-changed' custom events.
 *
 * @example
 * import { router } from './router.js';
 * router.addRoute('/dashboard', () => renderDashboard());
 * router.addRoute('/transactions', () => renderTransactions());
 * router.init();
 */

class Router {
  constructor() {
    /** @type {Map<string, Function>} */
    this._routes = new Map();
    /** @type {string} */
    this._currentRoute = '';
    /** @type {boolean} */
    this._initialized = false;
  }

  /**
   * Register a route handler.
   * @param {string} path - Route path (e.g., '/dashboard').
   * @param {Function} handler - Function to call when route matches.
   * @returns {Router} This instance for chaining.
   */
  addRoute(path, handler) {
    if (typeof handler !== 'function') {
      console.warn(`[Router] Handler for "${path}" is not a function`);
      return this;
    }
    this._routes.set(path, handler);
    return this;
  }

  /**
   * Navigate to a path programmatically.
   * @param {string} path - Route path to navigate to.
   */
  navigate(path) {
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    window.location.hash = '#' + path;
    // hashchange listener will handle the rest
  }

  /**
   * Get the current active route path.
   * @returns {string} Current route path.
   */
  getCurrentRoute() {
    return this._currentRoute;
  }

  /**
   * Initialize the router: attach hashchange listener and trigger the
   * current route. Defaults to '/dashboard' when no hash is present.
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    window.addEventListener('hashchange', () => this._handleRouteChange());

    // Handle initial route
    const hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#/') {
      window.location.hash = '#/dashboard';
    } else {
      this._handleRouteChange();
    }
  }

  /**
   * Internal: parse the current hash, find the matching handler, and invoke it.
   * @private
   */
  _handleRouteChange() {
    const hash = window.location.hash || '#/dashboard';
    const path = hash.replace(/^#/, '') || '/dashboard';

    // Normalize path
    const normalizedPath = path.startsWith('/') ? path : '/' + path;

    this._currentRoute = normalizedPath;

    // Try exact match first
    let handler = this._routes.get(normalizedPath);

    // Try matching with path params (e.g., /transactions/:id)
    if (!handler) {
      for (const [routePath, routeHandler] of this._routes) {
        if (this._matchRoute(routePath, normalizedPath)) {
          handler = routeHandler;
          break;
        }
      }
    }

    // Dispatch route-changed event
    window.dispatchEvent(new CustomEvent('route-changed', {
      detail: { path: normalizedPath }
    }));

    if (handler) {
      try {
        handler(normalizedPath);
      } catch (err) {
        console.error(`[Router] Error handling route "${normalizedPath}":`, err);
      }
    } else {
      console.warn(`[Router] No handler registered for "${normalizedPath}"`);
      // Fall back to dashboard if route unknown
      if (normalizedPath !== '/dashboard' && this._routes.has('/dashboard')) {
        this.navigate('/dashboard');
      }
    }
  }

  /**
   * Check if a route pattern matches a given path.
   * Supports basic param segments like ':id'.
   * @param {string} pattern - Route pattern (e.g., '/transactions/:id').
   * @param {string} path - Actual path.
   * @returns {boolean}
   * @private
   */
  _matchRoute(pattern, path) {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) return false;

    return patternParts.every((part, i) => {
      if (part.startsWith(':')) return true; // param segment matches anything
      return part === pathParts[i];
    });
  }
}

export const router = new Router();
