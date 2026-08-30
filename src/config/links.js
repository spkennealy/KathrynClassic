// External destinations referenced from more than one place.
//
// Keep them here so changing a URL is a one-line edit instead of a grep across
// components — the donation link in particular has already been wrong once
// because it was duplicated in the navbar and the About page.

// CJD Foundation donation page for The Kathryn Classic, hosted on QGiv.
export const DONATE_URL = 'https://secure.qgiv.com/event/cjdfoundation/account/2427332/';
