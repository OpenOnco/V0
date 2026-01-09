/**
 * OpenOnco API Root - Redirects to v1 documentation
 */

export default function handler(req, res) {
  res.setHeader('Location', '/api/v1');
  res.status(302).end();
}
