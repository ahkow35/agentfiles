import { Plugin, type WorkspaceLeaf } from "obsidian";
import { AgentSkillsView, VIEW_TYPE } from "./views/main-view";
import { SkillStore } from "./store";
import { SkillWatcher } from "./watcher";
import { getWatchPaths } from "./scanner";
import { AgentSkillsSettingTab } from "./settings";
import { DEFAULT_SETTINGS, type ChopsSettings } from "./types";

export default class AgentSkillsPlugin extends Plugin {
	settings: ChopsSettings = DEFAULT_SETTINGS;
	store: SkillStore = new SkillStore();
	private watcher: SkillWatcher | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(VIEW_TYPE, (leaf) =>
			new AgentSkillsView(
				leaf,
				this.store,
				this.settings,
				() => this.saveSettings()
			)
		);

		this.addRibbonIcon("cpu", "Agent Skills", () => this.activateView());

		this.addCommand({
			id: "open-agent-skills",
			name: "Open Agent Skills",
			callback: () => this.activateView(),
		});

		this.addSettingTab(new AgentSkillsSettingTab(this.app, this));

		this.refreshStore();
		this.startWatcher();
	}

	onunload(): void {
		this.stopWatcher();
	}

	refreshStore(): void {
		this.store.refresh(this.settings);
	}

	startWatcher(): void {
		if (!this.settings.watchEnabled) return;
		this.watcher = new SkillWatcher(this.settings.watchDebounceMs, () =>
			this.refreshStore()
		);
		this.watcher.watchPaths(getWatchPaths());
	}

	stopWatcher(): void {
		if (this.watcher) {
			this.watcher.close();
			this.watcher = null;
		}
	}

	restartWatcher(): void {
		this.stopWatcher();
		this.startWatcher();
	}

	async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
