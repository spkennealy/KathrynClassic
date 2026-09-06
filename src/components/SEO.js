import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://www.kathrynclassic.com';
const DEFAULT_TITLE = 'The Kathryn Classic | Annual Charity Golf Tournament';
const DEFAULT_DESCRIPTION =
  'Join us for a weekend of family, golf & giving. The annual Kathryn Classic tournament supports CJD research through the CJD Foundation.';

/**
 * Per-page SEO tags. Set at the route level in App.js so each page gets its own
 * title, description, and canonical URL in search results and link previews.
 */
export default function SEO({ title, description = DEFAULT_DESCRIPTION, path = '' }) {
  const fullTitle = title ? `${title} | The Kathryn Classic` : DEFAULT_TITLE;
  const canonical = `${SITE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />

      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}
