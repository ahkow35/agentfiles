import { Events } from "obsidian";
import type { SkillItem, SidebarFilter, ChopsSettings } from "./types";
import { scanAll } from "./scanner";

export class SkillStore extends Events {
	private items: Map<string, SkillItem> = new Map();
	private _filter: SidebarFilter = { kind: "all" };
	private _searchQuery = "";

	get filter(): SidebarFilter {
		return this._filter;
	}

	get searchQuery(): string {
		return this._searchQuery;
	}

	get allItems(): SkillItem[] {
		return Array.from(this.items.values());
	}

	get filteredItems(): SkillItem[] {
		let result = this.allItems;

		switch (this._filter.kind) {
			case "favorites":
				result = result.filter((i) => i.isFavorite);
				break;
			case "tool":
				result = result.filter((i) =>
					i.tools.includes(this._filter.toolId)
				);
				break;
			case "type":
				result = result.filter((i) => i.type === this._filter.type);
				break;
			case "collection":
				result = result.filter((i) =>
					i.collections.includes(this._filter.name)
				);
				break;
		}

		if (this._searchQuery) {
			const q = this._searchQuery.toLowerCase();
			result = result.filter(
				(i) =>
					i.name.toLowerCase().includes(q) ||
					i.description.toLowerCase().includes(q) ||
					i.content.toLowerCase().includes(q)
			);
		}

		return result.sort((a, b) => a.name.localeCompare(b.name));
	}

	getItem(id: string): SkillItem | undefined {
		return this.items.get(id);
	}

	refresh(settings: ChopsSettings): void {
		this.items = scanAll(settings);
		this.trigger("updated");
	}

	setFilter(filter: SidebarFilter): void {
		this._filter = filter;
		this.trigger("updated");
	}

	setSearch(query: string): void {
		this._searchQuery = query;
		this.trigger("updated");
	}

	toggleFavorite(id: string, settings: ChopsSettings): void {
		const item = this.items.get(id);
		if (!item) return;
		item.isFavorite = !item.isFavorite;
		if (item.isFavorite) {
			if (!settings.favorites.includes(id)) settings.favorites.push(id);
		} else {
			settings.favorites = settings.favorites.filter((f) => f !== id);
		}
		this.trigger("updated");
	}

	getToolCounts(): Map<string, number> {
		const counts = new Map<string, number>();
		for (const item of this.items.values()) {
			for (const tool of item.tools) {
				counts.set(tool, (counts.get(tool) || 0) + 1);
			}
		}
		return counts;
	}

	getTypeCounts(): Map<string, number> {
		const counts = new Map<string, number>();
		for (const item of this.items.values()) {
			counts.set(item.type, (counts.get(item.type) || 0) + 1);
		}
		return counts;
	}
}
