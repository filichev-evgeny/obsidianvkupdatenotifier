import { App, ButtonComponent, Editor, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, View, Workspace, WorkspaceTabs, parseYaml, request } from 'obsidian';
import { VkChecker } from './vkchecker';
import { normalize } from 'path';


export class GetTokenModal extends Modal {
	result: string;
	onSubmit: (result: string) => void;

	constructor(app: App, onSubmit: (result: string | null) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.style.display = "block"
		contentEl.style.height = "50vh"

		contentEl.createEl("br")
		let b = document.createElement('webview')
		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Press this after granting access")
					.setCta()
					.setWarning()
					.onClick(() => {
						this.close();
						this.onSubmit(b.getAttribute("src")!);
					}));

		b.setAttribute('src', "https://oauth.vk.com/authorize?client_id=" + VkChecker.appId + "&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=" + 262144 + 65536 + "&response_type=token")

		contentEl.appendChild(b)
		b.style.display = "block"

	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

interface VkNotifierSettings {
	dateFormat: string;
	mySetting: string;
	accessToken: string;
	maxDays: number;
	pinLast: boolean;
	style: string;
	maxTextLength: number;
}

const DEFAULT_SETTINGS: VkNotifierSettings = {
	accessToken: 'default',
	mySetting: '',
	maxDays: 5,
	pinLast: false,
	style: `
	.vkGroupNotifier{}
	.pinnedVkPost{font-style:bold}`,
	dateFormat: "DD-MMMM-YYYY",
	maxTextLength: 100
}

export default class VkNotifier extends Plugin {
	settings: VkNotifierSettings;

	postprocessor = async (content: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		let data: Record<string, string> = {}
		content.trim().split(/\r?\n/).map((x) => {
			let xx = x.split(":")
			data[xx[0]] = xx[1].trim()
		})

		let url = "access_token=" + this.settings.accessToken + "&domain=" + data["name"] + "&v=5.154"
		if (data["id"]) {
			url += "&owner_id=-" + data['id'].trim()
		}
		const res = await request({
			url: "https://api.vk.com/method/wall.get",
			method: 'POST',
			body: url

		})
		let j = JSON.parse(res)
		try {

			var items = j["response"]["items"];
			var fitems = items.filter((x) => {
				return moment().diff(x["date"] * 1000, "day") <= parseInt(data["maxDays"] ? data["maxDays"] : this.settings.maxDays.toString())
			})
		} catch (error) {
			el.innerHTML = "Error occured, check consle for more details"
			console.log(j)
			return
		}


		if (this.settings.pinLast || data["pinLast"] == "true") {
			if (!fitems.includes(items[0])) {
				fitems.unshift(items[0])
			}
		}
		if (fitems.length == 0) {
			el.innerHTML = "No new Posts"
			return
		}
		let div = el.createDiv()
		div.innerHTML = "<a href='https://vk.com/" + (data['id'] ? "club" + data["id"].trim() : data["name"]) + "'>Open Page</a>" + this.formatPosts(fitems, this.settings.pinLast || data["pinLast"] == "true", parseInt(data["maxTextLength"]))
		el.appendChild(div);




		ctx.addChild(new MarkdownRenderChild(el))
	}
	private formatPosts(item: any, pin: boolean, maxTextLength: number): string {
		maxTextLength = isNaN(maxTextLength) ? this.settings.maxTextLength : maxTextLength
		let r = document.createElement("table")
		let style = document.createElement("style")
		style.innerHTML = this.settings.style
		r.className = "vkGroupNotifier"

		item.forEach((e, i) => {
			let tr = document.createElement("tr")
			tr.innerHTML = "<td>" + moment.unix(e["date"]).format(this.settings.dateFormat) + "</td><td>" + e["text"].slice(0, maxTextLength) + "</td>"
			if (i == 0 && pin) {
				tr.className = "pinnedVkPost"
			}
			r.appendChild(tr)

		});
		r.appendChild(style)
		return r.outerHTML;
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ExampleSettingTab(this.app, this));
		this.registerMarkdownCodeBlockProcessor('vk-group-notifier', this.postprocessor);


		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() =>
		// 	console.log(VkChecker.test()), 19999
		// ));
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
					var m = new GetTokenModal(this.app, (r) => {
						try {
							let regexp = /access_token=(.*)&e/g
							this.plugin.settings.accessToken = regexp.exec(r!)![0].slice(13)
							new Notice("Done! I don't know how to update settings page , so please re-enter into the settings if you want to see token. But everything should be fine now")
						}
						catch(e)
						{
							new Notice("Something went wrong, can't get access token")
						}
					}).open()

				})
			});

		new Setting(containerEl)
			.setName("maxDays")
			.setDesc("to consider post 'old' ")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.maxDays.toString())
					.onChange(async (value) => {
						this.plugin.settings.maxDays = parseInt(value);
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("pin last post")
			.setDesc("even if it is old ")
			.addToggle((text) =>
				text
					.setValue(this.plugin.settings.pinLast)
					.onChange(async (value) => {
						this.plugin.settings.pinLast = value;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("dateFormat")
			.setDesc("standart js formatting")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (value) => {
						this.plugin.settings.dateFormat = value;
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("maxTextLength")
			.setDesc("from a post to show in a table")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.maxTextLength.toString())
					.onChange(async (value) => {
						this.plugin.settings.maxTextLength = parseInt(value);
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("style")
			.setDesc(`
			Css to decorate table.
			Table class "vkGroupNotifier" 
			Pinned post class "pinnedVkPost"
			`)
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.style)
					.onChange(async (value) => {
						this.plugin.settings.style = value;
						await this.plugin.saveSettings();
					})
			);




	}
}