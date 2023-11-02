import { App, ButtonComponent, Editor, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, parseYaml, request } from 'obsidian';
import { VkChecker } from './vkchecker';


// Remember to rename these classes and interfaces!

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
			data[xx[0]] = xx[1]
		})

		let url = "access_token=" + this.settings.accessToken + "&domain=" + data["name"].trim() + "&v=5.154"
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
			el.innerHTML="Error occured, check consle for more details"
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
		div.innerHTML = this.formatPosts(fitems, this.settings.pinLast || data["pinLast"] == "true",parseInt(data["maxTextLength"]))
		el.appendChild(div);




		ctx.addChild(new MarkdownRenderChild(el))
	}
	private formatPosts(item: any, pin: boolean,maxTextLength:number): string {
		maxTextLength=isNaN(maxTextLength)?this.settings.maxTextLength:maxTextLength
		let r = document.createElement("table")
		let style = document.createElement("style")
		style.innerHTML = this.settings.style
		r.className = "vkGroupNotifier"

		item.forEach((e, i) => {
			let tr = document.createElement("tr")
			tr.innerHTML = "<td>" + moment.unix(e["date"]).format(this.settings.dateFormat) + "</td><td>" + e["text"].slice(0,maxTextLength) + "</td>"
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

					window.open("https://oauth.vk.com/authorize?client_id=" + VkChecker.appId + "&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=" + 262144 + 65536 + "&response_type=token")
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