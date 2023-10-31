import { App, ButtonComponent, Editor, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, request } from 'obsidian';
import { VkChecker } from './vkchecker';

// Remember to rename these classes and interfaces!

interface VkNotifierSettings {
	mySetting: string;
	accessToken: string;
}

const DEFAULT_SETTINGS: VkNotifierSettings = {
	accessToken: 'default',
	mySetting: ''
}

export default class VkNotifier extends Plugin {
	settings: VkNotifierSettings;

	postprocessor = async (content: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		let data = content.split(/\r?\n/)

		const res = await request({
			url: "https://api.vk.com/method/wall.get",
			method: 'POST',
			body: "access_token=" + this.settings.accessToken + "&domain=" + data[0].split(":")[1] + "&v=5.154"

		})
		let j = JSON.parse(res)


		let item = j["response"]["items"][0]
		let div = el.createDiv()
		div.innerHTML="<p>" + new Date(item["date"]) + "</p><p>"+item["text"]+"</p>"
		el.appendChild(div);



		ctx.addChild(new MarkdownRenderChild(el))
	}
	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ExampleSettingTab(this.app, this));
		this.registerMarkdownCodeBlockProcessor('vk-group-notifier', this.postprocessor);


		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() =>
			console.log(VkChecker.test()), 19999
		));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


export class ExampleSettingTab extends PluginSettingTab {
	plugin: VkNotifier;

	constructor(app: App, plugin: VkNotifier) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();
		new Setting(containerEl)
			.setName("access token")
			.setDesc("to get access to your groups")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.accessToken)
					.onChange(async (value) => {
						this.plugin.settings.accessToken = value;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("TEST")
			.addButton((btn) => {
				btn.setButtonText("get access token")
				btn.setTooltip("FFFFFFFFF")
				btn.onClick(async (e) => {

					window.open("https://oauth.vk.com/authorize?client_id=" + VkChecker.appId + "&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=" + 262144 + 65536 + "&response_type=token")
				})
			});


	}
}