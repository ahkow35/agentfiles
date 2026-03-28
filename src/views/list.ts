import { setIcon } from "obsidian";
import { TOOL_CONFIGS } from "../tool-configs";
import { TOOL_SVGS, renderToolIcon } from "../tool-icons";
import type { SkillStore } from "../store";
import type { SkillItem } from "../types";

export class ListPanel {
	private containerEl: HTMLElement;
	private store: SkillStore;
	private onSelect: (item: SkillItem) => void;
	private selectedId: string | null = null;

	constructor(
		containerEl: HTMLElement,
		store: SkillStore,
		onSelect: (item: SkillItem) => void
	) {
		this.containerEl = containerEl;
		this.store = store;
		this.onSelect = onSelect;
	}

	setSelected(id: string | null): void {
		this.selectedId = id;
	}

	render(): void {
		this.containerEl.empty();
		this.containerEl.addClass("as-list");

		const searchContainer = this.containerEl.createDiv("as-search");
		const input = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search skills...",
			cls: "as-search-input",
		});
		input.value = this.store.searchQuery;
		input.addEventListener("input", () => {
			this.store.setSearch(input.value);
		});

		const listContainer = this.containerEl.createDiv("as-list-items");
		const items = this.store.filteredItems;

		if (items.length === 0) {
			listContainer.createDiv({
				cls: "as-list-empty",
				text: "No skills found",
			});
			return;
		}

		for (const item of items) {
			this.renderCard(listContainer, item);
		}
	}

	private renderCard(container: HTMLElement, item: SkillItem): void {
		const card = container.createDiv("as-skill-card");
		if (item.id === this.selectedId) card.addClass("is-selected");

		const header = card.createDiv("as-skill-header");
		const nameEl = header.createSpan({ cls: "as-skill-name", text: item.name });

		if (item.isFavorite) {
			const star = header.createSpan("as-skill-star");
			setIcon(star, "star");
		}

		if (item.description) {
			card.createDiv({
				cls: "as-skill-desc",
				text:
					item.description.length > 80
						? item.description.slice(0, 80) + "..."
						: item.description,
			});
		}

		const meta = card.createDiv("as-skill-meta");

		const typeTag = meta.createSpan({
			cls: `as-type-tag as-type-${item.type}`,
			text: item.type,
		});

		for (const toolId of item.tools) {
			const tool = TOOL_CONFIGS.find((t) => t.id === toolId);
			if (!tool) continue;
			const badge = meta.createSpan("as-tool-badge");
			badge.title = tool.name;
			badge.setAttribute("aria-label", tool.name);
			if (TOOL_SVGS[toolId]) {
				badge.style.color = tool.color;
				renderToolIcon(badge, toolId, 12);
			} else {
				badge.style.backgroundColor = tool.color;
				badge.addClass("as-tool-badge-dot");
			}
		}

		card.addEventListener("click", () => {
			this.selectedId = item.id;
			this.onSelect(item);
		});
	}
}
