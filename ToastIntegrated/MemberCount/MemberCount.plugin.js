//META{"name":"MemberCount","displayName":"MemberCount","website":"https://github.com/Arashiryuu","source":"https://github.com/Arashiryuu/crap/blob/master/ToastIntegrated/MemberCount/MemberCount.plugin.js"}*//

/*@cc_on
@if (@_jscript)
	
	// Offer to self-install for clueless users that try to run this directly.
	var shell = WScript.CreateObject('WScript.Shell');
	var fs = new ActiveXObject('Scripting.FileSystemObject');
	var pathPlugins = shell.ExpandEnvironmentStrings('%APPDATA%\\BetterDiscord\\plugins');
	var pathSelf = WScript.ScriptFullName;
	// Put the user at ease by addressing them in the first person
	shell.Popup('It looks like you\'ve mistakenly tried to run me directly. \n(Don\'t do that!)', 0, 'I\'m a plugin for BetterDiscord', 0x30);
	if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
		shell.Popup('I\'m in the correct folder already.\nJust reload Discord with Ctrl+R.', 0, 'I\'m already installed', 0x40);
	} else if (!fs.FolderExists(pathPlugins)) {
		shell.Popup('I can\'t find the BetterDiscord plugins folder.\nAre you sure it\'s even installed?', 0, 'Can\'t install myself', 0x10);
	} else if (shell.Popup('Should I copy myself to BetterDiscord\'s plugins folder for you?', 0, 'Do you need some help?', 0x34) === 6) {
		fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
		// Show the user where to put plugins in the future
		shell.Exec('explorer ' + pathPlugins);
		shell.Popup('I\'m installed!\nJust reload Discord with Ctrl+R.', 0, 'Successfully installed', 0x40);
	}
	WScript.Quit();

@else@*/

var MemberCount = (() => {

	/* Setup */

	const toString = Object.prototype.toString;
	const isObject = (o) => toString.call(o) === '[object Object]';

	const spanWrap = (children = []) => {
		if (!children.every(isObject)) children = children.filter(isObject);
		const wrapper = document.createElement('span');
		for (const child of children) {
			if (child.type === 'text') {
				wrapper.appendChild(document.createTextNode(child.children.join('\n')));
				continue;
			}
			const d = document.createElement(child.type);
			if (child.children && child.children.length) {
				for (const c of child.children) {
					d.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
				}
			}
			wrapper.appendChild(d);
		}
		return wrapper;
	};

	const config = {
		main: 'index.js',
		info: {
			name: 'MemberCount',
			authors: [
				{
					name: 'Arashiryuu',
					discord_id: '238108500109033472',
					github_username: 'Arashiryuu',
					twitter_username: ''
				}
			],
			version: '2.1.5',
			description: 'Displays a server\'s member-count at the top of the member-list, can be styled with the #MemberCount selector.',
			github: 'https://github.com/Arashiryuu',
			github_raw: 'https://raw.githubusercontent.com/Arashiryuu/crap/master/ToastIntegrated/MemberCount/MemberCount.plugin.js'
		},
		changelog: [
			{
				title: 'Evolving?',
				type: 'improved',
				items: [
					spanWrap([
						{
							type: 'b',
							children: [
								'Counter',
								' '
							]
						},
						{
							type: 'text',
							children: [
								'now connects via Flux to the MemberCountStore and reads/updates with that.'
							]
						}
					])
				]
			}
		]
	};
	
	const log = function() {
		/**
		 * @type {Array}
		 */
		const args = Array.prototype.slice.call(arguments);
		args.unshift(`%c[${config.info.name}]`, 'color: #3A71C1; font-weight: 700;');
		return console.log.apply(this, args);
	};

	/* Build */

	const buildPlugin = ([Plugin, Api]) => {
		const { Toasts, Logger, Patcher, Settings, Utilities, DOMTools, ReactTools, ReactComponents, DiscordModules, DiscordClasses, WebpackModules, DiscordSelectors, PluginUtilities } = Api;
		const { SettingPanel, SettingGroup, SettingField, Textbox, Switch } = Settings;
		const { React, MemberCountStore, SelectedGuildStore, ContextMenuActions: MenuActions } = DiscordModules;

		const Flux = WebpackModules.getByProps('connectStores');
		const MenuItem = WebpackModules.getByString('disabled', 'brand');

		const ItemGroup = class ItemGroup extends React.Component {
			constructor(props) {
				super(props);
			}

			render() {
				return React.createElement('div', {
					className: DiscordClasses.ContextMenu.itemGroup.toString(),
					children: this.props.children || []
				});
			}
		};

		const Counter = class Counter extends React.Component {
			constructor(props) {
				super(props);
			}

			render() {
				return React.createElement('header', {
					className: `${DiscordClasses.MemberList.membersGroup} container-2ax-kl`,
					id: 'MemberCount',
					children: ['Members', '—', this.props.count]
				});
			}
		};

		const MemberCounter = Flux.connectStores([MemberCountStore], () => ({ count: MemberCountStore.getMemberCount(SelectedGuildStore.getGuildId()) }))(Counter);
		
		return class MemberCount extends Plugin {
			constructor() {
				super();
				this._css;
				this._optIn;
				this.default = { blacklist: [], sticky: true };
				this.settings = Utilities.deepclone(this.default);
				this.promises = {
					state: { cancelled: false },
					cancel() { this.state.cancelled = true; },
					restore() { this.state.cancelled = false; }
				};
				this.css = `
					.theme-dark #MemberCount {
						color: hsla(0, 0%, 100%, 0.4);
						background: #2f3136;
					} 
					
					.theme-light #MemberCount {
						color: #99aab5;
						background: #f3f3f3;
					}
				`;
				this.optIn = `
					#MemberCount {
						position: absolute;
						width: 97%;
						text-align: center;
						padding: 1.8vh 0 0 3%;
						z-index: 5;
						top: 0;
						margin-top: -10px;
					}

					${DiscordSelectors.MemberList.membersWrap} ${DiscordSelectors.MemberList.membersGroup}:nth-child(3) {
						margin-top: 2vh;
					}
				`;
			}

			/* Methods */

			onStart() {
				this.promises.restore();
				this.loadSettings();
				this.addCSS();
				this.patchMemberList();
				this.patchGuildContextMenu(this.promises.state);
				Toasts.info(`${this.name} ${this.version} has started!`, { timeout: 2e3 });
			}

			onStop() {
				this.promises.cancel();
				this.clearCSS();
				Patcher.unpatchAll();
				this.updateAll();
				Toasts.info(`${this.name} ${this.version} has stopped!`, { timeout: 2e3 });
			}

			addCSS() {
				PluginUtilities.addStyle(this.short, this.settings.sticky ? [this.css, this.optIn].join('\n') : this.css);
			}

			clearCSS() {
				PluginUtilities.removeStyle(this.short);
			}

			patchMemberList() {
				const Scroller = WebpackModules.getByDisplayName('VerticalScroller');
				
				Patcher.after(Scroller.prototype, 'render', (that, args, value) => {
					const key = this.getProps(value, 'props.children.0._owner.return.key');
					if (!key || key === 'guild-channels') return value;

					const children = this.getProps(value, 'props.children.0.props.children.1.2');
					if (!children || !Array.isArray(children)) return value;
					
					const guildId = SelectedGuildStore.getGuildId();
					if (this.settings.blacklist.includes(guildId) || !guildId) return value;

					const counter = React.createElement(MemberCounter, {});

					if (!children.find((child) => child.type === MemberCounter)) children.unshift([counter, null]);

					return value;
				});

				this.updateMemberList();
			}

			updateMemberList(scroll) {
				const memberList = document.querySelector(DiscordSelectors.MemberList.members.value.trim());
				if (!memberList) return;
				const inst = ReactTools.getOwnerInstance(memberList);
				if (!inst) return;
				inst.forceUpdate();
				if (scroll) inst.handleOnScroll();
			}

			async patchGuildContextMenu(state) {
				const Component = await ReactComponents.getComponentByName('GuildContextMenu', DiscordSelectors.ContextMenu.contextMenu.toString());
				const { component: Menu } = Component;
				
				if (state.cancelled) return;

				Patcher.after(Menu.prototype, 'render', (that, args, value) => {
					const orig = this.getProps(value, 'props');
					const id = this.getProps(that, 'props.guild.id');

					if (!orig || !id) return;

					const data = this.parseId(id);
					const item = new MenuItem(data);
					const group = React.createElement(ItemGroup, { children: [item] });

					if (Array.isArray(orig.children)) orig.children.splice(1, 0, group);
					else orig.children = [orig.children], orig.children.splice(1, 0, group);

					setImmediate(() => this.updateContextPosition(that));
					return value;
				});

				Component.forceUpdateAll();
			}

			updateContextPosition(that) {
				if (!that) return;
				const height = this.getProps(that, 'props.onHeightUpdate') || this.getProps(that, '_reactInternalFiber.return.memoizedProps.onHeightUpdate');
				height && height();
			}

			parseId(id) {
				const blacklisted = this.settings.blacklist.includes(id);
				return { label: this.getLabel(blacklisted), hint: 'MCount', action: this.getAction(id, blacklisted) };
			}

			getAction(id, blacklisted) {
				return blacklisted ? () => this.unlistGuild(id) : () => this.blacklistGuild(id);
			}

			getLabel(blacklisted) {
				return blacklisted ? 'Include Server' : 'Exclude Server';
			}

			blacklistGuild(id) {
				if (!id) return;
				MenuActions.closeContextMenu();
				this.settings.blacklist.push(id);
				this.saveSettings(this.settings);
				this.updateAll(true);
			}

			unlistGuild(id) {
				if (!id) return;
				MenuActions.closeContextMenu();
				this.settings.blacklist.splice(this.settings.blacklist.indexOf(id), 1);
				this.saveSettings(this.settings);
				this.updateAll(true);
			}

			updateAll(t) {
				this.updateMemberList(t);
			}

			updateCSS() {
				this.clearCSS();
				this.addCSS();
			}

			/* Load Settings */

			loadSettings() {
				const data = super.loadSettings();
				if (!Array.isArray(data.blacklist)) data.blacklist = Object.values(data.blacklist);
				this.settings = Utilities.deepclone(data);
			}

			/* Utility */

			/**
			 * Function to access properties of an object safely, returns false instead of erroring if the property / properties do not exist.
			 * @name safelyGetNestedProps
			 * @author Zerebos
			 * @param {Object} obj The object we are accessing.
			 * @param {String} path The properties we want to traverse or access.
			 * @returns {*}
			 */
			getProps(obj, path) {
				return path.split(/\s?\.\s?/).reduce((object, prop) => object && object[prop], obj);
			}

			/* Settings Panel */

			getSettingsPanel() {
				return SettingPanel.build(() => this.saveSettings(this.settings),
					new SettingGroup('Plugin Settings').append(
						new Switch('Sticky Counter', 'Adds CSS to always position the counter atop the member list, regardless of scroll.', this.settings.sticky, (i) => {
							this.settings.sticky = i;
							this.updateCSS();
						})
					)
				);
			}

			/* Setters */

			set css(style = '') {
				return this._css = style.split(/\s+/g).join(' ').trim();
			}

			set optIn(style = '') {
				return this._optIn = style.split(/\s+/g).join(' ').trim();
			}

			/* Getters */

			get [Symbol.toStringTag]() {
				return 'Plugin';
			}

			get css() {
				return this._css;
			}

			get optIn() {
				return this._optIn;
			}

			get name() {
				return config.info.name;
			}

			get short() {
				let string = '';

				for (let i = 0, len = config.info.name.length; i < len; i++) {
					const char = config.info.name[i];
					if (char === char.toUpperCase()) string += char;
				}

				return string;
			}

			get author() {
				return config.info.authors.map((author) => author.name).join(', ');
			}

			get version() {
				return config.info.version;
			}

			get description() {
				return config.info.description;
			}
		};
	};

	/* Finalize */

	return !global.ZeresPluginLibrary 
		? class {
			getName() {
				return this.name.replace(/\s+/g, '');
			}

			getAuthor() {
				return this.author;
			}

			getVersion() {
				return this.version;
			}

			getDescription() {
				return this.description;
			}

			stop() {
				log('Stopped!');
			}

			load() {
				const title = 'Library Missing';
				const ModalStack = window.BdApi.findModuleByProps('push', 'update', 'pop', 'popWithKey');
				const TextElement = window.BdApi.findModuleByProps('Sizes', 'Weights');
				const ConfirmationModal = window.BdApi.findModule((m) => m.defaultProps && m.key && m.key() === 'confirm-modal');
				if (!ModalStack || !ConfirmationModal || !TextElement) return window.BdApi.getCore().alert(title, `The library plugin needed for ${config.info.name} is missing.<br /><br /> <a href="https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js" target="_blank">Click here to download the library!</a>`);
				ModalStack.push(function(props) {
					return window.BdApi.React.createElement(ConfirmationModal, Object.assign({
						header: title,
						children: [
							TextElement({
								color: TextElement.Colors.PRIMARY,
								children: [`The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`]
							})
						],
						red: false,
						confirmText: 'Download Now',
						cancelText: 'Cancel',
						onConfirm: () => {
							require('request').get('https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js', async (error, response, body) => {
								if (error) return require('electron').shell.openExternal('https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js');
								await new Promise(r => require('fs').writeFile(require('path').join(window.ContentManager.pluginsFolder, '0PluginLibrary.plugin.js'), body, r));
							});
						}
					}, props));
				});
			}

			start() {
				log('Started!');
			}

			/* Getters */

			get [Symbol.toStringTag]() {
				return 'Plugin';
			}

			get name() {
				return config.info.name;
			}

			get short() {
				let string = '';

				for (let i = 0, len = config.info.name.length; i < len; i++) {
					const char = config.info.name[i];
					if (char === char.toUpperCase()) string += char;
				}

				return string;
			}

			get author() {
				return config.info.authors.map((author) => author.name).join(', ');
			}

			get version() {
				return config.info.version;
			}

			get description() {
				return config.info.description;
			}
		}
		: buildPlugin(global.ZeresPluginLibrary.buildPlugin(config));
})();

/*@end@*/
