import { App, MarkdownPostProcessorContext, MarkdownRenderChild, Modal, Notice, Platform, Plugin, PluginSettingTab, Setting, request } from 'obsidian';
import moment from 'moment';


const appId = 51781583;
export class GetTokenModal extends Modal {
	result: string;
	onSubmit: (result: string) => void;

	constructor(app: App, onSubmit: (result: string | null) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("br")

		const url = "https://oauth.vk.com/authorize?client_id=" + appId + "&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=" + 262144 + 65536 + "&response_type=token";
		if ((Platform.isIosApp || Platform.isAndroidApp)) {
			contentEl.createEl('p', { text: "Since I can't make WebView to work on Android, you should login in external browser and copy-paste page link in the input field." })
			new Setting(contentEl)
				.addText((t) =>
					t.onChange((t) =>
						this.result = t)
				)
			new Setting(contentEl)
				.addButton((btn) =>
					btn
						.setButtonText("Open auth window")
						.setCta()
						.setWarning()
						.onClick(() => {
							window.open(url)
						})
				);
			new Setting(contentEl)
				.addButton((btn) =>
					btn
						.setButtonText("Press this after pasting the link")
						.setCta()
						.setWarning()
						.onClick(() => {
							this.close();
							this.onSubmit(this.result);

						})
				);

			return
		}
		let b = document.createElement('webview')
		b.addEventListener('did-stop-loading', (e) => {
			let url = b.getAttribute("src")
			if (url?.contains("https://oauth.vk.com/blank.html#access_token=")) {
				this.close()
				this.onSubmit(b.getAttribute("src")!)
			}
		})
		b.setAttribute('src', url)
		contentEl.appendChild(b)
		b.setAttribute('useragent', "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_5_6; en-US) AppleWebKit/603.25 (KHTML, like Gecko) Chrome/48.0.1971.300 Safari/537")
		b.shadowRoot!.querySelector("iframe")!.style.height = "70vh"



	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

interface VkNotifierSettings {
	dateFormat: string;

	accessToken: string;
	maxDays: number;
	pinLast: boolean;
	style: string;
	maxTextLength: number;
}

const DEFAULT_SETTINGS: VkNotifierSettings = {
	accessToken: 'default',

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
		let fitems
		let items
		try {

			items = j["response"]["items"];
			fitems = items.filter((x: { [x: string]: number; }) => {
				return moment().diff(x["date"] * 1000, "day") <= parseInt(data["maxDays"] ? data["maxDays"] : this.settings.maxDays.toString())
			})
		} catch (error) {
			el.setText(j["error"]['error_msg'].toString())
			console.log(j)
			return
		}


		if (this.settings.pinLast || data["pinLast"] == "true") {
			if (!fitems.includes(items[0])) {
				fitems.unshift(items[0])
			}
		}
		if (fitems.length == 0) {
			el.setText("No new Posts")
			return
		}
		let div = el.createDiv()
		div.createEl("a", { href: "https://vk.com/' + (data['id'] ? 'club' + data['id'].trim() : data['name']) + '", text: "Open Page" })
		div.appendChild(this.formatPosts(fitems, this.settings.pinLast || data["pinLast"] == "true", parseInt(data["maxTextLength"] ? data["maxTextLength"] : this.settings.maxTextLength.toString()), data["dateFormat"] ? data["dateFormat"] : this.settings.dateFormat))
		el.appendChild(div);
		ctx.addChild(new MarkdownRenderChild(el))
	}
	private formatPosts(item: any, pin: boolean, maxTextLength: number, dateFormat: string): HTMLElement {
		maxTextLength = isNaN(maxTextLength) ? this.settings.maxTextLength : maxTextLength
		let r = document.createElement("table")
		let style = r.createEl("style", { text: this.settings.style })
		r.className = "vkGroupNotifier"

		item.forEach((e: { [x: string]: string; }, i: number) => {
			let tr = r.createEl("tr")
			tr.createEl("td", { text: moment.unix(e["date"] as unknown as number).format(dateFormat) })
			tr.createEl('td', { text: e["text"].slice(0, maxTextLength) })
			if (i == 0 && pin) {
				tr.className = "pinnedVkPost"
			}


		});
		r.appendChild(style)
		return r;
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new VkNotifierSettingsTab(this.app, this));
		this.registerMarkdownCodeBlockProcessor('vk-group-notifier', this.postprocessor);



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


export class VkNotifierSettingsTab extends PluginSettingTab {
	plugin: VkNotifier;

	constructor(app: App, plugin: VkNotifier) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Plugin requires access token to get posts from groups")
			.addButton((btn) => {
				btn.setButtonText("get access token")
				btn.setTooltip("Asked permissions: group, offline")
				btn.onClick(async (e) => {
					let m = new GetTokenModal(this.app, async (r) => {
						try {
							let regexp = /access_token=(.*)&e/g
							this.plugin.settings.accessToken = regexp.exec(r!)![0].slice(13)
							await this.plugin.saveSettings();
							new Notice("Done!")
						}
						catch (e) {
							new Notice("Something went wrong, can't get access token")
						}
					}).open()

				})
			});

		new Setting(containerEl)
			.setName("Maximum days (maxDays)")
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
			.setName("Pin last post (pinLast)")
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
			.setName("Date format (dateFormat)")
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
			.setName("Maximum amount of symbols (maxTextLength)")
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
			.setName("Style (style)")
			.setDesc(`
			Css to decorate table.
			table class "vkGroupNotifier", 
			pinned post class "pinnedVkPost"
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