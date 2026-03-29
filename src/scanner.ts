import * as os from 'os'
import * as path from 'path'
import {
	existsSync,
	readdirSync,
	readFileSync,
	realpathSync,
	statSync,
} from "fs";
import { join, basename, extname } from "path";
import { parseYaml } from "obsidian";
import { createHash } from "crypto";
import { TOOL_CONFIGS } from "./tool-configs";
import type { SkillItem, SkillPath, SkillType, ChopsSettings } from "./types";
import { ErrorBuffer } from './error-buffer'

export const scannerErrors = new ErrorBuffer()

export function isSafePath(inputPath: string): boolean {
	const home = os.homedir()
	const resolved = path.resolve(inputPath)
	return resolved.startsWith(home)
}

const IGNORED_FILES = new Set([
	"readme.md",
	"license",
	"license.md",
	"changelog.md",
	".ds_store",
	"thumbs.db",
]);

function hashPath(p: string): string {
	return createHash("sha256").update(p).digest("hex").slice(0, 12);
}

export function parseFrontmatter(raw: string): {
	frontmatter: Record<string, unknown>;
	content: string;
} {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) {
		return { frontmatter: {}, content: raw };
	}
	try {
		const parsed = parseYaml(match[1]);
		return {
			frontmatter: typeof parsed === "object" && parsed ? parsed : {},
			content: match[2],
		};
	} catch (e) {
		scannerErrors.add(`Failed to parse frontmatter: ${(e as Error).message}`)
		return { frontmatter: {}, content: raw };
	}
}

export function extractName(
	frontmatter: Record<string, unknown>,
	content: string,
	filePath: string,
	pattern: ScanPattern
): string {
	if (typeof frontmatter.name === "string" && frontmatter.name) {
		return frontmatter.name;
	}
	const name = basename(filePath, extname(filePath));
	if (name === "SKILL") return basename(join(filePath, ".."));
	if (pattern === "flat-md" || pattern === "mdc") return name;
	const h1 = content.match(/^#\s+(.+)$/m);
	if (h1) return h1[1].trim();
	return name;
}

function scanDirectoryWithSkillMd(
	baseDir: string,
	type: SkillType,
	toolId: string
): SkillItem[] {
	if (!existsSync(baseDir)) return [];
	const items: SkillItem[] = [];

	for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
		if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
		const skillFile = join(baseDir, entry.name, "SKILL.md");
		if (!existsSync(skillFile)) continue;

		const item = parseSkillFile(skillFile, type, toolId);
		if (item) items.push(item);
	}
	return items;
}

function scanFlatMd(
	baseDir: string,
	type: SkillType,
	toolId: string
): SkillItem[] {
	if (!existsSync(baseDir)) return [];
	const items: SkillItem[] = [];

	for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
		if (entry.isDirectory() || entry.isSymbolicLink()) {
			const skillFile = join(baseDir, entry.name, "SKILL.md");
			if (existsSync(skillFile)) {
				const item = parseSkillFile(skillFile, type, toolId);
				if (item) items.push(item);
				continue;
			}
			let subEntries: import("fs").Dirent[]
			try {
				subEntries = readdirSync(join(baseDir, entry.name), { withFileTypes: true })
			} catch (e) {
				scannerErrors.add(`Cannot read directory ${join(baseDir, entry.name)}: ${(e as Error).message}`)
				continue
			}
			const mdFiles = subEntries
				.filter((f) => !f.isDirectory() && f.name.endsWith(".md") && !IGNORED_FILES.has(f.name.toLowerCase()))
				.map((f) => f.name)
			for (const f of mdFiles) {
				const item = parseSkillFile(join(baseDir, entry.name, f), type, toolId);
				if (item) items.push(item);
			}
			continue;
		}

		const fname = entry.name.toLowerCase();
		if (!fname.endsWith(".md") || IGNORED_FILES.has(fname)) continue;
		const item = parseSkillFile(join(baseDir, entry.name), type, toolId, "flat-md");
		if (item) items.push(item);
	}
	return items;
}

function scanMdc(
	baseDir: string,
	type: SkillType,
	toolId: string
): SkillItem[] {
	if (!existsSync(baseDir)) return [];
	const items: SkillItem[] = [];

	for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
		if (!entry.name.endsWith(".mdc") && !entry.name.endsWith(".md")) continue;
		if (entry.isDirectory()) continue;
		const item = parseSkillFile(join(baseDir, entry.name), type, toolId, "mdc");
		if (item) items.push(item);
	}
	return items;
}

function parseSkillFile(
	filePath: string,
	type: SkillType,
	toolId: string,
	pattern: ScanPattern = "directory-with-skillmd"
): SkillItem | null {
	try {
		const raw = readFileSync(filePath, "utf-8");
		const stat = statSync(filePath);
		const { frontmatter, content } = parseFrontmatter(raw);
		const name = extractName(frontmatter, content, filePath, pattern);
		const description =
			typeof frontmatter.description === "string"
				? frontmatter.description
				: "";

		let realPath: string;
		try {
			realPath = realpathSync(filePath);
		} catch (e) {
			scannerErrors.add(`Cannot resolve real path for ${filePath}: ${(e as Error).message}`)
			realPath = filePath;
		}

		return {
			id: hashPath(realPath),
			name,
			description,
			type,
			tools: [toolId],
			filePath,
			realPath,
			dirPath: join(filePath, ".."),
			content: raw,
			frontmatter,
			lastModified: stat.mtimeMs,
			fileSize: stat.size,
			isFavorite: false,
			collections: [],
		};
	} catch (e) {
		scannerErrors.add(`Failed to parse ${filePath}: ${(e as Error).message}`)
		return null;
	}
}

function scanPath(sp: SkillPath, toolId: string): SkillItem[] {
	switch (sp.pattern) {
		case "directory-with-skillmd":
			return scanDirectoryWithSkillMd(sp.baseDir, sp.type, toolId);
		case "flat-md":
			return scanFlatMd(sp.baseDir, sp.type, toolId);
		case "mdc":
			return scanMdc(sp.baseDir, sp.type, toolId);
	}
}

function scanProjectSkills(projectRoot: string, toolId: string): SkillItem[] {
	if (!isSafePath(projectRoot)) {
		scannerErrors.add(`Blocked unsafe scan path: ${projectRoot}`)
		return []
	}
	const results: SkillItem[] = [];
	const projectDirs = [
		{ sub: ".claude/skills", type: "skill" as SkillType, pattern: "directory-with-skillmd" as ScanPattern },
		{ sub: ".claude/commands", type: "command" as SkillType, pattern: "flat-md" as ScanPattern },
		{ sub: ".claude/agents", type: "agent" as SkillType, pattern: "flat-md" as ScanPattern },
		{ sub: ".cursor/skills", type: "skill" as SkillType, pattern: "directory-with-skillmd" as ScanPattern },
		{ sub: ".codex/skills", type: "skill" as SkillType, pattern: "directory-with-skillmd" as ScanPattern },
	];
	for (const dir of projectDirs) {
		const fullPath = join(projectRoot, dir.sub);
		if (!existsSync(fullPath)) continue;
		const sp: SkillPath = { baseDir: fullPath, type: dir.type, pattern: dir.pattern };
		results.push(...scanPath(sp, toolId));
	}
	return results;
}

export function scanAll(settings: ChopsSettings): Map<string, SkillItem> {
	const allItems: SkillItem[] = [];

	function collectItem(item: SkillItem, toolId: string): void {
		const existing = allItems.find((i) => i.id === item.id);
		if (existing) {
			if (!existing.tools.includes(toolId)) {
				existing.tools.push(toolId);
			}
			return;
		}
		item.isFavorite = settings.favorites.includes(item.id);
		for (const [colName, colIds] of Object.entries(settings.collections)) {
			if (colIds.includes(item.id)) {
				item.collections.push(colName);
			}
		}
		allItems.push(item);
	}

	for (const tool of TOOL_CONFIGS) {
		if (!tool.isInstalled()) continue;
		const toolSettings = settings.tools[tool.id];
		if (toolSettings && !toolSettings.enabled) continue;

		const allPaths = [...tool.paths, ...tool.agentPaths];
		for (const sp of allPaths) {
			for (const item of scanPath(sp, tool.id)) {
				collectItem(item, tool.id);
			}
		}
	}

	for (const projectPath of settings.customScanPaths) {
		if (!existsSync(projectPath)) continue;
		for (const item of scanProjectSkills(projectPath, "claude-code")) {
			collectItem(item, "claude-code");
		}
	}

	// Name-collision pass: rename duplicates with toolId suffix
	const nameCount = new Map<string, number>()
	for (const item of allItems) {
		nameCount.set(item.name, (nameCount.get(item.name) ?? 0) + 1)
	}
	for (const item of allItems) {
		if ((nameCount.get(item.name) ?? 0) > 1) {
			item.name = `${item.name} (${item.tools[0]})`
		}
	}

	const items = new Map<string, SkillItem>();
	for (const item of allItems) {
		items.set(item.id, item);
	}
	return items;
}

export function getInstalledTools(): string[] {
	return TOOL_CONFIGS.filter((t) => t.isInstalled()).map((t) => t.id);
}

export function getWatchPaths(settings: ChopsSettings): string[] {
	const toolPaths = TOOL_CONFIGS
		.filter(t => t.isInstalled())
		.flatMap(t => [...t.paths, ...t.agentPaths])
		.map(sp => sp.baseDir)
		.filter(p => existsSync(p))

	const customPaths = (settings.customScanPaths ?? [])
		.filter(p => isSafePath(p) && existsSync(p))

	return [...new Set([...toolPaths, ...customPaths])]
}
