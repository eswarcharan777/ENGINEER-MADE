import React from 'react';

type Props = { kind: 'privacy' | 'terms' | 'contact' | 'faq' | 'changelog' };

const sections = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'Engineer Made stores only the information needed to provide learning accounts and progress features.',
    items: [
      ['What we collect', 'Account details, learner profile fields, completed lessons, bookmarks, assessment attempts, and projects you choose to save.'],
      ['How we use it', 'We use this data to authenticate you, personalize roadmaps, save progress, and provide requested learning tools.'],
      ['Your control', 'You can review your profile, remove saved resources, and contact us to ask about your data.'],
      ['AI features', 'Text or files sent to an AI tool are used to answer your request. Do not submit passwords, private keys, or sensitive personal information.'],
    ],
  },
  terms: {
    title: 'Terms of Use',
    intro: 'Engineer Made is a free educational project. Use it responsibly and verify important technical, academic, or career advice.',
    items: [
      ['Educational use', 'Content is provided for learning and practice. It is not a guarantee of employment, examination results, certification, or professional licensure.'],
      ['Your content', 'You are responsible for the accuracy and rights of projects, notes, links, and files you submit. Do not upload material you are not allowed to share.'],
      ['Fair use', 'Do not abuse the API, attempt unauthorized access, scrape private learner data, or use the service to distribute harmful content.'],
      ['Changes', 'Features may change as this student-built project is improved. Material corrections and important updates will be recorded in the changelog.'],
    ],
  },
} as const;

export default function PublicInfo({ kind }: Props) {
  if (kind === 'contact') return <main className="about-page public-info-page"><h1>Contact Engineer Made</h1><p>Found a broken lesson, incorrect explanation, accessibility issue, or security problem?</p><p>Email <a href="mailto:engineermade@gmail.com">engineermade@gmail.com</a> with the page URL and a clear description. Never include passwords, API keys, or private learner data.</p><h2>Useful report format</h2><ol><li>Page or lesson URL</li><li>What you expected</li><li>What happened instead</li><li>Browser and device</li></ol></main>;
  if (kind === 'faq') return <main className="about-page public-info-page"><h1>Frequently Asked Questions</h1><div className="faq-list"><details open><summary>Is Engineer Made free?</summary><p>Yes. The learning platform is intended to remain free to use.</p></details><details><summary>Are the AI answers always correct?</summary><p>No. AI can make mistakes. Verify calculations, sources, and safety-critical guidance.</p></details><details><summary>How do I save progress?</summary><p>Sign in before completing lessons, quizzes, assessments, or projects. Your account-backed progress is then available when you return.</p></details><details><summary>How can I report incorrect content?</summary><p>Use the Report Content tool in the dashboard or email the page URL to us.</p></details><details><summary>Can I contribute a project or resource?</summary><p>Yes. Use the project and bookmark tools, and contact us if you want to suggest a curated public resource.</p></details></div></main>;
  if (kind === 'changelog') return <main className="about-page public-info-page"><h1>Engineer Made Changelog</h1><p>Product changes are listed here so learners can see what has changed.</p><article><h2>September 2026</h2><ul><li>Added Search Console verification, sitemap, robots rules, and structured SEO metadata.</li><li>Added dashboard learning tools including Flashcards, Focus Timer, Whiteboard, Themes, Performance, and activity-based badges.</li><li>Added free GitHub CI checks for frontend and backend validation.</li><li>Improved honest empty states and removed Mobile &amp; Offline from the learner sidebar.</li></ul></article><p>Older entries will be added as releases are made.</p></main>;
  const page = sections[kind];
  return <main className="about-page public-info-page"><h1>{page.title}</h1><p>{page.intro}</p>{page.items.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}<small>Last reviewed: September 2026</small></main>;
}
