import { setIcon } from "obsidian";
import { TOOL_CONFIGS } from "../tool-configs";
import { TOOL_SVGS, renderToolIcon } from "../tool-icons";
import type { SkillStore } from "../store";
import type { SidebarFilter } from "../types";

export class SidebarPanel {
	private containerEl: HTMLElement;
	private store: SkillStore;

	constructor(containerEl: HTMLElement, store: SkillStore) {
		this.containerEl = containerEl;
		this.store = store;
	}

	render(): void {
		this.containerEl.empty();
		this.containerEl.addClass("as-sidebar");

		this.renderSection("Library", [
			{ label: "All Skills", icon: "layers", filter: { kind: "all" } },
			{
				label: "Favorites",
				icon: "star",
				filter: { kind: "favorites" },
			},
		]);

		this.renderTypeSection();
		this.renderToolSection();
		this.renderCollectionSection();
	}

	private renderSection(
		title: string,
		items: { label: string; icon: string; filter: SidebarFilter; count?: number }[]
	): void {
		const section = this.containerEl.createDiv("as-sidebar-section");
		section.createDiv({ cls: "as-sidebar-title", text: title });

		for (const item of items) {
			const row = section.createDiv("as-sidebar-item");
			if (this.isActive(item.filter)) row.addClass("is-active");

			const iconEl = row.createSpan("as-sidebar-icon");
			setIcon(iconEl, item.icon);
			row.createSpan({ cls: "as-sidebar-label", text: item.label });

			if (item.count !== undefined) {
				row.createSpan({
					cls: "as-sidebar-count",
					text: String(item.count),
				});
			}

			row.addEventListener("click", () => {
				this.store.setFilter(item.filter);
			});
		}
	}

	private renderTypeSection(): void {
		const typeCounts = this.store.getTypeCounts();
		const types: { label: string; icon: string; type: string }[] = [
			{ label: "Skills", icon: "sparkles", type: "skill" },
			{ label: "Commands", icon: "terminal", type: "command" },
			{ label: "Agents", icon: "bot", type: "agent" },
			{ label: "Rules", icon: "scroll", type: "rule" },
		];

		const items = types
			.filter((t) => typeCounts.has(t.type))
			.map((t) => ({
				label: t.label,
				icon: t.icon,
				filter: { kind: "type" as const, type: t.type as "skill" | "command" | "agent" | "rule" },
				count: typeCounts.get(t.type) || 0,
			}));

		if (items.length > 0) {
			this.renderSection("Types", items);
		}
	}

	private renderToolSection(): void {
		const toolCounts = this.store.getToolCounts();
		const tools = TOOL_CONFIGS.filter(
			(t) => t.isInstalled() && toolCounts.has(t.id)
		);

		if (tools.length === 0) return;

		const section = this.containerEl.createDiv("as-sidebar-section");
		section.createDiv({ cls: "as-sidebar-title", text: "Tools" });

		for (const tool of tools) {
			const filter: SidebarFilter = { kind: "tool", toolId: tool.id };
			const row = section.createDiv("as-sidebar-item");
			if (this.isActive(filter)) row.addClass("is-active");

			const iconEl = row.createSpan("as-sidebar-icon");
			if (TOOL_SVGS[tool.id]) {
				renderToolIcon(iconEl, tool.id, 14);
			} else {
				setIcon(iconEl, tool.icon);
			}

			row.createSpan({ cls: "as-sidebar-label", text: tool.name });
			row.createSpan({
				cls: "as-sidebar-count",
				text: String(toolCounts.get(tool.id) || 0),
			});

			row.addEventListener("click", () => this.store.setFilter(filter));
		}
	}

	private renderCollectionSection(): void {
		const section = this.containerEl.createDiv("as-sidebar-section");
		section.createDiv({ cls: "as-sidebar-title", text: "Collections" });

		const collections = new Set<string>();
		for (const item of this.store.allItems) {
			for (const c of item.collections) collections.add(c);
		}

		if (collections.size === 0) {
			section.createDiv({
				cls: "as-sidebar-empty",
				text: "No collections yet",
			});
			return;
		}

		for (const name of collections) {
			const filter: SidebarFilter = { kind: "collection", name };
			const row = section.createDiv("as-sidebar-item");
			if (this.isActive(filter)) row.addClass("is-active");

			const iconEl = row.createSpan("as-sidebar-icon");
			setIcon(iconEl, "folder");
			row.createSpan({ cls: "as-sidebar-label", text: name });

			row.addEventListener("click", () => this.store.setFilter(filter));
		}
	}

	private isActive(filter: SidebarFilter): boolean {
		const current = this.store.filter;
		if (current.kind !== filter.kind) return false;
		if (current.kind === "tool" && filter.kind === "tool")
			return current.toolId === filter.toolId;
		if (current.kind === "type" && filter.kind === "type")
			return current.type === filter.type;
		if (current.kind === "collection" && filter.kind === "collection")
			return current.name === filter.name;
		return true;
	}
}
