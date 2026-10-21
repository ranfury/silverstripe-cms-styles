/* ------------------------------------------------------------------
Preview (runs in the page shown in the CMS's preview, not the CMS)

Checks the page's headings when the CMS asks (components/seo-check.js)
and reports problems as CMS toasts. Problem headings get a wavy underline
that repeats the message when hovered
------------------------------------------------------------------ */

const ORIGIN = window.location.origin;

function toast(message) {
  try {
    window.parent.jQuery.noticeAdd({ text: `SEO: ${message}`, type: 'warning', stay: false });
  } catch {
    // Not inside the CMS
  }
}

function flag(heading, colour, message) {
  let ready = true;

  heading.style.textDecoration = `underline wavy ${colour} 2px`;
  heading.addEventListener('mouseenter', () => {
    if (!ready) return;

    ready = false;
    toast(message);
    setTimeout(() => ready = true, 6000);
  });
}

function checkHeadings() {
  const problems = [];
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  const h1s = headings.filter((h) => h.tagName === 'H1');

  // One <h1>, and it comes first
  if (!h1s.length) {
    problems.push('The page has no <h1>.');
  } else if (h1s.length > 1) {
    problems.push(`The page has ${h1s.length} <h1>s, there should only be one.`);
  } else if (headings[0].tagName !== 'H1') {
    problems.push('The first heading on the page should be its <h1>.');
  }

  let level = 0;
  let seenH1 = false;

  headings.forEach((heading, i) => {
    const current = Number(heading.tagName[1]);
    const text = heading.textContent.trim().slice(0, 60);

    if (current === 1) {
      if (seenH1) {
        const message = `Another <h1> ("${text}"), only the first heading should be an <h1>.`;
        flag(heading, 'red', message);
        problems.push(message);
      }

      seenH1 = true;
    } else if (seenH1 && level && current > level + 1) {
      // No skipped levels going down (an <h2> then an <h4>)
      const message = `"${text}" skips from <h${level}> to <h${current}>, use an <h${level + 1}> (styled smaller if needed).`;
      flag(heading, 'orange', message);
      problems.push(message);
    } else if (seenH1 && i === 1 && current !== 2) {
      const message = `The heading after the <h1> should be an <h2>, "${text}" is an <h${current}>.`;
      flag(heading, 'orange', message);
      problems.push(message);
    }

    level = current;
  });

  problems.forEach(toast);
}

if (window.self !== window.top) {
  window.addEventListener('message', (e) => {
    if (e.origin === ORIGIN && e.data?.action === 'checkSEO') checkHeadings();
  });

  const ready = () => window.parent.postMessage({ action: 'seo-check-ready' }, ORIGIN);

  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready, { once: true });
}
