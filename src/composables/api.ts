// The songbook API. By default the PHP script next to the app (same origin, so a password on
// the site covers it too); VITE_API_URL points the dev server or a test build elsewhere.
export const API_URL: string = import.meta.env.VITE_API_URL || 'songbook.php'
