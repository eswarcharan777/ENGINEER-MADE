export type RoadmapOption = { id: string; title: string; icon: string };

// These IDs mirror the backend catalogue. They keep the learner's selected
// role visible during a temporary API outage and make profile setup reliable.
export const ROADMAP_OPTIONS: RoadmapOption[] = [
  { id: 'ai-engineer', title: 'AI / ML Engineer', icon: '🤖' },
  { id: 'fullstack-engineer', title: 'Full Stack Engineer', icon: '⚡' },
  { id: 'data-engineer', title: 'Data Engineer', icon: '📊' },
  { id: 'devops-engineer', title: 'DevOps / Cloud Engineer', icon: '☁️' },
  { id: 'cybersecurity-engineer', title: 'Cybersecurity Engineer', icon: '🔒' },
  { id: 'embedded-iot-engineer', title: 'Embedded / IoT Engineer', icon: '🔌' },
  { id: 'mechanical-engineer', title: 'Mechanical Engineer', icon: '⚙️' },
  { id: 'civil-engineer', title: 'Civil Engineer', icon: '🏗️' },
  { id: 'electrical-engineer', title: 'Electrical Engineer', icon: '⚡' },
  { id: 'electronics-engineer', title: 'Electronics & Communication Engineer', icon: '📡' },
  { id: 'chemical-engineer', title: 'Chemical Engineer', icon: '🧪' },
  { id: 'aerospace-engineer', title: 'Aerospace Engineer', icon: '🚀' },
  { id: 'robotics-engineer', title: 'Robotics Engineer', icon: '🦾' },
  { id: 'automotive-engineer', title: 'Automotive Engineer', icon: '🚗' },
  { id: 'biomedical-engineer', title: 'Biomedical Engineer', icon: '🫀' },
];
