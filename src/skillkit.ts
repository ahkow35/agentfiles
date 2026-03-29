import { execFile } from "child_process";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const HOME = homedir();
const DB_PATH = join(HOME, ".skillkit", "analytics.db");

function buildPath(): string {
	const extra = [
		"/usr/local/bin",
		"/opt/homebrew/bin",
		join(HOME, ".local", "bin"),
		join(HOME, ".bun", "bin"),
	];
	const nvmDir = join(HOME, ".nvm", "versions", "node");
	try {
		for (const d of readdirSync(nvmDir)) {
			extra.push(join(nvmDir, d, "bin"));
		}
	} catch { /* empty */ }
	const miseDir = join(HOME, ".local", "share", "mise", "installs");
	for (const runtime of ["node", "bun"]) {
		try {
			for (const d of readdirSync(join(miseDir, runtime))) {
				extra.push(join(miseDir, runtime, d, "bin"));
			}
		} catch { /* empty */ }
	}
	return [...extra, process.env.PATH || ""].join(":");
}

function findSkillkitBin(): string | null {
	const searchPaths = [
		"/usr/local/bin/skillkit",
		"/opt/homebrew/bin/skillkit",
		join(HOME, ".local", "bin", "skillkit"),
		join(HOME, ".bun", "bin", "skillkit"),
		join(HOME, ".local", "share", "mise", "shims", "skillkit"),
	];
	for (const p of searchPaths) {
		if (existsSync(p)) return p;
	}
	const nvmDir = join(HOME, ".nvm", "versions", "node");
	try {
		for (const d of readdirSync(nvmDir)) {
			const p = join(nvmDir, d, "bin", "skillkit");
			if (existsSync(p)) return p;
		}
	} catch { /* empty */ }
	const miseDir = join(HOME, ".local", "share", "mise", "installs");
	for (const runtime of ["node", "bun"]) {
		try {
			for (const d of readdirSync(join(miseDir, runtime))) {
				const p = join(miseDir, runtime, d, "bin", "skillkit");
				if (existsSync(p)) return p;
			}
		} catch { /* empty */ }
	}
	return null;
}

let _bin: string | null | undefined;
export function getSkillkitBin(): string | null {
	if (_bin === undefined) _bin = findSkillkitBin();
	return _bin;
}

export interface SkillkitStats {
	uses: number;
	lastUsed: string | null;
	daysSinceUsed: number | null;
	isStale: boolean;
	isHeavy: boolean;
}

export function isSkillkitAvailable(): boolean {
	return getSkillkitBin() !== null || existsSync(DB_PATH);
}

const SKILLKIT_TIMEOUT_MS = 5000

function hasRequiredShape(data: unknown, requiredKeys: string[]): boolean {
	if (typeof data !== 'object' || data === null) return false
	return requiredKeys.every(k => k in (data as object))
}

export function runSkillkitJson<T>(bin: string, args: string[]): Promise<T> {
	return new Promise((resolve, reject) => {
		const child = execFile(
			bin,
			[...args, '--json'],
			{ timeout: SKILLKIT_TIMEOUT_MS },
			(error, stdout, stderr) => {
				if (error) {
					reject(error)
					return
				}
				try {
					const start = stdout.indexOf('{')
					if (start === -1) {
						reject(new Error(`No JSON in skillkit output. stderr: ${stderr}`))
						return
					}
					resolve(JSON.parse(stdout.slice(start)) as T)
				} catch (parseError) {
					reject(parseError)
				}
			}
		)
		child.on('error', reject)
	})
}

export async function getSkillkitStats(): Promise<Map<string, SkillkitStats>> {
	const stats = new Map<string, SkillkitStats>();
	if (!isSkillkitAvailable()) return stats;

	const bin = getSkillkitBin();
	if (!bin) return stats;

	let data: { top_skills: { name: string; total: number; daily: { date: string; count: number }[] }[] } | null = null;
	try {
		data = await runSkillkitJson<{ top_skills: { name: string; total: number; daily: { date: string; count: number }[] }[] }>(bin, ['stats']);
	} catch {
		return stats;
	}

	if (!hasRequiredShape(data, ['top_skills'])) return stats;
	if (!data?.top_skills) return stats;

	const now = Date.now();
	for (const skill of data.top_skills) {
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
