// About page lists. The intro text lives in src/pages/about.astro.

export type Experience = { when: string; org: string; orgUrl?: string; role: string; text: string };

export const experience: Experience[] = [
  {
    when: "Incoming",
    org: "Pertamina",
    orgUrl: "https://www.pertamina.com/en",
    role: "Software Engineering Intern",
    text: "Digital Analytics Solution team, for 3 months.",
  },
  {
    when: "2026",
    org: "Deloitte Case Competition",
    role: "Top 5",
    text: "Designed a Privacy Act 1988 compliant data pipeline that combines car crash data from multiple states, so federal policymakers can measure how well the Towards Zero policy is working.",
  },
  {
    when: "2025",
    org: "International Datathon",
    role: "Finalist",
    text: "Analysis of tariff and cargo data for Hong Kong International Airport. The findings are under NDA.",
  },
];

export const tools: Array<{ group: string; items: string[]; learning?: boolean }> = [
  { group: "Machine learning", items: ["Python", "PyTorch", "fast.ai", "OpenCV", "TinyML", "Ollama", "ChromaDB"] },
  { group: "Data", items: ["PostgreSQL", "Snowflake", "SurrealDB", "Excel", "Tableau", "Power BI"] },
  { group: "Backend and web", items: ["FastAPI", "React", "uv"] },
  {
    group: "Cloud and DevOps",
    items: ["AWS EC2", "Elastic Beanstalk", "RDS", "Azure", "Docker", "Docker Compose", "Linux", "Cloudflare"],
  },
  { group: "Learning now", items: ["Kubernetes", "CI/CD", "Infrastructure as code"], learning: true },
];
