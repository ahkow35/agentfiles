import { execSync } from "child_process";

export interface SkillkitStats {
	uses: number;
	lastUsed: string | null;
	daysSinceUsed: number | null;
	isStale: boolean;
	isHeavy: boolean;
}

export function isSkillkitAvailable(): boolean {
	try {
		execSync("skillkit version", { encoding: "utf-8", timeout: 3000, stdio: "pipe" });
		return true;
	} catch { return false; }
}

export function getSkillkitStats(): Map<string, SkillkitStats> {
	const stats = new Map<string, SkillkitStats>();
	if (!isSkillkitAvailable()) return stats;

	try {
		const raw = execSync("skillkit stats --json", {
			encoding: "utf-8",
			timeout: 15000,
			env: { ...process.env, NO_COLOR: "1" },
		}).trim();

		const jsonStart = raw.indexOf("{");
		if (jsonStart === -1) return stats;

		const data = JSON.parse(raw.slice(jsonStart)) as {
			top_skills: { name: string; total: number; daily: { date: string; count: number }[] }[];
		};

		const now = Date.now();
		for (const skill of data.top_skills || []) {
			const lastDay = skill.daily.length > 0
				? skill.daily[skill.daily.length - 1]?.date
				: null;
			let daysSinceUsed: number | null = null;

			if (lastDay) {
				daysSinceUsed = Math.floor((now - new Date(lastDay).getTime()) / (1000 * 60 * 60 * 24));
			}

			stats.set(skill.name, {
				uses: skill.total,
				lastUsed: lastDay || null,
				daysSinceUsed,
				isStale: daysSinceUsed !== null && daysSinceUsed > 30,
				isHeavy: false,
			});
		}
	} catch {}

	return stats;
}

export function formatLastUsed(lastUsed: string | null): string {
	if (!lastUsed) return "never";
	const ms = Date.now() - new Date(lastUsed).getTime();
	const mins = Math.floor(ms / 60000);
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return `${Math.floor(days / 30)}mo ago`;
}
